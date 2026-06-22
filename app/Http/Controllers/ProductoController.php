<?php

namespace App\Http\Controllers;

use App\Models\Negocio;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductoController extends Controller
{
    /**
     * Listar los productos de MI negocio.
     */
    public function index(Request $request): JsonResponse
    {
        $negocio = $this->negocioDe($request);

        if (! $negocio) {
            return $this->sinNegocio();
        }

        return response()->json([
            'productos' => $negocio->productos()->latest()->get(),
        ]);
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

        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'precio' => ['required', 'numeric', 'min:0'],
            'disponible' => ['sometimes', 'boolean'],
        ]);

        $producto = $negocio->productos()->create($data);

        return response()->json(['producto' => $producto], 201);
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

        return response()->json(['producto' => $producto]);
    }

    /**
     * Actualizar UN producto mío (incluye activar/desactivar con 'disponible').
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $producto = $this->productoDe($request, $id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $data = $request->validate([
            'nombre' => ['sometimes', 'required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'precio' => ['sometimes', 'required', 'numeric', 'min:0'],
            'disponible' => ['sometimes', 'boolean'],
        ]);

        $producto->update($data);

        return response()->json(['producto' => $producto]);
    }

    /**
     * Borrar UN producto mío.
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
     * El negocio del comerciante autenticado (o null si aún no lo creó).
     */
    private function negocioDe(Request $request): ?Negocio
    {
        return $request->user()->negocio;
    }

    /**
     * Busca un producto SOLO dentro del negocio del comerciante.
     * Si el id no existe o pertenece a otro negocio, devuelve null:
     * así un comerciante nunca puede ver/editar productos ajenos.
     */
    private function productoDe(Request $request, int $id): ?Producto
    {
        $negocio = $this->negocioDe($request);

        return $negocio?->productos()->find($id);
    }

    private function sinNegocio(): JsonResponse
    {
        return response()->json([
            'message' => 'Primero debes crear tu negocio.',
        ], 409);
    }

    private function noEncontrado(): JsonResponse
    {
        return response()->json([
            'message' => 'Producto no encontrado.',
        ], 404);
    }
}
