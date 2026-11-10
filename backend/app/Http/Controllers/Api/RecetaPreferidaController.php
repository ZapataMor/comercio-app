<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Support\RecetasPreferidas;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecetaPreferidaController extends Controller
{
    /** Las recetas preferidas de quien consulta, en esta tienda. */
    public function index(Request $request, int $id): JsonResponse
    {
        $negocio = Negocio::whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at')->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no encontrado.'], 404);
        }

        return response()->json([
            'recetas' => RecetasPreferidas::de($request->user(), $negocio)
                ->map(fn (array $receta) => [
                    ...$receta,
                    'producto' => new ProductoResource($receta['producto']),
                ]),
        ]);
    }
}
