<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\UniqueConstraintViolationException;
use RuntimeException;

class Pedido extends Model
{
    protected $table = 'pedidos';

    /**
     * Estados del pedido, EN ORDEN (sirve también para el "stepper" de avance).
     * 'cancelado' queda fuera: es un final alternativo (ver CancelarPedido).
     */
    public const ESTADOS = ['pendiente', 'aceptado', 'listo', 'tomado', 'recogido', 'en_camino', 'entregado'];

    /** Estados con un domiciliario llevando el pedido. */
    public const EN_RUTA = ['tomado', 'recogido', 'en_camino', 'devolviendo'];

    /** Desde que lo recogen el cliente tiene código de entrega. */
    public const CON_CODIGO_ENTREGA = ['recogido', 'en_camino'];

    /** Letras y números que no se confunden entre sí (sin 0, 1, I, L, O ni U). */
    private const ALFABETO_CODIGO = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

    private const LARGO_CODIGO = 8;

    /** Reintentos si dos pedidos eligen el mismo código en el mismo instante. */
    private const INTENTOS_CODIGO = 5;

    /** Estados en los que el pedido sigue vivo (ni entregado ni cancelado). */
    public const EN_CURSO = ['pendiente', 'aceptado', 'listo', 'tomado', 'recogido', 'en_camino', 'devolviendo'];

    /** Etiquetas legibles de cada estado. */
    public const ESTADO_LABEL = [
        'pendiente' => 'Pendiente',
        'aceptado' => 'En preparación',
        'listo' => 'Listo para recoger',
        'tomado' => 'Domiciliario asignado',
        'recogido' => 'Recogido',
        'en_camino' => 'En camino',
        'entregado' => 'Entregado',
        'cancelado' => 'Cancelado',
        'devolviendo' => 'Devolviendo al comercio',
    ];

    /** Formas de pago admitidas. */
    public const METODOS_PAGO = ['efectivo', 'transferencia'];

    protected $fillable = [
        'negocio_id',
        'user_id',
        'domiciliario_id',
        'estado',
        'metodo_pago',
        'subtotal',
        'costo_domicilio',
        'total',
        'direccion_entrega',
        'entrega_lat',
        'entrega_lng',
        'telefono_contacto',
        'minutos_recogida',
        'minutos_preparacion',
        'aceptado_at',
        'codigo_confirmacion',
        'listo_at',
        'tomado_at',
        'recogido_at',
        'en_camino_at',
        'entregado_at',
        'novedad',
        'novedad_at',
        'dinero_estado',
        'dinero_confirmado_at',
        'cancelado_por',
        'motivo_cancelacion',
        'cancelado_at',
        'clave_intento',
        'llegada_at',
        'cliente_no_encontrado_at',
        'devuelto_at',
        'devolucion_confirmada_por',
        'faltante_motivo',
        'faltante_at',
        'faltante_version',
        'ajustado_at',
    ];

