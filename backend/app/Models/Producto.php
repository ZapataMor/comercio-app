<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Producto extends Model
{
    use SoftDeletes;

    protected $table = 'productos';

    protected static function booted(): void
    {
        static::saving(function (Producto $producto) {
            if ((float) $producto->precio <= 0) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'precio' => 'El precio del producto debe ser mayor que 0 pesos.',
                ]);
            }
        });
    }

    /** Valores por defecto a nivel de modelo (coinciden con la migración). */
    protected $attributes = [
        'disponible' => true,
        'tipo_venta' => 'cantidad',
        'unidad_medida' => 'unidad',
    ];

    protected $fillable = [
        'nombre',
        'descripcion',
        'precio',
        'tipo_venta',
        'unidad_medida',
        'disponible',
        'categoria_id',
        'tipo_producto_id',
        'atributos',
        'colores',
    ];

    /** Tipos de venta válidos (cómo se selecciona la cantidad del producto). */
    public const TIPOS_VENTA = ['cantidad', 'peso', 'volumen', 'longitud'];

    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'disponible' => 'boolean',
            'atributos' => 'array',
            'colores' => 'array',
            'resenas_total' => 'integer',
        ];
    }

    /**
     * El negocio al que pertenece el producto.
     */
    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /**
     * Categoría del producto (puede ser null: sin categoría).
     */
    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class);
    }

    /**
     * Tipo global del producto (Comida, Medicamento...). Null solo en
     * productos creados antes de existir esta función.
     */
    public function tipoProducto(): BelongsTo
    {
        return $this->belongsTo(TipoProducto::class);
    }
}
