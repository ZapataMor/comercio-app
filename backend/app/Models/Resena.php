<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Reseña pública de una compra: estrellas de 1 a 5 y un comentario opcional,
 * sobre la tienda (`producto_id` null) o sobre un producto del pedido. Una por
 * cada cosa reseñada en cada pedido; se escriben con Support\Resenas::guardar.
 */
class Resena extends Model
{
    protected $table = 'resenas';

    protected $fillable = [
        'pedido_id',
        'user_id',
        'negocio_id',
        'producto_id',
        'objeto',
        'estrellas',
        'comentario',
    ];

    protected function casts(): array
    {
        return ['estrellas' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }
}
