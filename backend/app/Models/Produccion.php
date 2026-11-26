<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Una vez que se hizo un producto del catálogo: a mano («Registrar como
 * hecho») o porque un pedido de Vitrina quedó listo. Sus salidas de
 * inventario están en movimientos(); si se anula, se devuelven.
 */
class Produccion extends Model
{
    protected $table = 'producciones';

    public const ORIGENES = ['manual' => 'Registrada a mano', 'pedido' => 'Por un pedido'];

    protected $fillable = ['producto_id', 'nombre', 'cantidad', 'origen', 'pedido_id', 'user_id', 'nota', 'faltantes', 'costo'];

    protected function casts(): array
    {
        return [
            'cantidad' => 'float',
            'faltantes' => 'array',
            'costo' => 'integer',
            'anulada_at' => 'datetime',
        ];
    }

    protected function asJson($value, $flags = 0)
    {
        return parent::asJson($value, $flags | JSON_UNESCAPED_UNICODE);
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class)->withTrashed();
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(InventarioMovimiento::class);
    }

    public function anulada(): bool
    {
        return $this->anulada_at !== null;
    }
}
