<?php

namespace App\Http\Resources;

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
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
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
            // Solo incluye la categoría si fue cargada (evita consultas N+1).
            'categoria' => new CategoriaResource($this->whenLoaded('categoria')),
            // Negocio que vende el producto: solo se incluye cuando se cargó la
            // relación (p. ej. en la búsqueda de productos del cliente), para
            // no afectar a los endpoints del comerciante que no lo necesitan.
            'negocio' => $this->whenLoaded('negocio', fn () => [
                'id' => $this->negocio->id,
                'nombre' => $this->negocio->nombre,
                'abierto' => (bool) $this->negocio->activo,
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
