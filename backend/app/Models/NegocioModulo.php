<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Módulo opcional de Vitrina Gestión encendido (o apagado) para un negocio. */
class NegocioModulo extends Model
{
    protected $table = 'negocio_modulos';

    protected $fillable = ['modulo', 'activo', 'cambiado_por'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }
}
