<?php

namespace App\Models;

use App\Models\Concerns\Buscable;
use App\Support\Busqueda;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Categoría GLOBAL del catálogo (Comida, Comidas rápidas, Bebidas...). La crea
 * el administrador desde la web; el comerciante marca, si quiere, varias para
 * cada producto y el cliente filtra la búsqueda por ellas.
 *
 * No confundir con Categoria, que son las secciones del menú de UN negocio.
 */
class CategoriaCatalogo extends Model
{
    use Buscable;

    protected $table = 'categorias_catalogo';

    protected $fillable = [
        'nombre',
        'slug',
        'nombres_alternos',
        'activa',
        'orden',
    ];

    protected function casts(): array
    {
        return [
            'nombres_alternos' => 'array',
            'activa' => 'boolean',
            'orden' => 'integer',
        ];
    }

    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'categoria_catalogo_producto');
    }

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('activa', true);
    }

    /** Su nombre y sus otros nombres, para comparar con los tipos de negocio. */
    public function nombres(): array
    {
        return array_values(array_filter([$this->nombre, ...($this->nombres_alternos ?? [])]));
    }

    /**
     * Texto para la búsqueda tolerante a errores. Los otros nombres van en la
     * parte del nombre: «Barbería» coincide igual que «Belleza y aseo».
     */
    public function textoBusqueda(): string
    {
        return Busqueda::indexar(implode(' ', $this->nombres()));
    }
}
