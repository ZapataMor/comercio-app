<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TipoNegocio extends Model
{
    protected $table = 'tipos_negocio';

    protected $fillable = [
        'nombre',
        'slug',
    ];

    public function negocios(): BelongsToMany
    {
        return $this->belongsToMany(Negocio::class, 'negocio_tipo_negocio');
    }
}
