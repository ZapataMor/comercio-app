<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoriaResource;
use App\Models\Negocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Categorías del catálogo de UN negocio. Puede gestionarlas cualquier
 * miembro activo (propietario o trabajador): organizar el catálogo es
 * parte del trabajo del equipo del negocio.
 */
class CategoriaController extends Controller
{
    /**
     * Listar las categorías del negocio.
     */
    public function index(Request $request, Negocio $negocio): AnonymousResourceCollection|JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        // withCount('productos') agrega `productos_count` a cada categoría
        // para que la app muestre "N productos" en la lista de categorías.
        return CategoriaResource::collection(
            $negocio->categorias()->withCount('productos')->orderBy('nombre')->get()
        );
    }

    /**
     * Crear una categoría en el negocio.
     */
    public function store(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
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
     * Renombrar una categoría del negocio.
     */
    public function update(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $categoria = $negocio->categorias()->find($id);

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
     * Borrar una categoría. Los productos NO se borran: quedan sin
     * categoría (categoria_id pasa a null, por el nullOnDelete de la migración).
     */
    public function destroy(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $categoria = $negocio->categorias()->find($id);

        if (! $categoria) {
            return $this->noEncontrada();
        }

        $categoria->delete();

        return response()->json(['message' => 'Categoría eliminada.']);
    }

    // ---------- Helpers privados ----------

    private function sinAcceso(): JsonResponse
    {
        return response()->json(['message' => 'No tienes acceso a este negocio.'], 403);
    }

    private function noEncontrada(): JsonResponse
    {
        return response()->json(['message' => 'Categoría no encontrada.'], 404);
    }
}
