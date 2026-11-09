<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Servicio extends Model
{
    protected $fillable = ['nombre', 'descripcion', 'disponible'];

    protected $attributes = ['disponible' => true];

    protected function casts(): array
    {
        return ['disponible' => 'boolean'];
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }
}
