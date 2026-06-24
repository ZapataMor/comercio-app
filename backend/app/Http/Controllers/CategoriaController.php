<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoriaResource;
use App\Models\Categoria;
use App\Models\Negocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class CategoriaController extends Controller
{
    /**
     * Listar las categorías de MI negocio.
     */
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $negocio = $this->negocioDe($request);

        if (! $negocio) {
            return $this->sinNegocio();
        }

        return CategoriaResource::collection($negocio->categorias()->orderBy('nombre')->get());
    }

    /**
     * Crear una categoría en MI negocio.
     */
    public function store(Request $request): JsonResponse
    {
        $negocio = $this->negocioDe($request);

        if (! $negocio) {
            return $this->sinNegocio();
        }

        $data = $request->validate([
            'nombre' => [
                'required', 'string', 'max:255',
                // Nombre único DENTRO de este negocio.
                Rule::unique('categorias', 'nombre')->where('negocio_id', $negocio->id),
            ],
        ]);

        $categoria = $negocio->categorias()->create($data);

        return response()->json(['categoria' => new CategoriaResource($categoria)], 201);
    }

    /**
     * Renombrar una categoría mía.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $negocio = $this->negocioDe($request);
        $categoria = $negocio?->categorias()->find($id);

        if (! $categoria) {
            return $this->noEncontrada();
        }

        $data = $request->validate([
            'nombre' => [
                'required', 'string', 'max:255',
                Rule::unique('categorias', 'nombre')
                    ->where('negocio_id', $negocio->id)
                    ->ignore($categoria->id),
            ],
        ]);

        $categoria->update($data);

        return response()->json(['categoria' => new CategoriaResource($categoria)]);
    }

    /**
     * Borrar una categoría mía. Los productos NO se borran: quedan sin
     * categoría (categoria_id pasa a null, por el nullOnDelete de la migración).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $categoria = $this->negocioDe($request)?->categorias()->find($id);

        if (! $categoria) {
            return $this->noEncontrada();
        }

        $categoria->delete();

        return response()->json(['message' => 'Categoría eliminada.']);
    }

    // ---------- Helpers privados ----------

    private function negocioDe(Request $request): ?Negocio
    {
        return $request->user()->negocio;
    }

    private function sinNegocio(): JsonResponse
    {
        return response()->json(['message' => 'Primero debes crear tu negocio.'], 409);
    }

    private function noEncontrada(): JsonResponse
    {
        return response()->json(['message' => 'Categoría no encontrada.'], 404);
    }
}
