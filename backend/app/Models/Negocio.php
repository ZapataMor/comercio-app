<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Negocio extends Model
{
    protected $table = 'negocios';

    /** Valores por defecto a nivel de modelo (coinciden con la migración). */
    protected $attributes = [
        'activo' => true,
    ];

    protected $fillable = [
        'nombre',
        'descripcion',
        'categoria',
        'direccion',
        'telefono',
        'activo',
    ];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
        ];
    }

    /** Roles posibles de un miembro dentro del negocio. */
    public const ROL_PROPIETARIO = 'propietario';

    public const ROL_TRABAJADOR = 'trabajador';

    /**
     * Al crear un negocio, su creador (user_id) queda automáticamente como
     * miembro 'propietario'. Cubre también seeders y código legado que crean
     * negocios con $user->negocio()->create(...).
     */
    protected static function booted(): void
    {
        static::created(function (Negocio $negocio) {
            $negocio->miembros()->syncWithoutDetaching([
                $negocio->user_id => ['rol' => self::ROL_PROPIETARIO, 'activo' => true],
            ]);
        });
    }

    /**
     * El dueño "original" del negocio (quien lo creó). Las autorizaciones se
     * hacen contra miembros(); esto queda para auditoría y compatibilidad.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Miembros del negocio (propietarios y trabajadores) con su rol. */
    public function miembros(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'negocio_user')
            ->withPivot(['rol', 'activo'])
            ->withTimestamps();
    }

    /** Solo miembros activos (los que reciben pedidos y administran). */
    public function miembrosActivos(): BelongsToMany
    {
        return $this->miembros()->wherePivot('activo', true);
    }

    /** ¿Este usuario es miembro ACTIVO del negocio (cualquier rol)? */
    public function esMiembroActivo(User $user): bool
    {
        return $this->miembrosActivos()->whereKey($user->id)->exists();
    }

    /** ¿Este usuario es propietario activo del negocio? */
    public function esPropietario(User $user): bool
    {
        return $this->miembrosActivos()
            ->wherePivot('rol', self::ROL_PROPIETARIO)
            ->whereKey($user->id)
            ->exists();
    }

    /** Invitaciones de trabajo enviadas por este negocio. */
    public function invitaciones(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(InvitacionTrabajo::class);
    }

    /**
     * Los productos del catálogo de este negocio.
     */
    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class);
    }

    /**
     * Las categorías del catálogo de este negocio.
     */
    public function categorias(): HasMany
    {
        return $this->hasMany(Categoria::class);
    }

    /**
     * Tipos del negocio para busqueda y filtros: panaderia, ferreteria, etc.
     */
    public function tiposNegocio(): BelongsToMany
    {
        return $this->belongsToMany(TipoNegocio::class, 'negocio_tipo_negocio');
    }

    /** Pedidos recibidos por este negocio. */
    public function pedidos(): HasMany
    {
        return $this->hasMany(Pedido::class);
    }
}
