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
    /**
     * Lista de negocios abiertos, con su número de productos disponibles.
     *
     * Parámetro opcional:
     *   ?buscar=texto -> filtra por nombre/descripción del negocio, o por
     *                    negocios que tengan algún producto disponible que
     *                    coincida (por nombre o por su categoría).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Negocio::where('activo', true)
            ->withCount(['productos' => fn ($q) => $q->where('disponible', true)]);

        if ($request->filled('buscar')) {
            $texto = trim((string) $request->string('buscar'));

            $query->where(function ($q) use ($texto) {
                $q->where('nombre', 'like', "%{$texto}%")
                    ->orWhere('descripcion', 'like', "%{$texto}%")
                    // Negocios con productos disponibles que coincidan por
                    // nombre o por el nombre de su categoría.
                    ->orWhereHas('productos', function ($p) use ($texto) {
                        $p->where('disponible', true)
                            ->where(function ($pp) use ($texto) {
                                $pp->where('nombre', 'like', "%{$texto}%")
                                    ->orWhereHas('categoria', fn ($c) => $c->where('nombre', 'like', "%{$texto}%"));
                            });
                    });
            });
        }

        $negocios = $query
            ->orderBy('nombre')
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'nombre' => $n->nombre,
                'descripcion' => $n->descripcion,
                'direccion' => $n->direccion,
                'imagen' => $n->imagen ? '/storage/'.$n->imagen : null,
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
                'imagen' => $negocio->imagen ? '/storage/'.$negocio->imagen : null,
            ],
            'productos' => ProductoResource::collection($productos),
        ]);
    }
}
