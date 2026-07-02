<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Models\Producto;
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

    /**
     * Búsqueda de PRODUCTOS para el cliente (app móvil).
     *
     * Devuelve los productos disponibles de negocios abiertos cuyo nombre
     * (o el de su categoría/descripción) coincide con ?buscar=texto, junto al
     * negocio que los vende. El orden es por RELEVANCIA: de la coincidencia más
     * cercana a la más lejana (nombre exacto → empieza por → contiene → otros),
     * y a igualdad de relevancia, alfabético.
     */
    public function buscarProductos(Request $request): JsonResponse
    {
        $texto = trim((string) $request->string('buscar'));

        // Sin texto no buscamos productos (la app muestra negocios en su lugar).
        if ($texto === '') {
            return response()->json(['productos' => []]);
        }

        $like = '%'.$texto.'%';

        $productos = Producto::query()
            ->where('disponible', true)
            ->whereHas('negocio', fn ($n) => $n->where('activo', true))
            ->where(function ($q) use ($texto, $like) {
                $q->where('nombre', 'like', $like)
                    ->orWhere('descripcion', 'like', $like)
                    ->orWhereHas('categoria', fn ($c) => $c->where('nombre', 'like', $like));
            })
            ->with(['categoria', 'negocio'])
            // Ranking de cercanía de la coincidencia (0 = más cercana).
            ->orderByRaw(
                'CASE
                    WHEN nombre = ? THEN 0
                    WHEN nombre LIKE ? THEN 1
                    WHEN nombre LIKE ? THEN 2
                    ELSE 3
                END',
                [$texto, $texto.'%', $like]
            )
            ->orderBy('nombre')
            ->limit(50)
            ->get();

        return response()->json([
            'productos' => ProductoResource::collection($productos),
        ]);
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
