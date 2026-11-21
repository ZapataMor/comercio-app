<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ClavePin;
use App\Support\EliminarCuenta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * La persona elimina su propia cuenta desde la app. Lo confirma con su clave
 * de 4 números (ver App\Support\ClavePin: cuenta como un intento).
 * Ver App\Support\EliminarCuenta para qué se borra y qué se conserva.
 */
class CuentaController extends Controller
{
    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        ClavePin::comprobar($user, $request->input('pin'));

        if ($motivo = EliminarCuenta::bloqueo($user)) {
            return response()->json(['message' => $motivo], 409);
        }

        EliminarCuenta::ejecutar($user);

        return response()->json(['message' => 'Tu cuenta fue eliminada.']);
    }
}
