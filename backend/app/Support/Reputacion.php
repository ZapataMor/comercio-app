<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\ReputacionEvento;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Nivel de confiabilidad (0–100) de negocios y domiciliarios.
 *
 * Cómo funciona:
 *  - Todo negocio/domiciliario arranca en `reputacion.inicial` (80).
 *  - Lo que pasa en cada pedido queda como un EVENTO con sus puntos
 *    (tabla reputacion_eventos): +2 si el cliente quedó conforme, -35 si el
 *    pedido nunca llegó, etc. Ver MOTIVOS. Al domiciliario el cliente lo
 *    califica con caritas de 1 a 5 (ver ASPECTOS_DOMICILIARIO).
 *  - El puntaje se recalcula repasando los eventos en orden, topado entre 0 y
 *    100: portarse bien mucho tiempo no "ahorra" puntos sin límite, y si un
 *    admin anula un evento injusto, todo se recalcula solo.
 *  - Veto: puntaje por debajo de `umbral_veto`, o dos faltas graves en
 *    `dias_graves` días. Un vetado no vuelve solo: un admin le da una segunda
 *    oportunidad o anula los eventos que lo causaron.
 */
class Reputacion
{
    public const NEGOCIO = 'negocio';

    public const DOMICILIARIO = 'domiciliario';

    /** Evento del admin que levanta un veto y deja el puntaje en "riesgo". */
    public const SEGUNDA_OPORTUNIDAD = 'segunda_oportunidad';

    /** Evento del admin que veta a mano (sin importar el puntaje). */
    public const SUSPENSION_ADMIN = 'suspension_admin';

    /**
     * Motivo => [puntos, descripción, ¿falta grave?].
     *
     * @var array<string, array<string, array{0: int, 1: string, 2: bool}>>
     */
    public const MOTIVOS = [
        self::NEGOCIO => [
            'preparacion_a_tiempo' => [1, 'Tuvo el pedido listo a tiempo', false],
            'cliente_conforme' => [2, 'El cliente quedó conforme', false],
            'preparacion_tarde' => [-3, 'Se pasó de su tiempo de preparación', false],
            'cancelo_tras_aceptar' => [-8, 'Canceló un pedido que ya llevaba rato aceptado', false],
            'mala_atencion' => [-3, 'Mala atención al cliente', false],
            'mala_calidad' => [-5, 'Productos en mal estado o de mala calidad', false],
            'pedido_incompleto' => [-8, 'Faltaron productos en el pedido', false],
            'producto_equivocado' => [-8, 'Mandó productos que no eran', false],
        ],
        self::DOMICILIARIO => [
            'dinero_entregado' => [2, 'Entregó el dinero completo al negocio', false],
            'recogida_tarde' => [-3, 'Recogió el pedido después de lo que prometió', false],
            // De antes de las caritas: siguen en el historial de cada uno.
            'cliente_conforme' => [2, 'El cliente quedó conforme', false],
            'llego_tarde' => [-5, 'El pedido llegó tarde', false],
            'mal_trato' => [-5, 'Mal trato con el cliente', false],
            'pedido_manipulado' => [-15, 'El pedido llegó abierto o manipulado', false],
            'cobro_de_mas' => [-15, 'Le cobró de más al cliente', false],
            'dinero_incompleto' => [-15, 'Entregó el dinero incompleto al negocio', false],
            'no_llego' => [-35, 'El cliente dice que el pedido nunca le llegó', true],
            'dinero_no_entregado' => [-35, 'No le entregó el dinero al negocio', true],
        ],
    ];

    /**
     * Lo que el cliente puede reportar al calificar (motivo => texto para él).
     * Del domiciliario solo lo grave: el resto lo dicen las caritas.
     *
     * @var array<string, array<string, string>>
     */
    public const PROBLEMAS_CLIENTE = [
        self::NEGOCIO => [
            'producto_equivocado' => 'Me mandaron algo que no pedí',
            'pedido_incompleto' => 'Faltaron productos',
            'mala_calidad' => 'Mal estado o mala calidad',
            'mala_atencion' => 'Mala atención',
        ],
        self::DOMICILIARIO => [
            'no_llego' => 'Nunca me llegó el pedido',
            'pedido_manipulado' => 'Llegó abierto o manipulado',
            'cobro_de_mas' => 'Me cobró de más',
        ],
    ];

