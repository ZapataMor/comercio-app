<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Invitación de un negocio a una persona para unirse como trabajador.
 *
 * Flujo: el trabajador comparte su código público fuera de la app → el
 * propietario lo ingresa → se crea la invitación 'pendiente' y se le avisa
 * por push al invitado → solo al ACEPTAR se crea la membresía. El código por
 * sí solo nunca agrega a nadie a un negocio.
 */
class InvitacionTrabajo extends Model
{
    protected $table = 'invitaciones_trabajo';

    public const PENDIENTE = 'pendiente';

    public const ACEPTADA = 'aceptada';

    public const RECHAZADA = 'rechazada';

    protected $fillable = ['negocio_id', 'user_id', 'invitado_por', 'estado'];

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /** La persona invitada. */
    public function invitado(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Quién envió la invitación. */
    public function invitadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invitado_por');
    }
}
