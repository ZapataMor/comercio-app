<?php

namespace App\Models;

use App\Models\Concerns\Buscable;
use App\Support\Busqueda;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Servicio extends Model
{
    use Buscable;

    protected $fillable = ['nombre', 'descripcion', 'disponible', 'duracion_minutos', 'precio', 'permite_citas'];

    protected $attributes = ['disponible' => true, 'duracion_minutos' => 30, 'permite_citas' => true];

    protected function casts(): array
    {
        return ['disponible' => 'boolean', 'permite_citas' => 'boolean', 'duracion_minutos' => 'integer', 'precio' => 'integer', 'galeria' => 'array'];
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /** Texto para la búsqueda tolerante a errores. */
    public function textoBusqueda(): string
    {
        return Busqueda::indexar($this->nombre, [$this->descripcion]);
    }
}
