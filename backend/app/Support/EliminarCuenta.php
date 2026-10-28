<?php

namespace App\Support;

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Eliminación de la cuenta a pedido de la persona (Play Store y Ley 1581).
 *
 * La fila de `users` NO se borra: los pedidos del historial de los negocios
 * y domiciliarios apuntan a ella. En su lugar se ANONIMIZA (nombre, correo,
 * teléfono, dirección) y se borra todo lo demás que la identifica: sesiones,
 * aparatos, direcciones guardadas, membresías e invitaciones.
 *
 * Los negocios donde era el ÚNICO propietario se cierran y se archivan (dejan
 * de verse en el catálogo); su historial de pedidos se conserva.
 */
class EliminarCuenta
{
    /** Estados en los que un pedido todavía está en curso. */
    private const EN_CURSO = Pedido::EN_CURSO;

    /** Motivo por el que aún no se puede eliminar, o null si se puede. */
    public static function bloqueo(User $user): ?string
    {
        if ($user->pedidos()->whereIn('estado', self::EN_CURSO)->exists()) {
            return 'Tienes pedidos en curso. Espera a que se entreguen (o cancélalos) para eliminar tu cuenta.';
        }

        if ($user->entregas()->whereIn('estado', self::EN_CURSO)->exists()) {
            return 'Tienes entregas en curso. Termínalas antes de eliminar tu cuenta.';
        }

        return null;
    }

    public static function ejecutar(User $user): void
    {
        DB::transaction(function () use ($user) {
            // Negocios que quedarían sin ningún propietario activo.
            $negocios = $user->negociosActivos()
                ->wherePivot('rol', Negocio::ROL_PROPIETARIO)
                ->get();

            foreach ($negocios as $negocio) {
                $otrosPropietarios = $negocio->miembrosActivos()
                    ->wherePivot('rol', Negocio::ROL_PROPIETARIO)
                    ->where('users.id', '!=', $user->id)
                    ->exists();

                if (! $otrosPropietarios) {
                    $negocio->forceFill(['activo' => false, 'archivado_at' => now()])->save();
                }
            }

            $user->negocios()->detach();
            $user->invitacionesTrabajo()->delete();
            $user->clienteDirecciones()->delete();
            $user->deviceTokens()->delete();
            $user->tokens()->delete();

            // Los pedidos terminados se conservan para el negocio, sin los
            // datos de contacto de la persona.
            $user->pedidos()->update([
                'direccion_entrega' => 'Dirección eliminada',
                'telefono_contacto' => '',
            ]);

            $user->forceFill([
                'name' => 'Usuario',
                'apellidos' => 'eliminado',
                'email' => "eliminado-{$user->id}@vitrina.invalid",
                'password' => Str::random(64),
                'direccion' => null,
                'barrio' => null,
                'telefono' => null,
                'codigo_publico' => null,
                'remember_token' => null,
                'eliminado_at' => now(),
            ])->save();

            $user->syncRoles([]);
        });
    }
}
