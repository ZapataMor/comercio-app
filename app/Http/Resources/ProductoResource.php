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
            'disponible' => $this->disponible,
            // Solo incluye la categoría si fue cargada (evita consultas N+1).
            'categoria' => new CategoriaResource($this->whenLoaded('categoria')),
        ];
    }
}
