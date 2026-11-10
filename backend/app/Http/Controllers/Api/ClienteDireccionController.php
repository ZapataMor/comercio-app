<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barrio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'nombre' => ['nullable', 'string', 'max:80'],
            'direccion' => ['required', 'string', 'max:255'],
            'barrio' => ['required', 'string', 'max:120'],
        ]);

        // Barrio escrito a mano → sugerencia pendiente para el admin.
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);

        $direccion = $request->user()->clienteDirecciones()->create([
            'nombre' => $data['nombre'] ?? null,
            'direccion' => $data['direccion'],
            'barrio' => $data['barrio'],
            'es_principal' => false,
        ]);

        return response()->json(['direccion' => $this->map($direccion)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->hasRole('usuario'), 403);
        $direccion = $request->user()->clienteDirecciones()->findOrFail($id);
        $data = $request->validate([
            'nombre' => ['nullable', 'string', 'max:80'],
            'direccion' => ['required', 'string', 'max:255'],
            'barrio' => ['required', 'string', 'max:120'],
        ]);
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);
        DB::transaction(function () use ($request, $direccion, $data) {
            $direccion->update($data);
            if ($direccion->es_principal) {
                $request->user()->update(['direccion' => $data['direccion'], 'barrio' => $data['barrio']]);
            }
        });

        return response()->json(['direccion' => $this->map($direccion)]);
    }

    private function map($direccion): array
    {
        return [
            'id' => $direccion->id,
            'nombre' => $direccion->nombre,
            'direccion' => $direccion->direccion,
            'barrio' => $direccion->barrio,
            'es_principal' => (bool) $direccion->es_principal,
        ];
    }
}
