<?php

namespace App\Support;

use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Support\Collection;
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

        // Negocios que se archivarían con la cuenta: sus pedidos vivos se
        // quedarían sin nadie que los atienda.
        $conPedidos = $user->negociosActivos()->wherePivot('rol', Negocio::ROL_PROPIETARIO)->get()
            ->first(fn (Negocio $n) => $n->pedidos()->whereIn('estado', self::EN_CURSO)->exists());
        if ($conPedidos) {
            return "{$conPedidos->nombre} tiene pedidos en curso. Termínalos o cancélalos antes de eliminar tu cuenta.";
        }

        $seArchivan = self::negociosQueSeArchivan($user)->pluck('id');
        if (Cita::where('profesional_id', $user->id)->whereNotIn('negocio_id', $seArchivan)
            ->whereIn('estado', ['pendiente', 'confirmada'])->where('fin', '>', now())->exists()) {
            return 'Tienes citas por atender. Pide al propietario que las reasigne antes de eliminar tu cuenta.';
        }

        return null;
    }

    /**
     * Negocios donde la persona es el único propietario activo.
     *
     * @return Collection<int, Negocio>
     */
    private static function negociosQueSeArchivan(User $user): Collection
    {
        return $user->negociosActivos()
            ->wherePivot('rol', Negocio::ROL_PROPIETARIO)
            ->get()
            ->reject(fn (Negocio $negocio) => $negocio->miembrosActivos()
                ->wherePivot('rol', Negocio::ROL_PROPIETARIO)
                ->where('users.id', '!=', $user->id)
                ->exists())
            ->values();
    }

    public static function ejecutar(User $user): void
    {
        DB::transaction(function () use ($user) {
            Negocio::whereIn('id', $user->negociosActivos()->pluck('negocios.id'))->orderBy('id')->lockForUpdate()->get();
            $user = User::lockForUpdate()->findOrFail($user->id);
            abort_if($motivo = self::bloqueo($user), 409, $motivo ?? 'Cuenta con operaciones en curso.');
            // Negocios que quedarían sin ningún propietario activo: se archivan
            // y sus citas futuras se cancelan avisando a cada cliente.
            foreach (self::negociosQueSeArchivan($user) as $negocio) {
                $negocio->forceFill(['activo' => false, 'archivado_at' => now()])->save();
                AgendaCitas::cancelarFuturas(Cita::where('negocio_id', $negocio->id), 'El negocio cerró.');
            }

            // En los negocios que siguen, ya no atiende: sus citas se cancelan.
            AgendaCitas::cancelarFuturas(
                Cita::where('profesional_id', $user->id),
                'El profesional ya no atiende en este negocio. Agenda de nuevo con otra persona.',
            );
            // Las que pidió como cliente se liberan, y de todas se borran sus datos.
            AgendaCitas::cancelarFuturas(Cita::where('cliente_id', $user->id), 'El cliente eliminó su cuenta.', alNegocio: true);
            Cita::where('cliente_id', $user->id)->update(['cliente_nombre' => 'Usuario eliminado', 'cliente_telefono' => null]);

            $user->negocios()->detach();
            $user->invitacionesTrabajo()->delete();
            $user->clienteDirecciones()->delete();
            $user->deviceTokens()->delete();
            $user->tokens()->delete();
            \App\Models\CodigoTelefono::where('user_id', $user->id)->delete();

            // Los pedidos terminados se conservan para el negocio, sin los
            // datos de contacto de la persona.
            $user->pedidos()->update([
                'direccion_entrega' => 'Dirección eliminada',
                'telefono_contacto' => '',
            ]);

            // Las estrellas siguen contando en el promedio, sin lo que escribió.
            $user->resenas()->update(['comentario' => null]);

            $user->forceFill([
                'name' => 'Usuario',
                'username' => null,
                'apellidos' => 'eliminado',
                'email' => "eliminado-{$user->id}@vitrina.invalid",
                'password' => Str::random(64),
                'direccion' => null,
                'barrio' => null,
                'telefono' => null,
                'telefono_verificado_at' => null,
                'codigo_publico' => null,
                'remember_token' => null,
                'eliminado_at' => now(),
            ])->save();

            $user->syncRoles([]);
        });
    }
}
