<?php

namespace App\Http\Resources;

use App\Support\HorarioNegocio;
use App\Support\PrecioCarrito;
use App\Support\Resenas;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductoResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return PrecioCarrito::cotizar($this->resource, $request->user()?->id) + [
            'id' => $this->id,
            'nombre' => $this->nombre,
            // Otros nombres con que lo buscan («bolígrafo» para un lapicero).
            'nombres_alternos' => $this->nombres_alternos ?? [],
            'descripcion' => $this->descripcion,
            // El cast decimal:2 devuelve string "2500.00"; lo damos como número.
            'precio' => (float) $this->precio,
            // Cómo se vende y a qué se refiere el precio.
            'tipo_venta' => $this->tipo_venta,
            'unidad_medida' => $this->unidad_medida,
            // Precio listo para mostrar, ej: "$2.500 c/u" o "$8.900 / kg".
            'precio_formateado' => $this->precioFormateado(),
            // Ruta relativa (ej "/storage/productos/x.jpg") o null; la app le antepone la API_URL.
            'imagen' => $this->imagen ? '/storage/'.$this->imagen : null,
            'disponible' => $this->disponible,
            'resenas' => Resenas::resumen($this->resource),
            // Ingredientes, usos, tallas... según el tipo de producto.
            'atributos' => $this->atributos ?? [],
            // Solo ropa y calzado: ahí `atributos` son las tallas.
            'colores' => $this->colores ?? [],
            // Solo comida: ingredientes que el cliente no puede quitar y extras
            // que pide aparte, cada uno con su precio por porción.
            'ingredientes_fijos' => $this->ingredientes_fijos ?? [],
            'extras' => collect($this->extras ?? [])
                ->map(fn ($e) => ['nombre' => $e['nombre'], 'precio' => (float) ($e['precio'] ?? 0)])
                ->values()->all(),
            // Solo incluye la categoría si fue cargada (evita consultas N+1).
            'categoria' => new CategoriaResource($this->whenLoaded('categoria')),
            // Categorías globales (Comida, Bebidas...), si se cargaron.
            'categorias_catalogo' => $this->whenLoaded('categoriasCatalogo', fn () => $this->categoriasCatalogo
                ->map(fn ($c) => ['id' => $c->id, 'nombre' => $c->nombre])->values()->all()),
            // Tipo global (Comida, Medicamento...); null en productos antiguos.
            'tipo_producto' => $this->whenLoaded('tipoProducto', fn () => $this->tipoProducto ? [
                'id' => $this->tipoProducto->id,
                'nombre' => $this->tipoProducto->nombre,
                'slug' => $this->tipoProducto->slug,
                'atributo_label' => $this->tipoProducto->atributo_label,
            ] : null),
            // Negocio que vende el producto: solo se incluye cuando se cargó la
            // relación (p. ej. en la búsqueda de productos del cliente), para
            // no afectar a los endpoints del comerciante que no lo necesitan.
            'negocio' => $this->whenLoaded('negocio', fn () => [
                'id' => $this->negocio->id,
                'nombre' => $this->negocio->nombre,
                'abierto' => (bool) $this->negocio->activo,
                'estado_texto' => HorarioNegocio::estadoTexto($this->negocio),
            ]),
        ];
    }

    /**
     * Precio formateado en pesos colombianos con su unidad.
     * Ej: "$2.500 c/u", "$8.900 / kg", "$15.000 / litro".
     */
    private function precioFormateado(): string
    {
        $precio = '$'.number_format((float) $this->precio, 0, ',', '.');

        return $this->unidad_medida === 'unidad'
            ? "$precio c/u"
            : "$precio / {$this->unidad_medida}";
    }
}