    /**
     * Lo que el cliente califica del domiciliario, de 1 (carita muy brava) a
     * 5 (muy feliz). `caritas` es el texto de cada una, de la 1 a la 5.
     *
     * @var array<string, array{nombre: string, ayuda: string, caritas: array<int, string>}>
     */
    public const ASPECTOS_DOMICILIARIO = [
        'amabilidad' => [
            'nombre' => 'Amabilidad',
            'ayuda' => '¿Cómo te trató?',
            'caritas' => ['Muy grosero', 'Poco amable', 'Normal', 'Amable', 'Muy amable'],
        ],
        'rapidez' => [
            'nombre' => 'Rapidez',
            'ayuda' => '¿Llegó en el tiempo que esperabas?',
            'caritas' => ['Muy lento', 'Lento', 'Normal', 'Rápido', 'Rapidísimo'],
        ],
        'estado_producto' => [
            'nombre' => 'Estado del producto',
            'ayuda' => '¿Llegó sin regarse, aplastarse ni enfriarse?',
            'caritas' => ['Muy maltratado', 'Maltratado', 'Aceptable', 'Bien cuidado', 'Perfecto'],
        ],
    ];

    /**
     * Puntos de confiabilidad por carita: 4 o 5 suman, 3 no cambia nada y
     * 1 o 2 restan (un 1 pesa como las quejas de antes: llegó tarde, mal trato).
     */
    public const PUNTOS_CARITA = [1 => -5, 2 => -2, 3 => 0, 4 => 1, 5 => 1];

    /** Demoras que no restan si el domiciliario reportó una novedad. */
    private const PERDONABLES_CON_NOVEDAD = ['recogida_tarde', 'llego_tarde'];

    /** Columnas donde vive el puntaje de cada tipo de sujeto. */
    private const COLUMNAS = [
        self::NEGOCIO => [
            'puntaje' => 'reputacion',
            'pedidos' => 'reputacion_pedidos',
            'vetado' => 'vetado_at',
            'motivo' => 'motivo_veto',
        ],
        self::DOMICILIARIO => [
            'puntaje' => 'reputacion_domiciliario',
            'pedidos' => 'reputacion_domiciliario_pedidos',
            'vetado' => 'domiciliario_vetado_at',
            'motivo' => 'domiciliario_motivo_veto',
        ],
    ];

    /**
     * Registra un evento y recalcula el puntaje. Un mismo motivo cuenta una
     * sola vez por pedido (llamarlo de nuevo no vuelve a restar).
     */
    public static function registrar(
        string $tipo,
        Model $sujeto,
        string $motivo,
        ?Pedido $pedido = null,
        string $origen = ReputacionEvento::ORIGEN_SISTEMA,
        ?string $comentario = null,
    ): ReputacionEvento {
        [$puntos, , $grave] = self::datosMotivo($tipo, $motivo)
            ?? throw new \InvalidArgumentException("Motivo de reputación desconocido: {$tipo}.{$motivo}");

        // Demora con justificación del domiciliario: queda anotada, sin castigo.
        $esDemora = in_array($motivo, self::PERDONABLES_CON_NOVEDAD, true) || str_starts_with($motivo, 'rapidez_');
        if ($pedido?->novedad && $esDemora && $puntos < 0) {
            $puntos = 0;
            $comentario = 'Justificó: '.$pedido->novedad;
        }

        $evento = ReputacionEvento::firstOrCreate(
            ['tipo' => $tipo, 'sujeto_id' => $sujeto->getKey(), 'pedido_id' => $pedido?->id, 'motivo' => $motivo],
            ['puntos' => $puntos, 'grave' => $grave, 'origen' => $origen, 'comentario' => $comentario],
        );

        if ($evento->wasRecentlyCreated) {
            self::recalcular($tipo, $sujeto);
        }

        return $evento;
    }

