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
    protected $table = 'tipos_producto';

    protected $fillable = [
        'nombre',
        'slug',
        'atributo_label',
        'atributo_boton',
        'sugerencias',
        'orden',
    ];

    protected function casts(): array
    {
        return [
            'sugerencias' => 'array',
        ];
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class);
    }
}
