<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * El negocio del usuario (cuando es comerciante).
     */
    public function negocio(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Negocio::class);
    }

    /** Ítems en el carrito de compras (cuando es cliente). */
    public function carritoItems(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CarritoItem::class);
    }

    /** Pedidos que ha hecho como cliente. */
    public function pedidos(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Pedido::class, 'user_id');
    }

    /** Pedidos que lleva como domiciliario. */
    public function entregas(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Pedido::class, 'domiciliario_id');
    }
}