    /**
     * Punto de entrega en el mapa, si el cliente lo fijó en su dirección.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function puntoEntrega(): ?array
    {
        return $this->entrega_lat !== null && $this->entrega_lng !== null
            ? ['lat' => $this->entrega_lat, 'lng' => $this->entrega_lng]
            : null;
    }

    /** Lo que el negocio dice del dinero de un pedido en efectivo. */
    public const DINERO_ESTADOS = ['recibido', 'incompleto', 'no_recibido'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'costo_domicilio' => 'decimal:2',
            'total' => 'decimal:2',
            'cancelado_at' => 'datetime',
            'entrega_lat' => 'float',
            'entrega_lng' => 'float',
            'minutos_recogida' => 'integer',
            'minutos_preparacion' => 'integer',
            'aceptado_at' => 'datetime',
            'listo_at' => 'datetime',
            'tomado_at' => 'datetime',
            'recogido_at' => 'datetime',
            'en_camino_at' => 'datetime',
            'entregado_at' => 'datetime',
            'novedad_at' => 'datetime',
            'dinero_confirmado_at' => 'datetime',
            'llegada_at' => 'datetime',
            'cliente_no_encontrado_at' => 'datetime',
            'devuelto_at' => 'datetime',
            'faltante_at' => 'datetime',
            'ajustado_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Pedido $pedido) {
            $pedido->codigo ??= self::generarCodigoPedido();
        });
    }

    /** Código con el que las personas identifican el pedido: aleatorio y único. */
    public static function generarCodigoPedido(): string
    {
        do {
            $codigo = '';
            for ($i = 0; $i < self::LARGO_CODIGO; $i++) {
                $codigo .= self::ALFABETO_CODIGO[random_int(0, strlen(self::ALFABETO_CODIGO) - 1)];
            }
        } while (self::where('codigo', $codigo)->exists());

        return $codigo;
    }

    /**
     * Guarda un código de confirmación que ningún otro pedido esté usando.
     * $guardar recibe el código y lo escribe en `codigo_confirmacion`: si otro
     * pedido se quedó con el mismo en ese instante, el índice único lo rechaza
     * y se intenta con otro.
     */
    public static function conCodigoDeConfirmacion(callable $guardar): mixed
    {
        for ($intento = 1; ; $intento++) {
            try {
                return $guardar(self::codigoDeConfirmacionLibre());
            } catch (UniqueConstraintViolationException $e) {
                if ($intento === self::INTENTOS_CODIGO) {
                    throw $e;
                }
            }
        }
    }

    /** Un código de 4 dígitos al azar entre los que nadie tiene vigente. */
    private static function codigoDeConfirmacionLibre(): string
    {
        $vigentes = self::whereNotNull('codigo_confirmacion')->pluck('codigo_confirmacion')->all();
        $todos = array_map(fn (int $n) => sprintf('%04d', $n), range(0, 9999));
        $libres = array_values(array_diff($todos, $vigentes));

        if ($libres === []) {
            throw new RuntimeException('No quedan códigos de confirmación libres.');
        }

        return $libres[random_int(0, count($libres) - 1)];
    }

    /** Segundos que le quedan al negocio para aceptar antes de que venza. */
    public function segundosParaAceptar(): int
    {
        $limite = $this->created_at->copy()->addMinutes((int) config('reputacion.minutos_para_aceptar'));

        return (int) max(0, now()->diffInSeconds($limite, false));
    }

    /** Posición del estado actual dentro del flujo (para el stepper). */
    public function estadoIndex(): int
    {
        return array_search($this->estado, self::ESTADOS, true) ?: 0;
    }

    /** Etiqueta legible del estado actual. */
    public function estadoLabel(): string
    {
        return self::ESTADO_LABEL[$this->estado] ?? $this->estado;
    }

    public function segundosParaReportarAusencia(): ?int
    {
        if ($this->estado !== 'en_camino' || ! $this->llegada_at) {
            return null;
        }

        return max(0, $this->llegada_at->timestamp + 300 - now()->timestamp);
    }

    /**
     * ¿El cliente todavía puede calificar este pedido? Solo entregado, una
     * vez, y dentro de las horas que da `reputacion.horas_para_calificar`.
     */
    public function puedeCalificarse(): bool
    {
        if ($this->estado !== 'entregado' || $this->calificacion !== null) {
            return false;
        }

        $entregado = $this->entregado_at ?? $this->updated_at;

        // Si el negocio fue eliminado ya no hay a quién calificar.
        return $this->negocio_id !== null
            && $entregado->gte(now()->subHours((int) config('reputacion.horas_para_calificar')))
            && ! $this->esDelPropioEquipo();
    }

    /**
     * ¿Quien pidió hace parte del equipo del negocio? Puede comprar ahí, pero
     * su opinión no cuenta: ni califica ni reseña su propio negocio.
     */
    public function esDelPropioEquipo(): bool
    {
        return $this->negocio !== null
            && $this->negocio->miembrosActivos()->whereKey($this->user_id)->exists();
    }

    /**
     * ¿El cliente puede reseñar lo que compró? Solo si el pedido le llegó, y
     * dentro de `reputacion.dias_para_resenar`; hasta entonces puede corregirla.
     */
    public function puedeResenarse(): bool
    {
        if ($this->estado !== 'entregado') {
            return false;
        }

        if (in_array('no_llego', $this->calificacion?->domiciliario_problemas ?? [], true)) {
            return false;
        }

        $entregado = $this->entregado_at ?? $this->updated_at;

        return $this->negocio_id !== null
            && $entregado->gte(now()->subDays((int) config('reputacion.dias_para_resenar')))
            && ! $this->esDelPropioEquipo();
    }

    /**
     * ¿El negocio puede decir si recibió el dinero? Solo efectivo, con
     * domiciliario que ya recogió, una sola vez y dentro del plazo (así no se
     * acumulan pedidos viejos, ni los de antes de que existiera recogido_at).
     */
    public function puedeConfirmarDinero(): bool
    {
        return $this->metodo_pago === 'efectivo'
            && $this->domiciliario_id !== null
            && in_array($this->estado, ['recogido', 'en_camino', 'entregado'], true)
            && $this->dinero_estado === null
            && $this->recogido_at?->gte(now()->subHours((int) config('reputacion.horas_para_confirmar_dinero')));
    }

    /**
     * ¿El domiciliario le debe el dinero al negocio? Sí, hasta que el negocio
     * confirme que lo recibió completo, dentro del plazo para responder.
     */
    public function debeDineroAlNegocio(): bool
    {
        return $this->metodo_pago === 'efectivo'
            && $this->domiciliario_id !== null
            && $this->estado === 'entregado'
            && $this->dinero_estado !== 'recibido'
            && $this->recogido_at?->gte(now()->subHours((int) config('reputacion.horas_para_confirmar_dinero')));
    }

    /** ¿El negocio sigue viendo dónde está el domiciliario de este pedido? */
    public function negocioVeDomiciliario(): bool
    {
        return in_array($this->estado, self::EN_RUTA, true) || $this->debeDineroAlNegocio();
    }

    /**
     * Nombre del negocio para mostrar. Si el dueño lo eliminó, el pedido se
     * conserva en el historial con el nombre que tenía (`negocio_nombre`).
     */
    public function nombreNegocio(): ?string
    {
        return $this->negocio?->nombre ?? $this->negocio_nombre;
    }

    // ---------- Relaciones ----------

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /** El cliente que hizo el pedido. */
    public function cliente(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** El domiciliario que lo lleva (si ya fue tomado). */
    public function domiciliario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'domiciliario_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PedidoItem::class);
    }

    /** Lo que contestó el cliente al terminar (si ya calificó). */
    public function calificacion(): HasOne
    {
        return $this->hasOne(Calificacion::class);
    }

    /** Reseñas públicas que dejó el cliente de la tienda y los productos. */
    public function resenas(): HasMany
    {
        return $this->hasMany(Resena::class);
    }
}
