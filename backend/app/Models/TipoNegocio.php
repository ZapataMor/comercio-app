<?php

namespace App\Models;

use App\Models\Concerns\Buscable;
use App\Support\Busqueda;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TipoNegocio extends Model
{
    use Buscable;

    protected $table = 'tipos_negocio';

    protected $fillable = [
        'nombre',
        'slug',
    ];

    public function negocios(): BelongsToMany
    {
        return $this->belongsToMany(Negocio::class, 'negocio_tipo_negocio');
    }

    /** Texto para la búsqueda tolerante a errores. */
    public function textoBusqueda(): string
    {
        return Busqueda::indexar($this->nombre);
    }
}
