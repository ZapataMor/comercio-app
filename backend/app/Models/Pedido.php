<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Pedido extends Model
{
    protected $table = 'pedidos';

    /**
     * Estados del pedido, EN ORDEN (sirve también para el "stepper" de avance).
     * 'cancelado' queda fuera: es un final alternativo (ver CancelarPedido).
     */
    public const ESTADOS = ['pendiente', 'listo', 'tomado', 'recogido', 'en_camino', 'entregado'];

    /** Estados con un domiciliario llevando el pedido. */
    public const EN_RUTA = ['tomado', 'recogido', 'en_camino'];

    /** Estados en los que el pedido sigue vivo (ni entregado ni cancelado). */
    public const EN_CURSO = ['pendiente', 'listo', 'tomado', 'recogido', 'en_camino'];

    /** Etiquetas legibles de cada estado. */
    public const ESTADO_LABEL = [
        'pendiente' => 'Pendiente',
        'listo' => 'Listo para recoger',
        'tomado' => 'Domiciliario asignado',
        'recogido' => 'Recogido',
        'en_camino' => 'En camino',
        'entregado' => 'Entregado',
        'cancelado' => 'Cancelado',
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
        'telefono_contacto',
        'minutos_recogida',
        'minutos_preparacion',
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
    ];

    /** Lo que el negocio dice del dinero de un pedido en efectivo. */
    public const DINERO_ESTADOS = ['recibido', 'incompleto', 'no_recibido'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'costo_domicilio' => 'decimal:2',
            'total' => 'decimal:2',
            'cancelado_at' => 'datetime',
            'minutos_recogida' => 'integer',
            'minutos_preparacion' => 'integer',
            'listo_at' => 'datetime',
            'tomado_at' => 'datetime',
            'recogido_at' => 'datetime',
            'en_camino_at' => 'datetime',
            'entregado_at' => 'datetime',
            'novedad_at' => 'datetime',
            'dinero_confirmado_at' => 'datetime',
        ];
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

        return $entregado->gte(now()->subHours((int) config('reputacion.horas_para_calificar')));
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
}
