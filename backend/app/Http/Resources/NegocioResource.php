<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NegocioResource extends JsonResource
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
            'categoria' => $this->categoria,
            'direccion' => $this->direccion,
            'telefono' => $this->telefono,
            'activo' => $this->activo,
            // Ruta relativa servida por el symlink storage (ej "/storage/negocios/x.jpg")
            // o null. La app le antepone la API_URL para formar la URL completa.
            'imagen' => $this->imagen ? '/storage/'.$this->imagen : null,
        ];
    }
}
