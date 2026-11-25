<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sede de un negocio con Vitrina Gestión: punto de venta, fábrica, bodega u
 * oficina. Todo negocio con panel web tiene al menos la sede principal; tener
 * más de una exige el módulo «sedes».
 */
class Sede extends Model
{
    protected $table = 'sedes';

    public const TIPOS = [
        'punto_venta' => 'Punto de venta',
        'fabrica' => 'Fábrica',
        'bodega' => 'Bodega',
        'oficina' => 'Oficina',
    ];

    protected $fillable = ['nombre', 'tipo', 'direccion', 'barrio', 'telefono', 'factura', 'principal', 'activa'];

    protected $attributes = ['tipo' => 'punto_venta', 'factura' => true, 'principal' => false, 'activa' => true];

    protected function casts(): array
    {
        return [
            'factura' => 'boolean',
            'principal' => 'boolean',
            'activa' => 'boolean',
        ];
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    public function tipoTexto(): string
    {
        return self::TIPOS[$this->tipo] ?? $this->tipo;
    }
}
