<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedidoItem extends Model
{
    protected $table = 'pedido_items';

    protected $fillable = [
        'producto_id',
        'nombre',
        'precio',
        'cantidad',
    ];

    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'cantidad' => 'integer',
        ];
    }

    /** Subtotal de la línea (precio copiado × cantidad). */
    public function subtotal(): float
    {
        return (float) $this->precio * $this->cantidad;
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
