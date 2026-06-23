<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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

    /**
     * El comerciante dueño del negocio.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
}
