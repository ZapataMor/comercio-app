<?php

namespace App\Http\Controllers;

use App\Models\Negocio;
use App\Models\Servicio;
use App\Support\EditorServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ServicioController extends Controller
{
    private function autorizar(Request $request, Negocio $negocio): void
    {
        abort_unless(($request->isMethod('get') ? $negocio->esMiembroActivo($request->user()) : $negocio->puede($request->user(), 'modificar_inventario')), 403, 'No tienes acceso a este negocio.');
    }

    /** Las reglas están en EditorServicio (las comparte el panel web). */
    private function guardar(Request $request, Negocio $negocio, ?Servicio $servicio = null): Servicio
    {
        return EditorServicio::guardar($request, $negocio, $servicio);
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
        foreach ($imagenes as $imagen) {
            Storage::disk('public')->delete(substr($imagen, strlen('/storage/')));
        }

        return response()->json(['message' => 'Servicio eliminado.']);
    }
}
