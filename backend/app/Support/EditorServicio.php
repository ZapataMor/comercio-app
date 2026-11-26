<?php

namespace App\Support;

use App\Models\Negocio;
use App\Models\Servicio;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Crear o editar un servicio del negocio con sus fotos. Lo comparten la API
 * de la app (ServicioController) y el panel web (Catálogo), así las dos
 * aplican las mismas reglas.
 */
class EditorServicio
{
    public const MAX_FOTOS = 8;

    public static function datos(Request $request, ?Servicio $servicio = null): array
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
            'nombre' => ['required', 'string', 'max:150'],
            'descripcion' => ['required', 'string', 'max:5000'],
            'disponible' => ['sometimes', 'boolean'],
            'duracion_minutos' => ['sometimes', 'integer', 'min:5', 'max:480'],
            'permite_citas' => ['sometimes', 'boolean'],
            'precio' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'imagenes' => ['sometimes', 'array', 'max:'.self::MAX_FOTOS],
            'imagenes.*' => ['image', 'max:4096'],
            'conservar_imagenes' => ['sometimes', 'array', 'max:'.self::MAX_FOTOS],
            'conservar_imagenes.*' => ['string', Rule::in($servicio?->galeria ?? [])],
        ], [], [
            'nombre' => 'nombre', 'descripcion' => 'descripción', 'duracion_minutos' => 'duración',
            'precio' => 'precio', 'imagenes' => 'fotos', 'imagenes.*' => 'foto',
        ]);
    }

    public static function guardar(Request $request, Negocio $negocio, ?Servicio $servicio = null): Servicio
    {
        $datos = self::datos($request, $servicio);
        $anteriores = $servicio?->galeria ?? [];
        $conservar = $datos['conservar_imagenes'] ?? $anteriores;
        $imagenes = $request->file('imagenes', []);
        abort_if(count($conservar) + count($imagenes) > self::MAX_FOTOS, 422, 'Puedes mostrar hasta '.self::MAX_FOTOS.' fotografías por servicio.');
        unset($datos['conservar_imagenes'], $datos['imagenes']);

        $servicio ??= $negocio->servicios()->make();
        $servicio->fill($datos);
        foreach ($imagenes as $imagen) {
            $conservar[] = FotoOptimizada::guardar($imagen, 'servicios');
        }
        $servicio->galeria = array_values($conservar);
        $servicio->save();

        foreach (array_diff($anteriores, $conservar) as $eliminada) {
            Storage::disk('public')->delete(substr($eliminada, strlen('/storage/')));
        }

        return $servicio;
    }
}
