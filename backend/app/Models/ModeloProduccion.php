<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Modelo de lo que hace el negocio (una reja, un portón, una hamburguesa)
 * con los materiales que gasta UNA unidad: una reja = 6 varillas y 1 galón
 * de pintura. Al empezar una producción con este modelo, esos materiales
 * aparecen ya puestos y se ajustan con − y +.
 *
 * al_pedido: no pasa por etapas; cuando un pedido de Vitrina de un producto
 * con este modelo queda listo, se descuentan sus materiales (restaurantes).
 */
class ModeloProduccion extends Model
{
    protected $table = 'modelos_produccion';

    protected $fillable = ['nombre', 'descripcion', 'al_pedido'];

    protected function casts(): array
    {
        return ['al_pedido' => 'boolean'];
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /** Lo que gasta una unidad, en la unidad del artículo. */
    public function materiales(): BelongsToMany
    {
        return $this->belongsToMany(InventarioArticulo::class, 'modelo_materiales', 'modelo_id', 'articulo_id')
            ->withPivot('cantidad')->withTimestamps()->orderBy('inventario_articulos.nombre');
    }

    /** Productos del catálogo que se hacen con este modelo. */
    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class, 'modelo_id');
    }

    public function producciones(): HasMany
    {
        return $this->hasMany(Produccion::class, 'modelo_id');
    }
}
