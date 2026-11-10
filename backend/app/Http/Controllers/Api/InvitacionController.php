<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Invitaciones de trabajo DEL LADO DEL INVITADO: ver las pendientes,
 * aceptar (crea la membresía) o rechazar. Nadie entra a un negocio
 * sin aceptar explícitamente.
 */
class InvitacionController extends Controller
{
    /** Mis invitaciones pendientes. */
    public function index(Request $request): JsonResponse
    {
        $invitaciones = $request->user()->invitacionesTrabajo()
            ->where('estado', InvitacionTrabajo::PENDIENTE)
            ->with(['negocio:id,nombre', 'invitadoPor:id,name,apellidos'])
            ->latest()
            ->get()
            ->map(fn ($i) => [
                'id' => $i->id,
                'negocio' => $i->negocio?->nombre,
                'invitado_por' => $i->invitadoPor?->nombre_completo,
                'fecha' => $i->created_at->format('d/m/Y'),
            ]);

        return response()->json(['invitaciones' => $invitaciones]);
    }

    /** Aceptar: me convierto en trabajador activo del negocio. */
    public function aceptar(Request $request, int $id): JsonResponse
    {
        $invitacion = DB::transaction(function () use ($request, $id) {
            $invitacion = $this->pendienteDe($request, $id);
            abort_unless($invitacion, 404, 'Invitación no encontrada.');
            $negocio = Negocio::lockForUpdate()->findOrFail($invitacion->negocio_id);
            $invitacion->refresh();
            abort_unless($invitacion->estado === InvitacionTrabajo::PENDIENTE && ! $negocio->archivado_at, 409);
            abort_if($negocio->miembros()->whereKey($request->user()->id)->exists(), 409, 'Ya haces parte del negocio.');
            $negocio->miembros()->attach($request->user()->id, [
                'rol' => Negocio::ROL_TRABAJADOR, 'activo' => true,
                ...$invitacion->only(Negocio::PERMISOS),
            ]);
            $invitacion->update(['estado' => InvitacionTrabajo::ACEPTADA]);

            return $invitacion;
        });

        return response()->json([
            'message' => "Ahora haces parte de {$invitacion->negocio->nombre}.",
            'negocio' => [
                'id' => $invitacion->negocio->id,
                'nombre' => $invitacion->negocio->nombre,
                'rol' => Negocio::ROL_TRABAJADOR,
            ],
        ]);
    }

    /** Rechazar la invitación. */
    public function rechazar(Request $request, int $id): JsonResponse
    {
        $invitacion = $this->pendienteDe($request, $id);

        if (! $invitacion) {
            return response()->json(['message' => 'Invitación no encontrada.'], 404);
        }

        $invitacion->update(['estado' => InvitacionTrabajo::RECHAZADA]);

        return response()->json(['message' => 'Invitación rechazada.']);
    }

    /** Solo MIS invitaciones y solo si siguen pendientes. */
    private function pendienteDe(Request $request, int $id): ?InvitacionTrabajo
    {
        return $request->user()->invitacionesTrabajo()
            ->where('id', $id)
            ->where('estado', InvitacionTrabajo::PENDIENTE)
            ->with('negocio')
            ->first();
    }
}