    /**
     * Admin: levanta el veto. Deja el puntaje justo en el umbral de riesgo y
     * las faltas graves anteriores ya no cuentan para un nuevo veto.
     */
    public static function darSegundaOportunidad(string $tipo, Model $sujeto, int $adminId): void
    {
        $actual = self::resumen($tipo, $sujeto)['puntaje'];

        ReputacionEvento::create([
            'tipo' => $tipo,
            'sujeto_id' => $sujeto->getKey(),
            'motivo' => self::SEGUNDA_OPORTUNIDAD,
            'puntos' => max(0, (int) config('reputacion.umbral_riesgo') - $actual),
            'grave' => false,
            'origen' => ReputacionEvento::ORIGEN_ADMIN,
            'comentario' => "Levantado por el admin #{$adminId}",
        ]);

        self::recalcular($tipo, $sujeto, puedeLevantarVeto: true);
    }

    /**
     * Admin: veta a mano (por algo que vio fuera de la app, por ejemplo).
     * Queda en el historial y solo se quita con una segunda oportunidad o
     * anulando este mismo evento.
     */
    public static function suspender(string $tipo, Model $sujeto, int $adminId, string $motivo): void
    {
        ReputacionEvento::create([
            'tipo' => $tipo,
            'sujeto_id' => $sujeto->getKey(),
            'motivo' => self::SUSPENSION_ADMIN,
            'puntos' => 0,
            'grave' => false,
            'origen' => ReputacionEvento::ORIGEN_ADMIN,
            'comentario' => $motivo,
        ]);

        self::recalcular($tipo, $sujeto);
    }

    /** Admin: anula un evento injusto y recalcula (puede levantar el veto). */
    public static function anular(ReputacionEvento $evento, Model $sujeto, int $adminId): void
    {
        $evento->update(['anulado_at' => now(), 'anulado_por' => $adminId]);

        self::recalcular($evento->tipo, $sujeto, puedeLevantarVeto: true);
    }

    /**
     * Recalcula el puntaje desde el historial y aplica el veto si corresponde.
     * El veto solo se quita cuando lo pide un admin ($puedeLevantarVeto).
     */
    public static function recalcular(string $tipo, Model $sujeto, bool $puedeLevantarVeto = false): void
    {
        $col = self::COLUMNAS[$tipo];

        $eventos = ReputacionEvento::where('tipo', $tipo)
            ->where('sujeto_id', $sujeto->getKey())
            ->whereNull('anulado_at')
            ->orderBy('id')
            ->get();

        $puntaje = (int) config('reputacion.inicial');
        foreach ($eventos as $evento) {
            $puntaje = max(0, min(100, $puntaje + $evento->puntos));
        }

        $sujeto->forceFill([
            $col['puntaje'] => $puntaje,
            $col['pedidos'] => $eventos->pluck('pedido_id')->filter()->unique()->count(),
        ]);

        $motivoVeto = self::motivoDeVeto($tipo, $puntaje, $eventos);
        $vetado = $sujeto->{$col['vetado']} !== null;

        if ($motivoVeto && ! $vetado) {
            $sujeto->forceFill([$col['vetado'] => now(), $col['motivo'] => $motivoVeto]);
        } elseif (! $motivoVeto && $vetado && $puedeLevantarVeto) {
            $sujeto->forceFill([$col['vetado'] => null, $col['motivo'] => null]);
        }

        $sujeto->save();
    }

    /**
     * Resumen para la app: puntaje, nivel y si está vetado.
     *
     * @return array{puntaje: int, nivel: string, nivel_label: string, pedidos: int, vetado: bool, motivo_veto: ?string}
     */
    public static function resumen(string $tipo, Model $sujeto): array
    {
        $col = self::COLUMNAS[$tipo];
        // Un modelo recién creado no trae los defaults de la BD hasta recargarlo.
        $puntaje = (int) ($sujeto->{$col['puntaje']} ?? config('reputacion.inicial'));
        $pedidos = (int) ($sujeto->{$col['pedidos']} ?? 0);
        $vetado = $sujeto->{$col['vetado']} !== null;
        [$nivel, $label] = self::nivel($puntaje, $pedidos, $vetado);

        return [
            'puntaje' => $puntaje,
            'nivel' => $nivel,
            'nivel_label' => $label,
            'pedidos' => $pedidos,
            'vetado' => $vetado,
            'motivo_veto' => $vetado ? $sujeto->{$col['motivo']} : null,
        ];
    }

