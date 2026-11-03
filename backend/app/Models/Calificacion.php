<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Lo que contestó el cliente al terminar un pedido: si el negocio cumplió y,
 * si no, qué falló; las caritas (1 a 5) que le dio al domiciliario y si
 * reportó algo grave de él (claves de App\Support\Reputacion::PROBLEMAS_CLIENTE).
 * Una por pedido.
 */
class Calificacion extends Model
{
    protected $table = 'calificaciones';

    protected $fillable = [
        'pedido_id',
        'user_id',
        'negocio_ok',
        'negocio_problemas',
        'domiciliario_ok',
        'domiciliario_caritas',
        'domiciliario_problemas',
        'comentario',
    ];

    protected function casts(): array
    {
        return [
            'negocio_ok' => 'boolean',
            'negocio_problemas' => 'array',
            'domiciliario_ok' => 'boolean',
            'domiciliario_caritas' => 'array',
            'domiciliario_problemas' => 'array',
        ];
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }
}
