<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Algo que subió o bajó el nivel de confiabilidad de un negocio o de un
 * domiciliario (ver App\Support\Reputacion). `tipo` dice a quién afecta y
 * `sujeto_id` es el id del negocio o del usuario domiciliario.
 */
class ReputacionEvento extends Model
{
    protected $table = 'reputacion_eventos';

    /** Quién originó el evento. */
    public const ORIGEN_SISTEMA = 'sistema'; // tiempos medidos por la app

    public const ORIGEN_CLIENTE = 'cliente';

    public const ORIGEN_NEGOCIO = 'negocio';

    public const ORIGEN_ADMIN = 'admin';

    protected $fillable = [
        'tipo',
        'sujeto_id',
        'pedido_id',
        'motivo',
        'puntos',
        'grave',
        'origen',
        'comentario',
        'anulado_at',
        'anulado_por',
    ];

    protected function casts(): array
    {
        return [
            'puntos' => 'integer',
            'grave' => 'boolean',
            'anulado_at' => 'datetime',
        ];
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }
}
