<?php

namespace App\Http\Controllers;

use App\Http\Resources\NegocioResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        ]);

        // Se crea ligado al usuario autenticado: imposible crearlo para otro.
        $negocio = $request->user()->negocio()->create($data);

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
        ]);

        $negocio->update($data);

        return response()->json(['negocio' => new NegocioResource($negocio)]);
    }
}
