<?php

namespace App\Http\Controllers;

use App\Http\Resources\NegocioResource;
use App\Models\TipoNegocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class NegocioController extends Controller
{
    /**
     * Ver MI negocio (el del comerciante autenticado).
     */
    public function show(Request $request): JsonResponse
    {
        $negocio = $request->user()->negocio;

        if (! $negocio) {
            return response()->json([
                'message' => 'Todavía no has creado tu negocio.',
            ], 404);
        }

        return response()->json(['negocio' => new NegocioResource($negocio->load('tiposNegocio'))]);
    }

    /**
     * Crear MI negocio. Un comerciante solo puede tener uno.
     */
    public function store(Request $request): JsonResponse
    {
        if ($request->user()->negocio) {
            return response()->json([
                'message' => 'Ya tienes un negocio. Usa actualizar para modificarlo.',
            ], 409);
        }

        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            // Tipo de negocio: restaurante, almacén de ropa, farmacia, etc.
            'categoria' => ['required_without:categorias', 'nullable', 'string', 'max:100'],
            'categorias' => ['required_without:categoria', 'array', 'min:1'],
            'categorias.*' => ['required', 'string', 'max:100', 'distinct'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo' => ['sometimes', 'boolean'],
            'imagen' => ['sometimes', 'image', 'max:4096'], // máx 4 MB
        ]);

        $categorias = $this->normalizarCategorias($data);
        unset($data['categorias']);
        $data['categoria'] = $categorias[0] ?? null;

        // Se crea ligado al usuario autenticado: imposible crearlo para otro.
        $negocio = $request->user()->negocio()->create($data);
        $this->sincronizarCategorias($negocio, $categorias);

        $this->guardarImagen($request, $negocio);

        return response()->json(['negocio' => new NegocioResource($negocio->load('tiposNegocio'))], 201);
    }

    /**
     * Actualizar MI negocio.
     */
    public function update(Request $request): JsonResponse
    {
        $negocio = $request->user()->negocio;

        if (! $negocio) {
            return response()->json([
                'message' => 'Todavía no has creado tu negocio.',
            ], 404);
        }

        $data = $request->validate([
            'nombre' => ['sometimes', 'required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'categoria' => ['sometimes', 'required_without:categorias', 'nullable', 'string', 'max:100'],
            'categorias' => ['sometimes', 'array', 'min:1'],
            'categorias.*' => ['required', 'string', 'max:100', 'distinct'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo' => ['sometimes', 'boolean'],
            'imagen' => ['sometimes', 'image', 'max:4096'],
        ]);

        if (array_key_exists('categorias', $data) || array_key_exists('categoria', $data)) {
            $categorias = $this->normalizarCategorias($data);
            unset($data['categorias']);
            $data['categoria'] = $categorias[0] ?? null;
        }

        $negocio->update($data);

        if (isset($categorias)) {
            $this->sincronizarCategorias($negocio, $categorias);
        }

        $this->guardarImagen($request, $negocio);

        return response()->json(['negocio' => new NegocioResource($negocio->load('tiposNegocio'))]);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<int, string>
     */
    private function normalizarCategorias(array $data): array
    {
        $categorias = $data['categorias'] ?? [];

        if (! is_array($categorias)) {
            $categorias = [];
        }

        if (isset($data['categoria']) && is_string($data['categoria']) && trim($data['categoria']) !== '') {
            array_unshift($categorias, $data['categoria']);
        }

        return collect($categorias)
            ->map(fn ($valor) => Str::of((string) $valor)->squish()->title()->toString())
            ->filter()
            ->unique(fn (string $valor) => Str::slug($valor))
            ->values()
            ->all();
    }

    /**
     * @param array<int, string> $categorias
     */
    private function sincronizarCategorias(\App\Models\Negocio $negocio, array $categorias): void
    {
        $ids = collect($categorias)->map(function (string $nombre) {
            return TipoNegocio::firstOrCreate(
                ['slug' => Str::slug($nombre)],
                ['nombre' => $nombre],
            )->id;
        });

        $negocio->tiposNegocio()->sync($ids);
    }

    /**
     * Guarda la imagen subida (si viene) en storage/public/negocios y la
     * asigna al negocio, borrando la anterior. `imagen` no está en $fillable:
     * se asigna explícitamente para evitar mass-assignment de rutas arbitrarias.
     */
    private function guardarImagen(Request $request, \App\Models\Negocio $negocio): void
    {
        if (! $request->hasFile('imagen')) {
            return;
        }

        if ($negocio->imagen) {
            Storage::disk('public')->delete($negocio->imagen);
        }

        $negocio->imagen = $request->file('imagen')->store('negocios', 'public');
        $negocio->save();
    }
}
