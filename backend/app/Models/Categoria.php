<?php

namespace App\Models;

use App\Models\Concerns\Buscable;
use App\Support\Busqueda;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Categoria extends Model
{
    use Buscable;

    protected $table = 'categorias';

    protected $fillable = [
        'nombre',
    ];

    /**
     * El negocio dueño de la categoría.
     */
    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /**
     * Productos dentro de esta categoría.
     */
    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class);
    }

    /** Texto para la búsqueda tolerante a errores. */
    public function textoBusqueda(): string
    {
        return Busqueda::indexar($this->nombre);
    }
}
