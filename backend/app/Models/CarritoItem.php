<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarritoItem extends Model
{
    protected $table = 'carrito_items';

    protected $fillable = [
        'user_id',
        'producto_id',
        'cantidad',
    ];

    protected function casts(): array
    {
        return [
            'cantidad' => 'integer',
        ];
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /** Subtotal de la línea según el precio ACTUAL del producto. */
    public function subtotal(): float
    {
        return (float) ($this->producto->precio ?? 0) * $this->cantidad;
    }
}
