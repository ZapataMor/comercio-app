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

    /**
     * En qué va un pago por transferencia: el cliente debe pagar (por_pagar),
     * avisó que pagó (informado), el negocio revisó que le llegó (confirmado)
     * o no lo encuentra (no_llego, el cliente puede volver a avisar).
     */
    public const PAGO_ESTADOS = ['por_pagar', 'informado', 'confirmado', 'no_llego'];

    /**
     * Devolución de una transferencia (ver Support\Reembolso): el cliente la
     * pide (solicitado), el negocio devuelve (devuelto) y el cliente confirma
     * (recibido) o dice que no le llegó (no_recibido, vuelve al negocio); o el
     * negocio dice que nunca recibió ese pago (rechazado).
     */
    public const REEMBOLSO_ESTADOS = ['solicitado', 'devuelto', 'recibido', 'no_recibido', 'rechazado'];

    /** Estados en los que el negocio todavía debe hacer algo. */
    public const REEMBOLSO_PENDIENTES = ['solicitado', 'no_recibido'];

    protected $fillable = [
        'negocio_id',
        'user_id',
        'domiciliario_id',
        'estado',
        'metodo_pago',
        'paga_con',
        'subtotal',
        'costo_domicilio',
        'total',
        'direccion_entrega',
        'entrega_indicaciones',
        'entrega_lat',
        'entrega_lng',
        'entrega_fotos',
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
        'efectivo_ocupado_at',
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
        'pago_estado',
        'pago_cuenta',
        'pago_comprobante',
        'pago_informado_at',
        'pago_confirmado_at',
        'pago_confirmado_por',
        'pago_no_llego_at',
        'domicilio_recibido',
        'domicilio_respondido_at',
        'reembolso_solicitado_at',
        'reembolso_estado',
        'reembolso_cuenta',
        'reembolso_monto',
        'reembolso_comprobante',
        'reembolso_devuelto_at',
        'reembolso_devuelto_por',
        'reembolso_motivo',
        'reembolso_rechazado_at',
        'reembolso_respondido_at',
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

    /**
     * El barrio de la entrega (lo que va tras « - Barrio » en la dirección):
     * se le muestra al domiciliario antes de tomar el pedido, sin la
     * dirección exacta, para que sepa hacia dónde queda.
     */
    public function barrioEntrega(): ?string
    {
        $pos = strrpos((string) $this->direccion_entrega, ' - Barrio ');
        if ($pos === false) {
            return null;
        }
        $barrio = trim(substr($this->direccion_entrega, $pos + strlen(' - Barrio ')));

        return $barrio === '' ? null : $barrio;
    }

    /** Lo que el negocio dice del dinero de un pedido en efectivo. */
    public const DINERO_ESTADOS = ['recibido', 'incompleto', 'no_recibido'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'costo_domicilio' => 'decimal:2',
            'total' => 'decimal:2',
            'paga_con' => 'decimal:2',
            'cancelado_at' => 'datetime',
            'entrega_lat' => 'float',
            'entrega_lng' => 'float',
            'entrega_fotos' => 'array',
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
            'efectivo_ocupado_at' => 'datetime',
            'llegada_at' => 'datetime',
            'cliente_no_encontrado_at' => 'datetime',
            'devuelto_at' => 'datetime',
            'faltante_at' => 'datetime',
            'ajustado_at' => 'datetime',
            'pago_cuenta' => 'array',
            'pago_informado_at' => 'datetime',
            'pago_confirmado_at' => 'datetime',
            'pago_no_llego_at' => 'datetime',
            'domicilio_recibido' => 'boolean',
            'domicilio_respondido_at' => 'datetime',
            'reembolso_solicitado_at' => 'datetime',
            'reembolso_monto' => 'decimal:2',
            'reembolso_devuelto_at' => 'datetime',
            'reembolso_rechazado_at' => 'datetime',
            'reembolso_respondido_at' => 'datetime',
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
        // Aceptado por transferencia: no se prepara hasta confirmar el pago.
        if ($this->estado === 'aceptado' && $this->esperaPago()) {
            return $this->pago_estado === 'informado' ? 'Pago por confirmar' : 'Esperando el pago';
        }

        return self::ESTADO_LABEL[$this->estado] ?? $this->estado;
    }

    // ---------- Pago por transferencia ----------

    /** ¿Es por transferencia y el negocio aún no confirma que le llegó? */
    public function esperaPago(): bool
    {
        return $this->metodo_pago === 'transferencia' && $this->pago_estado !== 'confirmado';
    }

    /**
     * ¿El cliente puede avisar que ya pagó? Cuando el negocio aceptó (antes
     * no ve las cuentas), sin un producto agotado por resolver (el total
     * podría cambiar) y si no lo había avisado o el negocio no lo encontró.
     */
    public function puedeInformarPago(): bool
    {
        return $this->metodo_pago === 'transferencia'
            && $this->estado === 'aceptado'
            && ! $this->faltante_motivo
            && in_array($this->pago_estado, ['por_pagar', 'no_llego'], true);
    }

    /**
     * ¿El negocio puede confirmar que le llegó la transferencia? Desde que
     * acepta: también si el cliente pagó sin avisar en la app.
     */
    public function puedeConfirmarPago(): bool
    {
        return $this->metodo_pago === 'transferencia'
            && $this->estado === 'aceptado'
            && $this->pago_estado !== 'confirmado';
    }

    /** Desde cuándo corre la preparación: por transferencia, desde que se confirmó el pago. */
    public function inicioPreparacion(): ?\Illuminate\Support\Carbon
    {
        return $this->metodo_pago === 'transferencia'
            ? ($this->pago_confirmado_at ?? $this->aceptado_at)
            : $this->aceptado_at;
    }

    /**
     * Lo que el domiciliario le cobra al cliente al entregar. Por
     * transferencia nada: solo llega a él con el pago ya confirmado.
     */
    public function aCobrar(): float
    {
        return $this->metodo_pago === 'efectivo' ? (float) $this->total : 0.0;
    }

    /**
     * Por transferencia el cliente le pagó el domicilio al negocio: el
     * negocio se lo entrega al domiciliario al recoger el pedido.
     */
    public function domicilioLoEntregaNegocio(): bool
    {
        return $this->metodo_pago === 'transferencia';
    }

    /** ¿El domiciliario debe decir, antes de salir, si le dieron el domicilio? */
    public function pideConfirmarDomicilio(): bool
    {
        return $this->domicilioLoEntregaNegocio() && (float) $this->costo_domicilio > 0;
    }

    /** El domiciliario dijo que el negocio no le dio el domicilio y aún no se lo paga. */
    public function negocioDebeDomicilio(): bool
    {
        return $this->pideConfirmarDomicilio() && $this->domicilio_recibido === false;
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
     * domiciliario que ya recogió. Una deuda de una entrega completada
     * siempre se puede liquidar, incluso después de un reporte negativo.
     */
    public function puedeConfirmarDinero(): bool
    {
        return $this->metodo_pago === 'efectivo'
            && $this->domiciliario_id !== null
            && in_array($this->estado, ['recogido', 'en_camino', 'entregado'], true)
            && ($this->efectivoPendienteAlNegocio() || ($this->dinero_estado === null
                && $this->recogido_at?->gte(now()->subHours((int) config('reputacion.horas_para_confirmar_dinero')))));
    }

    /**
     * ¿El domiciliario le debe el dinero al negocio? Sí, hasta que el negocio
     * confirme que lo recibió completo, dentro del plazo para responder.
     */
    public function debeDineroAlNegocio(): bool
    {
        return $this->efectivoPendienteAlNegocio()
            && $this->recogido_at?->gte(now()->subHours((int) config('reputacion.horas_para_confirmar_dinero')));
    }

    /** La deuda no vence; el plazo anterior solo limita el seguimiento GPS. */
    public function efectivoPendienteAlNegocio(): bool
    {
        return $this->metodo_pago === 'efectivo'
            && $this->domiciliario_id !== null
            && $this->estado === 'entregado'
            && $this->negocio_id !== null
            && $this->dinero_estado !== 'recibido';
    }

    public function scopeEfectivoPendiente($query)
    {
        return $query->where('metodo_pago', 'efectivo')->where('estado', 'entregado')
            ->whereNotNull('negocio_id')->whereNotNull('domiciliario_id')
            ->where(fn ($q) => $q->whereNull('dinero_estado')->orWhere('dinero_estado', '!=', 'recibido'));
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
