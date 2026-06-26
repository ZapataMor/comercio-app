<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API de catálogo para que el CLIENTE (app móvil) explore negocios abiertos
 * y vea sus productos disponibles. Solo lectura.
 */
class CatalogoController extends Controller
{
    /** Lista de negocios abiertos, con su número de productos disponibles. */
    public function index(): JsonResponse
    {
        $negocios = Negocio::where('activo', true)
            ->withCount(['productos' => fn ($q) => $q->where('disponible', true)])
            ->orderBy('nombre')
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'nombre' => $n->nombre,
                'descripcion' => $n->descripcion,
                'direccion' => $n->direccion,
                'productos' => $n->productos_count,
            ]);

        return response()->json(['negocios' => $negocios]);
    }

    /** Detalle de un negocio abierto + sus productos disponibles. */
    public function show(int $id): JsonResponse
    {
        $negocio = Negocio::where('activo', true)->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no disponible.'], 404);
        }

        $productos = $negocio->productos()
            ->where('disponible', true)
            ->with('categoria')
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'negocio' => [
                'id' => $negocio->id,
                'nombre' => $negocio->nombre,
                'descripcion' => $negocio->descripcion,
                'direccion' => $negocio->direccion,
                'telefono' => $negocio->telefono,
            ],
            'productos' => ProductoResource::collection($productos),
        ]);
    }
}
