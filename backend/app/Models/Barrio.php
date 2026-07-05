<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['nombre', 'aprobado', 'creado_por'])]
class Barrio extends Model
{
    protected function casts(): array
    {
        return [
            'aprobado' => 'boolean',
        ];
    }

    public function scopeAprobados(Builder $query): Builder
    {
        return $query->where('aprobado', true);
    }

    public function creador(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    /**
     * Si el barrio escrito por el cliente no existe en el catálogo (comparando
     * sin mayúsculas/minúsculas), lo registra como pendiente de aprobación.
     * El cliente puede pedir con ese nombre; solo entra a la lista pública
     * cuando el administrador lo aprueba.
     */
    public static function registrarSiEsNuevo(string $nombre, ?int $userId = null): void
    {
        $nombre = trim($nombre);
        if ($nombre === '') {
            return;
        }

        $existe = static::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->exists();
        if (! $existe) {
            static::create([
                'nombre' => $nombre,
                'aprobado' => false,
                'creado_por' => $userId,
            ]);
        }
    }
}
