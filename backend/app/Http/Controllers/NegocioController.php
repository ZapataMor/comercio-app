<?php

namespace App\Http\Controllers;

use App\Http\Resources\NegocioResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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

        return response()->json(['negocio' => new NegocioResource($negocio)]);
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
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo' => ['sometimes', 'boolean'],
            'imagen' => ['sometimes', 'image', 'max:4096'], // máx 4 MB
        ]);

        // Se crea ligado al usuario autenticado: imposible crearlo para otro.
        $negocio = $request->user()->negocio()->create($data);

        $this->guardarImagen($request, $negocio);

        return response()->json(['negocio' => new NegocioResource($negocio)], 201);
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
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo' => ['sometimes', 'boolean'],
            'imagen' => ['sometimes', 'image', 'max:4096'],
        ]);

        $negocio->update($data);

        $this->guardarImagen($request, $negocio);

        return response()->json(['negocio' => new NegocioResource($negocio)]);
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
