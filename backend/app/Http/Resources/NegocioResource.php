<?php

namespace App\Http\Resources;

use App\Support\HorarioNegocio;
use App\Support\Reputacion;
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
        $categorias = $this->tiposNegocio
            ->pluck('nombre')
            ->values()
            ->all();

        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'categoria' => $categorias[0] ?? $this->categoria,
            'categorias' => $categorias,
            'direccion' => $this->direccion,
            'telefono' => $this->telefono,
            'activo' => $this->activo,
            // Ruta relativa servida por el symlink storage (ej "/storage/negocios/x.jpg")
            // o null. La app le antepone la API_URL para formar la URL completa.
            'imagen' => $this->imagen ? '/storage/'.$this->imagen : null,
            'tiempo_preparacion' => $this->tiempo_preparacion,
            // Horario semanal (lun..dom → {abre, cierra} | null) y el texto de hoy.
            'horario' => HorarioNegocio::normalizar($this->horario),
            'horario_hoy' => HorarioNegocio::textoHoy($this->horario, now()),
            'reputacion' => Reputacion::resumen(Reputacion::NEGOCIO, $this->resource),
        ];
    }
}
