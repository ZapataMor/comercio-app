<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\RutaCalles;
use App\Support\TiempoEntrega;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use RuntimeException;

class RutaController extends Controller
{
    /**
     * Ruta por calles para «Cómo llegar» (domiciliario o cliente), dentro de
     * la app. Va por POST para que la posición de la persona no quede en los
     * registros de acceso del servidor (allí se guarda la URL, no el cuerpo).
     */
    public function __invoke(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'desde_lat' => ['required', 'numeric', 'between:-90,90'],
            'desde_lng' => ['required', 'numeric', 'between:-180,180'],
            'hasta_lat' => ['required', 'numeric', 'between:-90,90'],
            'hasta_lng' => ['required', 'numeric', 'between:-180,180'],
            'modo' => ['sometimes', Rule::in(RutaCalles::MODOS)],
        ]);

        $desde = ['lat' => (float) $datos['desde_lat'], 'lng' => (float) $datos['desde_lng']];
        $hasta = ['lat' => (float) $datos['hasta_lat'], 'lng' => (float) $datos['hasta_lng']];

        if (TiempoEntrega::km($desde['lat'], $desde['lng'], $hasta['lat'], $hasta['lng']) > RutaCalles::MAX_KM) {
            return response()->json(['message' => 'El destino está demasiado lejos para trazar la ruta.'], 422);
        }

        try {
            $ruta = RutaCalles::calcular($desde, $hasta, $datos['modo'] ?? 'moto');
        } catch (ConnectionException|RuntimeException $e) {
            // Un servidor de rutas caído no es un fallo de la app: no va a Sentry.
            Log::warning('Rutas: '.$e->getMessage());

            return response()->json(['message' => 'No pudimos trazar la ruta en este momento.'], 503);
        }

        if ($ruta === null) {
            return response()->json(['message' => 'No encontramos un camino por calles hasta ese punto.'], 422);
        }

        return response()->json($ruta);
    }
}
