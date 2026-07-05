<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Models\Producto;
use App\Models\TipoNegocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API de catálogo para que el CLIENTE (app móvil) explore negocios abiertos
 * y vea sus productos disponibles. Solo lectura.
 */
class CatalogoController extends Controller
{
    /**
     * Lista de TODOS los negocios registrados (abiertos y cerrados), con su
     * número de productos disponibles, paginados de 50 en 50.
     *
     * Parámetros opcionales:
     *   ?page=N       -> página a consultar (50 negocios por página).
     *   ?buscar=texto -> filtra por nombre/descripción del negocio, o por
     *                    negocios que tengan algún producto disponible que
     *                    coincida (por nombre o por su categoría).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Negocio::query()
            ->with('tiposNegocio')
            ->withCount(['productos' => fn ($q) => $q->where('disponible', true)]);

        if ($request->filled('tipo_negocio_id')) {
            $tipoId = $request->integer('tipo_negocio_id');
            $query->whereHas('tiposNegocio', fn ($q) => $q->where('tipos_negocio.id', $tipoId));
        }

        if ($request->filled('buscar')) {
            $texto = trim((string) $request->string('buscar'));

            $query->where(function ($q) use ($texto) {
                $q->where('nombre', 'like', "%{$texto}%")
                    ->orWhere('descripcion', 'like', "%{$texto}%")
                    ->orWhereHas('tiposNegocio', fn ($c) => $c->where('nombre', 'like', "%{$texto}%"))
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

        $pagina = $query
            // Primero los abiertos, y dentro de cada grupo por nombre.
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(50);

        $negocios = collect($pagina->items())->map(fn ($n) => [
            'id' => $n->id,
            'nombre' => $n->nombre,
            'descripcion' => $n->descripcion,
            'categoria' => $n->tiposNegocio->first()?->nombre ?? $n->categoria,
            'categorias' => $n->tiposNegocio->pluck('nombre')->values()->all(),
            'direccion' => $n->direccion,
            'imagen' => $n->imagen ? '/storage/'.$n->imagen : null,
            'productos' => $n->productos_count,
            'abierto' => (bool) $n->activo,
        ]);

        return response()->json([
            'negocios' => $negocios,
            'meta' => [
                'pagina' => $pagina->currentPage(),
                'ultima_pagina' => $pagina->lastPage(),
                'total' => $pagina->total(),
            ],
        ]);
    }

    /** Tipos de negocio disponibles para filtrar la exploracion del cliente. */
    public function tiposNegocio(): JsonResponse
    {
        $tipos = TipoNegocio::query()
            ->whereHas('negocios')
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'slug']);

        return response()->json(['categorias' => $tipos]);
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
        $tipoNegocioId = $request->integer('tipo_negocio_id') ?: null;

        // Sin texto ni categoria no buscamos productos (la app muestra negocios).
        if ($texto === '' && ! $tipoNegocioId) {
            return response()->json(['productos' => []]);
        }

        $like = '%'.$texto.'%';

        $productos = Producto::query()
            ->where('disponible', true)
            ->whereHas('negocio', function ($q) use ($tipoNegocioId) {
                if ($tipoNegocioId) {
                    $q->whereHas('tiposNegocio', fn ($t) => $t->where('tipos_negocio.id', $tipoNegocioId));
                }
            })
            ->when($texto !== '', function ($q) use ($like) {
                $q->where(function ($qq) use ($like) {
                    $qq->where('nombre', 'like', $like)
                        ->orWhere('descripcion', 'like', $like)
                        ->orWhereHas('categoria', fn ($c) => $c->where('nombre', 'like', $like));
                });
            })
            ->with(['categoria', 'negocio'])
            ->orderByDesc(
                Negocio::select('activo')
                    ->whereColumn('negocios.id', 'productos.negocio_id')
                    ->limit(1)
            )
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

    /** Detalle de un negocio + sus productos disponibles. */
    public function show(int $id): JsonResponse
    {
        $negocio = Negocio::with('tiposNegocio')->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no encontrado.'], 404);
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
                'categoria' => $negocio->tiposNegocio->first()?->nombre ?? $negocio->categoria,
                'categorias' => $negocio->tiposNegocio->pluck('nombre')->values()->all(),
                'direccion' => $negocio->direccion,
                'telefono' => $negocio->telefono,
                'activo' => (bool) $negocio->activo,
                'imagen' => $negocio->imagen ? '/storage/'.$negocio->imagen : null,
            ],
            'productos' => ProductoResource::collection($productos),
        ]);
    }
}