    /** @return array{0: string, 1: string} clave y etiqueta del nivel */
    public static function nivel(int $puntaje, int $pedidos, bool $vetado): array
    {
        return match (true) {
            $vetado => ['vetado', 'Vetado'],
            $puntaje < config('reputacion.umbral_riesgo') => ['riesgo', 'En riesgo'],
            $pedidos < config('reputacion.pedidos_para_nivel') => ['nuevo', 'Nuevo'],
            $puntaje >= 90 => ['excelente', 'Excelente'],
            $puntaje >= 70 => ['confiable', 'Confiable'],
            default => ['regular', 'Regular'],
        };
    }

    /**
     * Últimos eventos de un sujeto, para mostrarle por qué tiene su nivel.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function historial(string $tipo, Model $sujeto, int $limite = 30, bool $conAnulados = false): array
    {
        return ReputacionEvento::where('tipo', $tipo)
            ->where('sujeto_id', $sujeto->getKey())
            ->when(! $conAnulados, fn ($q) => $q->whereNull('anulado_at'))
            ->latest('id')
            ->limit($limite)
            ->get()
            ->map(fn (ReputacionEvento $e) => [
                'id' => $e->id,
                'motivo' => $e->motivo,
                'descripcion' => self::descripcion($e->tipo, $e->motivo),
                'puntos' => $e->puntos,
                'grave' => $e->grave,
                'origen' => $e->origen,
                'comentario' => $e->comentario,
                'pedido_id' => $e->pedido_id,
                'anulado' => $e->anulado_at !== null,
                'fecha' => $e->created_at->format('d/m/Y H:i'),
            ])
            ->all();
    }

    public static function descripcion(string $tipo, string $motivo): string
    {
        if ($motivo === self::SEGUNDA_OPORTUNIDAD) {
            return 'Un administrador le dio una segunda oportunidad';
        }

        if ($motivo === self::SUSPENSION_ADMIN) {
            return 'Un administrador lo suspendió';
        }

        return self::datosMotivo($tipo, $motivo)[1] ?? $motivo;
    }

    /** Opciones de problemas para el formulario de calificación del cliente. */
    public static function opcionesCliente(string $tipo): array
    {
        return collect(self::PROBLEMAS_CLIENTE[$tipo])
            ->map(fn ($label, $clave) => ['clave' => $clave, 'label' => $label])
            ->values()
            ->all();
    }

    /** Lo que se califica con caritas, para el formulario del cliente. */
    public static function aspectosCliente(): array
    {
        return collect(self::ASPECTOS_DOMICILIARIO)
            ->map(fn ($a, $clave) => ['clave' => $clave, ...$a])
            ->values()
            ->all();
    }

    /** Motivo del evento de una carita: "rapidez_4". */
    public static function motivoCarita(string $aspecto, int $nota): string
    {
        return "{$aspecto}_{$nota}";
    }

