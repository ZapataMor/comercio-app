<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tipo GLOBAL de producto (Comida, Medicamento, Herramienta...). Pre-creado
 * por la app: define qué atributos pide el formulario al crear un producto
 * (ingredientes, usos, tallas...) y qué sugerencias se ofrecen.
 */
class TipoProducto extends Model
{
    /** En la comida el cliente quita ingredientes o pide más de los que trae. */
    public const SLUG_COMIDA = 'comida';

    /** En la ropa y el calzado el cliente elige talla y color. */
    public const SLUG_ROPA = 'ropa-y-calzado';

    protected $table = 'tipos_producto';

    protected $fillable = [
        'nombre',
        'slug',
        'atributo_label',
        'atributo_boton',
        'sugerencias',
        'sugerencias_colores',
        'orden',
    ];

    protected function casts(): array
    {
        return [
            'sugerencias' => 'array',
            'sugerencias_colores' => 'array',
        ];
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class);
    }
}
