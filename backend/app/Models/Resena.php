<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        return [
            'estrellas' => 'integer',
            'oculta_at' => 'datetime',
            'respondida_at' => 'datetime',
        ];
    }

    /** Las que se muestran y cuentan en el promedio. */
    public function scopeVisibles(Builder $query): Builder
    {
        return $query->whereNull('oculta_at');
    }

    /** Publicadas y con reportes que el admin no ha atendido. */
    public function scopeReportadas(Builder $query): Builder
    {
        return $query->visibles()->whereHas('reportesPendientes');
    }

    public function reportes(): HasMany
    {
        return $this->hasMany(ResenaReporte::class);
    }

    public function reportesPendientes(): HasMany
    {
        return $this->reportes()->whereNull('resuelto_at');
    }

    public function moderaciones(): HasMany
    {
        return $this->hasMany(ResenaModeracion::class)->latest()->latest('id');
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
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
