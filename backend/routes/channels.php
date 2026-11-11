<?php

use App\Models\Negocio;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
 * Quién puede escuchar cada canal privado de los cambios en vivo (ver
 * App\Support\EnVivo). El canal «catalogo» es público y no pasa por aquí.
 * La app se autoriza en POST /api/broadcasting/auth con su token Sanctum.
 */

Broadcast::channel('usuario.{id}', fn (User $user, int $id) => $user->id === $id);

Broadcast::channel('negocio.{id}', fn (User $user, int $id) => (bool) Negocio::find($id)?->esMiembroActivo($user));

Broadcast::channel('domiciliarios', fn (User $user) => $user->hasRole('domiciliario'));

Broadcast::channel('admin', fn (User $user) => $user->hasRole('administrador'));
