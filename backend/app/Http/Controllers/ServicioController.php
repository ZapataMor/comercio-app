<?php

namespace App\Http\Controllers;

use App\Models\Negocio;
use App\Models\Servicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ServicioController extends Controller
{
    private function autorizar(Request $request, Negocio $negocio): void
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403, 'No tienes acceso a este negocio.');
    }

    private function datos(Request $request, ?Servicio $servicio = null): array
    {
        if (is_string($request->input('conservar_imagenes'))) {
            $request->merge(['conservar_imagenes' => json_decode($request->input('conservar_imagenes'), true)]);
        }
        foreach (['nombre', 'descripcion'] as $campo) {
            if (is_string($request->input($campo))) {
                $request->merge([$campo => trim($request->input($campo))]);
            }
        }

        return $request->validate([
            'nombre' => ['required', 'string', 'max:150'], 'descripcion' => ['required', 'string', 'max:5000'],
            'disponible' => ['sometimes', 'boolean'], 'duracion_minutos' => ['sometimes', 'integer', 'min:5', 'max:480'],
            'permite_citas' => ['sometimes', 'boolean'], 'precio' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'imagenes' => ['sometimes', 'array', 'max:8'], 'imagenes.*' => ['image', 'max:4096'],
            'conservar_imagenes' => ['sometimes', 'array', 'max:8'],
            'conservar_imagenes.*' => ['string', Rule::in($servicio?->galeria ?? [])],
        ]);
    }

    private function guardar(Request $request, Negocio $negocio, ?Servicio $servicio = null): Servicio
    {
        $datos = $this->datos($request, $servicio);
        $anteriores = $servicio?->galeria ?? [];
        $conservar = $datos['conservar_imagenes'] ?? $anteriores;
        $imagenes = $request->file('imagenes', []);
        abort_if(count($conservar) + count($imagenes) > 8, 422, 'Puedes mostrar hasta 8 fotografías por servicio.');
        unset($datos['conservar_imagenes'], $datos['imagenes']);
        $servicio ??= $negocio->servicios()->make();
        $servicio->fill($datos);
        foreach ($imagenes as $imagen) $conservar[] = '/storage/'.$imagen->store('servicios', 'public');
        $servicio->galeria = array_values($conservar);
        $servicio->save();
        foreach (array_diff($anteriores, $conservar) as $eliminada) Storage::disk('public')->delete(substr($eliminada, strlen('/storage/')));

        return $servicio;
    }

    public function index(Request $request, Negocio $negocio): JsonResponse
    {
        $this->autorizar($request, $negocio);

        return response()->json(['servicios' => $negocio->servicios()->orderBy('nombre')->get()]);
    }

    public function store(Request $request, Negocio $negocio): JsonResponse
    {
        $this->autorizar($request, $negocio);

        return response()->json(['servicio' => $this->guardar($request, $negocio)], 201);
    }

    public function update(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $servicio = $negocio->servicios()->findOrFail($id);
        $servicio = $this->guardar($request, $negocio, $servicio);

        return response()->json(['servicio' => $servicio]);
    }

    public function destroy(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $servicio = $negocio->servicios()->findOrFail($id);
        $imagenes = $servicio->galeria ?? [];
        $servicio->delete();
        foreach ($imagenes as $imagen) Storage::disk('public')->delete(substr($imagen, strlen('/storage/')));

        return response()->json(['message' => 'Servicio eliminado.']);
    }
}
