<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\NegocioVisita;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Visitas a la tienda: el cliente las registra al entrar a ver un negocio y
 * el administrador del negocio ve cuántas van y cuántas personas distintas.
 */
class VisitaNegocioController extends Controller
{
    /**
     * Si la misma persona vuelve a entrar antes de estos minutos, no se cuenta
     * otra visita: ir y volver entre la tienda y el carrito no infla el número.
     */
    public const MINUTOS_ENTRE_VISITAS = 10;

    /** El cliente entró a ver la tienda. */
    public function registrar(Request $request, int $id): JsonResponse
    {
        $negocio = Negocio::whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at')->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no encontrado.'], 404);
        }

        $user = $request->user();

        // El equipo del negocio mirando su propia tienda no son visitas.
        if ($negocio->miembros()->whereKey($user->id)->exists()) {
            return response()->json(['contada' => false]);
        }

        $reciente = NegocioVisita::where('negocio_id', $negocio->id)
            ->where('user_id', $user->id)
            ->where('created_at', '>=', now()->subMinutes(self::MINUTOS_ENTRE_VISITAS))
            ->exists();

        if ($reciente) {
            return response()->json(['contada' => false]);
        }

        NegocioVisita::create(['negocio_id' => $negocio->id, 'user_id' => $user->id]);

        return response()->json(['contada' => true], 201);
    }

    /** Visitas y personas distintas: hoy, últimos 7 y 30 días, y desde siempre. */
    public function resumen(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'administrador')) {
            return response()->json(['message' => 'Solo el administrador del negocio ve sus visitas.'], 403);
        }

        $base = NegocioVisita::where('negocio_id', $negocio->id);
        $desde = fn (?Carbon $inicio) => $this->conteo((clone $base)->when($inicio, fn ($q) => $q->where('created_at', '>=', $inicio)));

        return response()->json([
            'visitas' => [
                'hoy' => $desde(now()->startOfDay()),
                'semana' => $desde(now()->subDays(6)->startOfDay()),
                'mes' => $desde(now()->subDays(29)->startOfDay()),
                'total' => $desde(null),
            ],
        ]);
    }

    /** @return array{visitas: int, personas: int} */
    private function conteo(Builder $consulta): array
    {
        $fila = $consulta->selectRaw('count(*) as visitas, count(distinct user_id) as personas')->first();

        return ['visitas' => (int) $fila->visitas, 'personas' => (int) $fila->personas];
    }
}
