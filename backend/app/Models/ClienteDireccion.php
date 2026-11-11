<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'direccion', 'barrio', 'es_principal', 'nombre', 'lat', 'lng', 'fotos'])]
class ClienteDireccion extends Model
{
    use HasFactory;

    protected $table = 'cliente_direcciones';

    protected function casts(): array
    {
        return [
            'fotos' => 'array',
            'es_principal' => 'boolean',
            'lat' => 'float',
            'lng' => 'float',
        ];
    }

    /** ¿Tiene su punto puesto en el mapa? */
    public function tieneUbicacion(): bool
    {
        return $this->lat !== null && $this->lng !== null;
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
