<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use App\Models\User;
use App\Notifications\InvitacionTrabajoRecibida;
use App\Support\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Equipo de un negocio: miembros e invitaciones de trabajo.
 *
 * La app NO permite buscar personas. Un trabajador se vincula así:
 *  1. Comparte su código público (ej. #U34F4D) con el propietario, fuera de la app.
 *  2. El propietario lo ingresa aquí: se valida el código EXACTO y se muestra
 *     el nombre para confirmar que es la persona correcta.
 *  3. Se crea una invitación 'pendiente' y al invitado le llega un push.
 *  4. Solo cuando el invitado ACEPTA se crea la membresía.
 */
class TrabajadorController extends Controller
{
    /**
     * Resolver un código público → nombre (previsualización antes de invitar).
     * Cualquier miembro activo puede consultarlo; solo devuelve el nombre.
     */
    public function resolverCodigo(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $data = $request->validate(['codigo' => ['required', 'string', 'max:12']]);

        $usuario = $this->porCodigo($data['codigo']);

        if (! $usuario) {
            return response()->json(['message' => 'No existe nadie con ese código.'], 404);
        }

        return response()->json([
            'usuario' => ['name' => $usuario->name, 'codigo_publico' => $usuario->codigo_publico],
        ]);
    }

    /** Miembros del negocio (con rol y estado). Visible para todo miembro. */
    public function miembros(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $miembros = $negocio->miembros()
            ->orderByPivot('rol') // propietario(s) primero
            ->get()
            ->map(fn (User $m) => [
                'id' => $m->id,
                'name' => $m->name,
                'rol' => $m->pivot->rol,
                'activo' => (bool) $m->pivot->activo,
                'es_yo' => $m->id === $request->user()->id,
            ]);

        // Invitaciones pendientes del negocio (para que el dueño vea a quién invitó).
        $pendientes = $negocio->invitaciones()
            ->where('estado', InvitacionTrabajo::PENDIENTE)
            ->with('invitado:id,name')
            ->get()
            ->map(fn ($i) => [
                'id' => $i->id,
                'nombre' => $i->invitado?->name,
                'fecha' => $i->created_at->format('d/m/Y'),
            ]);

        return response()->json(['miembros' => $miembros, 'invitaciones_pendientes' => $pendientes]);
    }

    /**
     * Invitar a una persona por su código público. Solo el propietario.
     * Crea la invitación pendiente y avisa por push al invitado.
     */
    public function invitar(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esPropietario($request->user())) {
            return $this->sinAcceso('Solo el propietario puede invitar trabajadores.');
        }

        $data = $request->validate(['codigo' => ['required', 'string', 'max:12']]);

        $usuario = $this->porCodigo($data['codigo']);

        if (! $usuario) {
            return response()->json(['message' => 'No existe nadie con ese código.'], 404);
        }

        if ($usuario->id === $request->user()->id) {
            return response()->json(['message' => 'Ese es tu propio código.'], 422);
        }

        if ($negocio->miembros()->whereKey($usuario->id)->exists()) {
            return response()->json(['message' => "{$usuario->name} ya hace parte del negocio."], 409);
        }

        $yaInvitado = $negocio->invitaciones()
            ->where('user_id', $usuario->id)
            ->where('estado', InvitacionTrabajo::PENDIENTE)
            ->exists();

        if ($yaInvitado) {
            return response()->json(['message' => "{$usuario->name} ya tiene una invitación pendiente."], 409);
        }

        $invitacion = $negocio->invitaciones()->create([
            'user_id' => $usuario->id,
            'invitado_por' => $request->user()->id,
            'estado' => InvitacionTrabajo::PENDIENTE,
        ]);

        // El invitado decide: la invitación no lo vincula hasta que acepte.
        Push::enviar($usuario, new InvitacionTrabajoRecibida($invitacion));

        return response()->json([
            'message' => "Invitación enviada a {$usuario->name}. Debe aceptarla desde su app.",
        ], 201);
    }

    /** Cancelar una invitación pendiente. Solo el propietario. */
    public function cancelarInvitacion(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esPropietario($request->user())) {
            return $this->sinAcceso('Solo el propietario puede cancelar invitaciones.');
        }

        $borradas = $negocio->invitaciones()
            ->where('id', $id)
            ->where('estado', InvitacionTrabajo::PENDIENTE)
            ->delete();

        if (! $borradas) {
            return response()->json(['message' => 'Invitación no encontrada.'], 404);
        }

        return response()->json(['message' => 'Invitación cancelada.']);
    }

    /**
     * Quitar a un trabajador del negocio. Solo el propietario, y nunca a
     * otro propietario (ni a sí mismo por esta vía).
     */
    public function quitarMiembro(Request $request, Negocio $negocio, int $userId): JsonResponse
    {
        if (! $negocio->esPropietario($request->user())) {
            return $this->sinAcceso('Solo el propietario puede gestionar el equipo.');
        }

        $miembro = $negocio->miembros()->whereKey($userId)->first();

        if (! $miembro) {
            return response()->json(['message' => 'Ese usuario no es miembro del negocio.'], 404);
        }

        if ($miembro->pivot->rol === Negocio::ROL_PROPIETARIO) {
            return response()->json(['message' => 'No puedes quitar a un propietario.'], 422);
        }

        // Se elimina la membresía; su cuenta y su historial de pedidos quedan intactos.
        $negocio->miembros()->detach($userId);

        return response()->json(['message' => "{$miembro->name} ya no hace parte del negocio."]);
    }

    /** Renunciar: un trabajador se retira del negocio por su cuenta. */
    public function salir(Request $request, Negocio $negocio): JsonResponse
    {
        $user = $request->user();
        $miembro = $negocio->miembros()->whereKey($user->id)->first();

        if (! $miembro) {
            return response()->json(['message' => 'No eres miembro de este negocio.'], 404);
        }

        if ($miembro->pivot->rol === Negocio::ROL_PROPIETARIO) {
            return response()->json(['message' => 'El propietario no puede renunciar a su propio negocio.'], 422);
        }

        $negocio->miembros()->detach($user->id);

        return response()->json(['message' => 'Saliste del negocio.']);
    }

    // ---------- Helpers privados ----------

    /** Busca por código EXACTO (acepta con o sin '#', en cualquier caja). */
    private function porCodigo(string $codigo): ?User
    {
        $limpio = Str::of($codigo)->trim()->ltrim('#')->upper()->toString();

        if ($limpio === '') {
            return null;
        }

        return User::where('codigo_publico', $limpio)->first();
    }

    private function sinAcceso(string $mensaje = 'No tienes acceso a este negocio.'): JsonResponse
    {
        return response()->json(['message' => $mensaje], 403);
    }
}
