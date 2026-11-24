<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barrio;
use App\Models\Negocio;
use App\Models\Propiedad;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
     * Más o menos dónde queda un barrio: el promedio de los negocios y las
     * propiedades publicadas en él que tienen su punto en el mapa. Con eso el
     * mapa para marcar la casa abre en el barrio y no en toda la ciudad. Solo
     * se usan puntos públicos: nunca la casa de otro cliente.
     */
    public function centro(Request $request): JsonResponse
    {
        $nombre = mb_strtolower(trim((string) $request->validate([
            'nombre' => ['required', 'string', 'max:120'],
        ])['nombre']));

        $puntos = Negocio::query()
            ->whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at')
            ->whereNotNull('lat')->whereNotNull('lng')
            ->whereRaw('LOWER(barrio) = ?', [$nombre])
            ->get(['lat', 'lng'])
            ->concat(Propiedad::publicadas()->whereRaw('LOWER(barrio) = ?', [$nombre])->get(['lat', 'lng']))
            ->map(fn ($p) => ['lat' => (float) $p->lat, 'lng' => (float) $p->lng])
            ->filter(fn ($p) => $p['lat'] && $p['lng']);

        return response()->json(['centro' => $puntos->isEmpty() ? null : [
            'lat' => round($puntos->avg('lat'), 6),
            'lng' => round($puntos->avg('lng'), 6),
        ]]);
    }

    /**
     * ADMIN: barrios sugeridos por clientes, pendientes de aprobación.
     */
    public function pendientes(): JsonResponse
    {
        $barrios = Barrio::where('aprobado', false)
            ->with('creador:id,name,apellidos')
            ->latest()
            ->get()
            ->map(fn ($b) => [
                'id' => $b->id,
                'nombre' => $b->nombre,
                'sugerido_por' => $b->creador?->nombre_completo,
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
