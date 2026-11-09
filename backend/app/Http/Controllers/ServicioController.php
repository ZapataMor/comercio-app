<?php

namespace App\Http\Controllers;

use App\Models\Negocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServicioController extends Controller
{
    private function autorizar(Request $request, Negocio $negocio): void
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403, 'No tienes acceso a este negocio.');
    }

    private function datos(Request $request): array
    {
        foreach (['nombre', 'descripcion'] as $campo) {
            if (is_string($request->input($campo))) {
                $request->merge([$campo => trim($request->input($campo))]);
            }
        }

        return $request->validate(['nombre' => ['required', 'string', 'max:150'], 'descripcion' => ['required', 'string', 'max:5000'], 'disponible' => ['sometimes', 'boolean']]);
    }

    public function index(Request $request, Negocio $negocio): JsonResponse
    {
        $this->autorizar($request, $negocio);

        return response()->json(['servicios' => $negocio->servicios()->orderBy('nombre')->get()]);
    }

    public function store(Request $request, Negocio $negocio): JsonResponse
    {
        $this->autorizar($request, $negocio);

        return response()->json(['servicio' => $negocio->servicios()->create($this->datos($request))], 201);
    }

    public function update(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $servicio = $negocio->servicios()->findOrFail($id);
        $servicio->update($this->datos($request));

        return response()->json(['servicio' => $servicio]);
    }

    public function destroy(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $negocio->servicios()->findOrFail($id)->delete();

        return response()->json(['message' => 'Servicio eliminado.']);
    }
}
