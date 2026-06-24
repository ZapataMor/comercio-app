<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pedido extends Model
{
    protected $table = 'pedidos';

    /**
     * Estados del pedido, EN ORDEN (sirve también para el "stepper" de avance).
     */
    public const ESTADOS = ['pendiente', 'listo', 'tomado', 'recogido', 'en_camino', 'entregado'];

    /** Etiquetas legibles de cada estado. */
    public const ESTADO_LABEL = [
        'pendiente' => 'Pendiente',
        'listo' => 'Listo para recoger',
        'tomado' => 'Domiciliario asignado',
        'recogido' => 'Recogido',
        'en_camino' => 'En camino',
        'entregado' => 'Entregado',
    ];

    /** Formas de pago admitidas. */
    public const METODOS_PAGO = ['efectivo', 'transferencia'];

    protected $fillable = [
        'negocio_id',
        'user_id',
        'domiciliario_id',
        'estado',
        'metodo_pago',
        'total',
        'direccion_entrega',
        'telefono_contacto',
        'minutos_recogida',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
            'minutos_recogida' => 'integer',
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
}
