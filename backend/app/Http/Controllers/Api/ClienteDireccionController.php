<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClienteDireccionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $direcciones = $request->user()
            ->clienteDirecciones()
            ->orderByDesc('es_principal')
            ->latest()
            ->get()
            ->map(fn ($d) => $this->map($d));

        return response()->json(['direcciones' => $direcciones]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasRole('usuario')) {
            return response()->json(['message' => 'Solo los clientes pueden agregar ubicaciones.'], 403);
        }

        $data = $request->validate([
            'direccion' => ['required', 'string', 'max:255'],
            'barrio' => ['required', 'string', 'max:120'],
        ]);

        $direccion = $request->user()->clienteDirecciones()->create([
            'direccion' => $data['direccion'],
            'barrio' => $data['barrio'],
            'es_principal' => false,
        ]);

        return response()->json(['direccion' => $this->map($direccion)], 201);
    }

    private function map($direccion): array
    {
        return [
            'id' => $direccion->id,
            'direccion' => $direccion->direccion,
            'barrio' => $direccion->barrio,
            'es_principal' => (bool) $direccion->es_principal,
        ];
    }
}
