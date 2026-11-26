<?php

namespace App\Models;

use App\Models\Concerns\Buscable;
use App\Support\Busqueda;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Producto extends Model
{
    use Buscable, SoftDeletes;

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
        'nombres_alternos',
        'descripcion',
        'precio',
        'tipo_venta',
        'unidad_medida',
        'disponible',
        'categoria_id',
        'tipo_producto_id',
        'atributos',
        'colores',
        'ingredientes_fijos',
        'extras',
    ];

    /** Tipos de venta válidos (cómo se selecciona la cantidad del producto). */
    public const TIPOS_VENTA = ['cantidad', 'peso', 'volumen', 'longitud'];

    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'disponible' => 'boolean',
            'nombres_alternos' => 'array',
            'atributos' => 'array',
            'colores' => 'array',
            'ingredientes_fijos' => 'array',
            'extras' => 'array',
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

    /**
     * Categorías globales del catálogo (Comida, Bebidas...). Opcionales y
     * pueden ser varias.
     */
    public function categoriasCatalogo(): BelongsToMany
    {
        return $this->belongsToMany(CategoriaCatalogo::class, 'categoria_catalogo_producto');
    }

    /**
     * Lo que gasta una unidad del producto (módulo «produccion»): artículos
     * del inventario con la cantidad en su unidad. materiales_al dice si se
     * descuentan al registrar que se hizo («fabricar») o con cada pedido.
     */
    public function materiales(): BelongsToMany
    {
        return $this->belongsToMany(InventarioArticulo::class, 'producto_materiales', 'producto_id', 'articulo_id')
            ->withPivot('cantidad')->withTimestamps()->orderBy('inventario_articulos.nombre');
    }

    /**
     * Texto para la búsqueda tolerante a errores. Los otros nombres
     * («bolígrafo» para un lapicero) cuentan como el nombre.
     */
    public function textoBusqueda(): string
    {
        return Busqueda::indexar(
            implode(' ', [$this->nombre, ...($this->nombres_alternos ?? [])]),
            [$this->descripcion, $this->atributos ?? []],
        );
    }
}