    /**
     * Promedio de caritas (1 a 5) que los clientes le han dado al
     * domiciliario en cada aspecto. Sale de los eventos, así que lo que un
     * admin anula tampoco cuenta aquí. null si nadie lo ha calificado aún.
     *
     * @return array{calificaciones: int, aspectos: array<int, array{clave: string, nombre: string, promedio: ?float, votos: int}>}|null
     */
    public static function caritasPromedio(Model $domiciliario): ?array
    {
        $motivos = [];
        foreach (array_keys(self::ASPECTOS_DOMICILIARIO) as $aspecto) {
            foreach (array_keys(self::PUNTOS_CARITA) as $nota) {
                $motivos[] = self::motivoCarita($aspecto, $nota);
            }
        }

        $eventos = ReputacionEvento::where('tipo', self::DOMICILIARIO)
            ->where('sujeto_id', $domiciliario->getKey())
            ->whereNull('anulado_at')
            ->whereIn('motivo', $motivos)
            ->get(['motivo', 'pedido_id']);

        if ($eventos->isEmpty()) {
            return null;
        }

        // "estado_producto_4" => ["estado_producto", 4]
        $notas = $eventos->groupBy(fn ($e) => substr($e->motivo, 0, -2))
            ->map(fn ($grupo) => $grupo->map(fn ($e) => (int) substr($e->motivo, -1)));

        return [
            'calificaciones' => $eventos->pluck('pedido_id')->unique()->count(),
            'aspectos' => collect(self::ASPECTOS_DOMICILIARIO)
                ->map(fn ($a, $clave) => [
                    'clave' => $clave,
                    'nombre' => $a['nombre'],
                    'promedio' => isset($notas[$clave]) ? round($notas[$clave]->avg(), 1) : null,
                    'votos' => isset($notas[$clave]) ? $notas[$clave]->count() : 0,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * [puntos, descripción, ¿grave?] de un motivo, incluidas las caritas
     * ("amabilidad_5" → "Amabilidad: 5 de 5 · Muy amable"). null si no existe.
     *
     * @return array{0: int, 1: string, 2: bool}|null
     */
    private static function datosMotivo(string $tipo, string $motivo): ?array
    {
        if ($tipo === self::DOMICILIARIO && preg_match('/^(\w+)_([1-5])$/', $motivo, $m)) {
            $aspecto = self::ASPECTOS_DOMICILIARIO[$m[1]] ?? null;
            if ($aspecto) {
                $nota = (int) $m[2];

                return [self::PUNTOS_CARITA[$nota], "{$aspecto['nombre']}: {$nota} de 5 · {$aspecto['caritas'][$nota - 1]}", false];
            }
        }

        return self::MOTIVOS[$tipo][$motivo] ?? null;
    }

    /**
     * ¿De $desde a $hasta pasaron más minutos que los prometidos + el margen?
     * Sin datos (pedidos viejos) no se castiga a nadie.
     */
    public static function excedeTiempo(?Carbon $desde, ?Carbon $hasta, ?int $prometidos): bool
    {
        if (! $desde || ! $hasta || ! $prometidos) {
            return false;
        }

        $margen = max(
            (int) config('reputacion.tolerancia_minutos'),
            (int) ceil($prometidos * config('reputacion.tolerancia_porcentaje') / 100),
        );

        return $desde->diffInMinutes($hasta) > $prometidos + $margen;
    }

    /** ¿Por qué debería quedar vetado? null si no corresponde. */
    private static function motivoDeVeto(string $tipo, int $puntaje, Collection $eventos): ?string
    {
        // Lo de antes de una segunda oportunidad ya no cuenta para vetar.
        $desdeId = $eventos->where('motivo', self::SEGUNDA_OPORTUNIDAD)->last()?->id ?? 0;

        // Suspensión manual del admin: vale aunque el puntaje esté bien.
        $suspension = $eventos->where('motivo', self::SUSPENSION_ADMIN)->where('id', '>', $desdeId)->last();
        if ($suspension) {
            return 'Suspendido por un administrador'.($suspension->comentario ? ": {$suspension->comentario}" : '');
        }

        if ($tipo === self::NEGOCIO && ! config('reputacion.vetar_negocios')) {
            return null;
        }

        $dias = (int) config('reputacion.dias_graves');
        $graves = $eventos
            ->filter(fn ($e) => $e->grave && $e->id > $desdeId && $e->created_at->gte(now()->subDays($dias)))
            ->count();

        if ($graves >= config('reputacion.graves_para_veto')) {
            return "{$graves} faltas graves en menos de {$dias} días";
        }

        if ($puntaje < config('reputacion.umbral_veto')) {
            return 'Nivel de confiabilidad por debajo de '.config('reputacion.umbral_veto');
        }

        return null;
    }
}
