<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barrio;
use Illuminate\Http\JsonResponse;

class BarrioController extends Controller
{
    /**
     * Lista pública de barrios aprobados (para el selector de la app).
     * Es pública porque el registro de cuenta la necesita antes de tener token.
     */
    public function index(): JsonResponse
    {
        $barrios = Barrio::aprobados()
            ->orderBy('nombre')
            ->get(['id', 'nombre']);

        return response()->json(['barrios' => $barrios]);
    }

    /**
     * ADMIN: barrios sugeridos por clientes, pendientes de aprobación.
     */
    public function pendientes(): JsonResponse
    {
        $barrios = Barrio::where('aprobado', false)
            ->with('creador:id,name')
            ->latest()
            ->get()
            ->map(fn ($b) => [
                'id' => $b->id,
                'nombre' => $b->nombre,
                'sugerido_por' => $b->creador?->name,
                'fecha' => $b->created_at?->toDateString(),
            ]);

        return response()->json(['barrios' => $barrios]);
    }

    /**
     * ADMIN: aprueba un barrio sugerido → pasa a la lista pública.
     */
    public function aprobar(int $id): JsonResponse
    {
        $barrio = Barrio::findOrFail($id);
        $barrio->update(['aprobado' => true]);

        return response()->json(['message' => 'Barrio aprobado.', 'barrio' => ['id' => $barrio->id, 'nombre' => $barrio->nombre]]);
    }

    /**
     * ADMIN: rechaza (elimina) un barrio sugerido. No afecta al usuario que
     * lo escribió: su dirección conserva el texto que él puso.
     */
    public function rechazar(int $id): JsonResponse
    {
        $barrio = Barrio::where('aprobado', false)->findOrFail($id);
        $barrio->delete();

        return response()->json(['message' => 'Barrio rechazado.']);
    }
}
