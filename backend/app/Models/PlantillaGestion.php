<?php

namespace App\Models;

use App\Gestion\Modulos;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Plantilla de Vitrina Gestión para un tipo de negocio: qué módulos
 * opcionales enciende y qué campos lleva la ficha técnica de sus productos.
 * La crea y la edita el super administrador desde /admin/gestion.
 */
class PlantillaGestion extends Model
{
    protected $table = 'plantillas_gestion';

    /** Tipos de campo de la ficha técnica. */
    public const TIPOS_CAMPO = [
        'texto' => 'Texto',
        'numero' => 'Número',
        'opciones' => 'Lista de opciones',
        'si_no' => 'Sí o no',
    ];

    protected $fillable = ['nombre', 'slug', 'descripcion', 'modulos', 'campos_producto', 'tipos_negocio', 'activa'];

    protected $attributes = ['modulos' => '[]', 'campos_producto' => '[]', 'activa' => true];

    protected function casts(): array
    {
        return [
            'modulos' => 'array',
            'campos_producto' => 'array',
            'tipos_negocio' => 'array',
            'activa' => 'boolean',
        ];
    }

    public function negocios(): HasMany
    {
        return $this->hasMany(Negocio::class, 'plantilla_gestion_id');
    }

    /** Los módulos de la plantilla con sus dependencias. @return string[] */
    public function modulosCompletos(): array
    {
        $todos = [];
        foreach ($this->modulos ?? [] as $clave) {
            if (Modulos::existe($clave) && ! Modulos::esNucleo($clave)) {
                $todos = [...$todos, ...Modulos::conDependencias($clave)];
            }
        }

        return array_values(array_unique($todos));
    }
}
