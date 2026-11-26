<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Support\Busqueda;
use App\Support\EditorProducto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductoController extends Controller
{
    /**
     * Listar los productos de MI negocio, con búsqueda, filtro y paginación.
     *
     * Parámetros opcionales (query string):
     *   ?buscar=texto        -> filtra por nombre
     *   ?categoria_id=3      -> filtra por categoría
     *   ?disponible=1|0      -> filtra por disponibilidad
     *   ?por_pagina=15       -> tamaño de página (máx 100)
     *   ?page=2              -> número de página
     */
    public function index(Request $request, Negocio $negocio): AnonymousResourceCollection|JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $query = $negocio->productos()->with(['categoria', 'tipoProducto', 'categoriasCatalogo'])->latest();

        if ($request->filled('buscar')) {
            // Tolerante a errores, como la del cliente (ver App\Support\Busqueda).
            Busqueda::contieneTodos($query, 'productos.busqueda', Busqueda::terminos((string) $request->string('buscar')));
        }

        if ($request->boolean('sin_categoria')) {
            // Productos sin categoría (grupo "Sin categoría" de la app).
            $query->whereNull('categoria_id');
        } elseif ($request->filled('categoria_id')) {
            $query->where('categoria_id', $request->integer('categoria_id'));
        }

        if ($request->filled('disponible')) {
            $query->where('disponible', $request->boolean('disponible'));
        }

        $porPagina = min($request->integer('por_pagina', 15), 100);

        return ProductoResource::collection($query->paginate($porPagina));
    }

    /**
     * Crear un producto en MI negocio.
     */
    public function store(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $producto = EditorProducto::crear($negocio, $request->validate(EditorProducto::reglas($negocio, creando: true)), $request->file('imagen'));

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto', 'categoriasCatalogo'])),
        ], 201);
    }

    /**
     * Ver UN producto mío.
     */
    public function show(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $producto = $negocio->productos()->find($id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto', 'categoriasCatalogo'])),
        ]);
    }

    /**
     * Actualizar UN producto mío (incluye activar/desactivar y cambiar categoría).
     */
    public function update(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $producto = $negocio->productos()->find($id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        EditorProducto::actualizar($producto, $request->validate(EditorProducto::reglas($negocio, creando: false)), $request->file('imagen'));

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto', 'categoriasCatalogo'])),
        ]);
    }

    /**
     * Borrar UN producto mío (borrado suave: queda recuperable y no rompe
     * el historial de pedidos que lo referencien).
     */
    public function destroy(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $producto = $negocio->productos()->find($id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $producto->delete();

        return response()->json(['message' => 'Producto eliminado.']);
    }

    // ---------- Helpers privados ----------

    private function sinAcceso(): JsonResponse
    {
        return response()->json(['message' => 'No tienes acceso a este negocio.'], 403);
    }

    private function noEncontrado(): JsonResponse
    {
        return response()->json(['message' => 'Producto no encontrado.'], 404);
    }
}
