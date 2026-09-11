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

#[Fillable(['name', 'email', 'password', 'direccion', 'barrio', 'telefono'])]
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
     * Al crear un usuario se le asigna su código público único (ej. "U34F4D"):
     * lo comparte para que un negocio lo invite como trabajador. NUNCA se usa
     * para autenticación, solo para invitaciones.
     */
    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if (blank($user->codigo_publico)) {
                $user->codigo_publico = self::generarCodigoPublico();
            }
        });
    }

    /** Código de 6 caracteres sin ambiguos (sin 0/O ni 1/I/L), único. */
    public static function generarCodigoPublico(): string
    {
        $alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
        do {
            $codigo = 'U';
            for ($i = 0; $i < 5; $i++) {
                $codigo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
            }
        } while (self::where('codigo_publico', $codigo)->exists());

        return $codigo;
    }

    /**
     * El negocio del que este usuario es dueño "original" (negocios.user_id).
     * Se mantiene para el panel web legado; la app usa negocios() (membresías).
     */
    public function negocio(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Negocio::class);
    }

    /**
     * Negocios donde el usuario es miembro (propietario o trabajador).
     * El rol vive en la tabla pivote: una persona puede ser propietaria de un
     * negocio y trabajadora de otro a la vez.
     */
    public function negocios(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Negocio::class, 'negocio_user')
            ->withPivot(['rol', 'activo'])
            ->withTimestamps();
    }

    /** Solo las membresías activas (no suspendidas). */
    public function negociosActivos(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->negocios()->wherePivot('activo', true);
    }

    /** Invitaciones de trabajo que ha recibido este usuario. */
    public function invitacionesTrabajo(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(InvitacionTrabajo::class);
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

    /** Ubicaciones guardadas por el cliente para sus pedidos. */
    public function clienteDirecciones(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ClienteDireccion::class);
    }

    /** Pedidos que lleva como domiciliario. */
    public function entregas(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Pedido::class, 'domiciliario_id');
    }

    /** Dispositivos (tokens FCM) donde el usuario recibe notificaciones push. */
    public function deviceTokens(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    /**
     * Canal FCM: a qué token(s) enviar las notificaciones push de este usuario.
     * La librería laravel-notification-channels/fcm llama aquí.
     * Devolver un array envía a todos sus dispositivos (multicast).
     */
    public function routeNotificationForFcm(): array
    {
        return $this->deviceTokens()->pluck('token')->all();
    }
}
