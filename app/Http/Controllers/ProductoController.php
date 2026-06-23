<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

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
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $negocio = $this->negocioDe($request);

        if (! $negocio) {
            return $this->sinNegocio();
        }

        $query = $negocio->productos()->with('categoria')->latest();

        if ($request->filled('buscar')) {
            $query->where('nombre', 'like', '%'.$request->string('buscar').'%');
        }

        if ($request->filled('categoria_id')) {
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
    public function store(Request $request): JsonResponse
    {
        $negocio = $this->negocioDe($request);

        if (! $negocio) {
            return $this->sinNegocio();
        }

        $data = $request->validate($this->reglas($negocio, creando: true));

        $producto = $negocio->productos()->create($data);

        return response()->json([
            'producto' => new ProductoResource($producto->load('categoria')),
        ], 201);
    }

    /**
     * Ver UN producto mío.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $producto = $this->productoDe($request, $id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        return response()->json([
            'producto' => new ProductoResource($producto->load('categoria')),
        ]);
    }

    /**
     * Actualizar UN producto mío (incluye activar/desactivar y cambiar categoría).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $producto = $this->productoDe($request, $id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $data = $request->validate($this->reglas($producto->negocio, creando: false));

        $producto->update($data);

        return response()->json([
            'producto' => new ProductoResource($producto->load('categoria')),
        ]);
    }

    /**
     * Borrar UN producto mío (borrado suave: queda recuperable y no rompe
     * el historial de pedidos que lo referencien).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $producto = $this->productoDe($request, $id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $producto->delete();

        return response()->json(['message' => 'Producto eliminado.']);
    }

    // ---------- Helpers privados ----------

    /**
     * Reglas de validación. La categoría debe existir Y pertenecer a este
     * negocio: así un comerciante no puede asignar la categoría de otra tienda.
     *
     * @return array<string, mixed>
     */
    private function reglas(Negocio $negocio, bool $creando): array
    {
        $requerido = $creando ? 'required' : 'sometimes';

        return [
            'nombre' => [$requerido, 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'precio' => [$requerido, 'numeric', 'min:0'],
            'disponible' => ['sometimes', 'boolean'],
            'categoria_id' => [
                'nullable',
                Rule::exists('categorias', 'id')->where('negocio_id', $negocio->id),
            ],
        ];
    }

    private function negocioDe(Request $request): ?Negocio
    {
        return $request->user()->negocio;
    }

    /**
     * Busca un producto SOLO dentro del negocio del comerciante.
     */
    private function productoDe(Request $request, int $id): ?Producto
    {
        return $this->negocioDe($request)?->productos()->find($id);
    }

    private function sinNegocio(): JsonResponse
    {
        return response()->json(['message' => 'Primero debes crear tu negocio.'], 409);
    }

    private function noEncontrado(): JsonResponse
    {
        return response()->json(['message' => 'Producto no encontrado.'], 404);
    }
}
