<?php

namespace App\Models;

use App\Models\Concerns\Buscable;
use App\Support\Busqueda;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Casa en venta, casa en alquiler o patio para eventos que publica una
 * persona. El cliente la ve en la sección «Propiedades» y en su mapa.
 */
class Propiedad extends Model
{
    use Buscable;

    protected $table = 'propiedades';

    public const TIPOS = ['venta', 'alquiler', 'eventos'];

    /** Lo que se puede marcar de una casa (venta o alquiler). */
    public const CARACTERISTICAS_CASA = [
        'Parqueadero', 'Garaje', 'Patio', 'Terraza', 'Balcón', 'Cocina integral', 'Amoblada',
        'Aire acondicionado', 'Tanque de agua', 'Gas natural', 'Internet', 'Cuarto de servicio',
        'Rejas de seguridad', 'Conjunto cerrado', 'Mascotas permitidas',
    ];

    /** Lo que se puede marcar de un patio para eventos. */
    public const CARACTERISTICAS_EVENTOS = [
        'Mesas y sillas', 'Sonido', 'Iluminación', 'Kiosco o techo', 'Baños', 'Cocina',
        'Parqueadero', 'Piscina', 'Zona verde', 'Planta eléctrica', 'Aire acondicionado',
        'Zona infantil', 'Decoración', 'Meseros',
    ];

    protected $fillable = [
        'tipo', 'titulo', 'descripcion', 'precio', 'negociable', 'direccion', 'barrio', 'lat', 'lng',
        'habitaciones', 'banos', 'area_m2', 'estrato', 'capacidad', 'caracteristicas', 'condiciones',
        'contacto_nombre', 'contacto_telefono', 'disponible',
    ];

    protected $attributes = ['disponible' => true, 'negociable' => false];

    protected function casts(): array
    {
        return [
            'precio' => 'integer',
            'negociable' => 'boolean',
            'disponible' => 'boolean',
            'lat' => 'float',
            'lng' => 'float',
            'habitaciones' => 'integer',
            'banos' => 'integer',
            'area_m2' => 'integer',
            'estrato' => 'integer',
            'capacidad' => 'integer',
            'caracteristicas' => 'array',
            'galeria' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Las que ve el cliente: disponibles y de una cuenta activa. */
    public function scopePublicadas(Builder $q): Builder
    {
        return $q->where('propiedades.disponible', true)
            ->whereHas('user', fn ($u) => $u->whereNull('suspendido_at')->whereNull('eliminado_at'));
    }

    public function textoBusqueda(): string
    {
        $tipo = match ($this->tipo) {
            'venta' => 'casa venta vendo',
            'alquiler' => 'casa alquiler arriendo',
            'eventos' => 'patio eventos fiestas salon',
            default => '',
        };

        return Busqueda::indexar($this->titulo, [$tipo, $this->barrio, $this->direccion, $this->descripcion, $this->caracteristicas ?? []]);
    }
}
