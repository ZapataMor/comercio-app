<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CategoriaCatalogo;
use App\Support\NombresAlternos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Categorías globales del catálogo (Comida, Bebidas...): solo el administrador
 * las crea, renombra, oculta o borra. El comerciante las elige para sus
 * productos y el cliente filtra la búsqueda por ellas.
 */
class AdminCategoriaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'categorias' => CategoriaCatalogo::withCount('productos')->orderBy('orden')->orderBy('nombre')->get()
                ->map(fn (CategoriaCatalogo $c) => $this->datos($c)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validar($request);
        $categoria = CategoriaCatalogo::create($data + [
            'orden' => (int) CategoriaCatalogo::max('orden') + 1,
            'activa' => true,
        ]);

        return response()->json(['message' => "Categoría «{$categoria->nombre}» creada.", 'categoria' => $this->datos($categoria)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $categoria = CategoriaCatalogo::findOrFail($id);
        $categoria->update($this->validar($request, $categoria));

        return response()->json(['message' => "Categoría «{$categoria->nombre}» guardada.", 'categoria' => $this->datos($categoria)]);
    }

    /** Los productos no se borran: solo pierden esta categoría. */
    public function destroy(int $id): JsonResponse
    {
        $categoria = CategoriaCatalogo::findOrFail($id);
        $categoria->delete();

        return response()->json(['message' => "Categoría «{$categoria->nombre}» eliminada."]);
    }

    /**
     * Los otros nombres llegan como lista (`nombres_alternos`, desde la API) o
     * como texto separado por comas (`otros_nombres`, desde el panel web).
     */
    private function validar(Request $request, ?CategoriaCatalogo $categoria = null): array
    {
        $data = $request->validate([
            'nombre' => [$categoria ? 'sometimes' : 'required', 'string', 'max:80'],
            'otros_nombres' => ['sometimes', 'nullable', 'string', 'max:700'],
            'orden' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:9999'],
            'activa' => ['sometimes', 'boolean'],
        ] + NombresAlternos::reglas());

        if (isset($data['nombre'])) {
            $data['nombre'] = preg_replace('/\s+/u', ' ', trim($data['nombre']));
            $data['slug'] = Str::slug($data['nombre']);
            $repetida = CategoriaCatalogo::where(fn ($q) => $q->where('slug', $data['slug'])->orWhere('nombre', $data['nombre']))
                ->when($categoria, fn ($q) => $q->whereKeyNot($categoria->id))->exists();
            if ($data['nombre'] === '' || $data['slug'] === '' || $repetida) {
                throw ValidationException::withMessages(['nombre' => $repetida ? 'Ya existe una categoría con ese nombre.' : 'Escribe el nombre de la categoría.']);
            }
        }

        $nombre = $data['nombre'] ?? $categoria?->nombre;
        if (array_key_exists('otros_nombres', $data)) {
            $data['nombres_alternos'] = NombresAlternos::desdeTexto($data['otros_nombres'], $nombre);
        } elseif (array_key_exists('nombres_alternos', $data)) {
            $data['nombres_alternos'] = NombresAlternos::limpiar($data['nombres_alternos'], $nombre);
        }
        unset($data['otros_nombres']);
        if (array_key_exists('orden', $data) && $data['orden'] === null) {
            unset($data['orden']);
        }

        return $data;
    }

    private function datos(CategoriaCatalogo $c): array
    {
        return [
            'id' => $c->id,
            'nombre' => $c->nombre,
            'nombres_alternos' => $c->nombres_alternos ?? [],
            'activa' => $c->activa,
            'orden' => $c->orden,
            'productos' => $c->productos_count ?? $c->productos()->count(),
        ];
    }
}
