<?php

namespace App\Support;

use App\Models\Cita;
use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use App\Models\User;
use App\Notifications\InvitacionTrabajoRecibida;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Reglas del equipo de un negocio que comparten la app (Api\TrabajadorController)
 * y el panel web (Web\TrabajadoresController): buscar por el código público,
 * invitar y quitar. Cuando algo no se puede, lanza ErrorEquipo con el mensaje
 * y el código HTTP que devuelve la API.
 *
 * Nadie entra a un negocio solo con el código: se crea una invitación y la
 * persona la acepta desde su app.
 */
final class EquipoNegocio
{
    /** Busca por código EXACTO (acepta con o sin '#', en cualquier caja). */
    public static function porCodigo(string $codigo): ?User
    {
        $limpio = Str::of($codigo)->trim()->ltrim('#')->upper()->toString();

        return $limpio === '' ? null : User::where('codigo_publico', $limpio)->first();
    }

    /**
     * Invita por código. `$datos` trae los permisos de Vitrina y, desde la web,
     * la sede, el cargo, el horario y los permisos de módulos con los que
     * quedará la membresía al aceptar.
     */
    public static function invitar(Negocio $negocio, User $quien, string $codigo, array $datos): InvitacionTrabajo
    {
        $usuario = self::porCodigo($codigo);
        if (! $usuario) {
            throw new ErrorEquipo('No existe nadie con ese código.', 404);
        }
        if ($usuario->id === $quien->id) {
            throw new ErrorEquipo('Ese es tu propio código.', 422);
        }
        if ($negocio->miembros()->whereKey($usuario->id)->exists()) {
            throw new ErrorEquipo("{$usuario->nombre_completo} ya hace parte del negocio.", 409);
        }
        if ($negocio->invitaciones()->where('user_id', $usuario->id)->where('estado', InvitacionTrabajo::PENDIENTE)->exists()) {
            throw new ErrorEquipo("{$usuario->nombre_completo} ya tiene una invitación pendiente.", 409);
        }

        $invitacion = $negocio->invitaciones()->create([
            'user_id' => $usuario->id,
            'invitado_por' => $quien->id,
            'estado' => InvitacionTrabajo::PENDIENTE,
            ...$datos,
        ]);

        // El invitado decide: la invitación no lo vincula hasta que acepte.
        Push::enviar($usuario, new InvitacionTrabajoRecibida($invitacion));

        return $invitacion;
    }

    /**
     * Saca a alguien del negocio. Nunca a un propietario, ni a quien tenga
     * citas por atender. Sus tareas sin hacer se borran; las hechas quedan
     * en el historial hasta que se borre la cuenta.
     */
    public static function quitar(Negocio $negocio, int $userId, User $quien): void
    {
        DB::transaction(function () use ($negocio, $userId, $quien) {
            $negocio = Negocio::lockForUpdate()->findOrFail($negocio->id);
            if (! $negocio->administra($quien)) {
                throw new ErrorEquipo('Solo el propietario o un administrador pueden gestionar el equipo.', 403);
            }
            $miembro = $negocio->miembros()->whereKey($userId)->first();
            if (! $miembro) {
                throw new ErrorEquipo('Ese usuario no es miembro del negocio.', 404);
            }
            if ($miembro->pivot->rol === Negocio::ROL_PROPIETARIO) {
                throw new ErrorEquipo('No puedes quitar a un propietario.', 422);
            }
            self::exigirSinCitas($negocio, $userId);
            $negocio->miembros()->detach($userId);
            $negocio->tareas()->where('user_id', $userId)->where('estado', '!=', 'hecha')->delete();
        });
    }

    public static function exigirSinCitas(Negocio $negocio, int $userId): void
    {
        $tiene = Cita::where('negocio_id', $negocio->id)->where('profesional_id', $userId)
            ->whereIn('estado', ['pendiente', 'confirmada'])->where('fin', '>', now())->exists();
        if ($tiene) {
            throw new ErrorEquipo('Antes de quitar al trabajador, reasigna sus citas pendientes y confirmadas a otro trabajador desde la agenda. El cliente recibirá una notificación.', 409);
        }
    }
}
