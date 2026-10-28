<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\EliminarCuenta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * La persona elimina su propia cuenta desde la app (exige su contraseña).
 * Ver App\Support\EliminarCuenta para qué se borra y qué se conserva.
 */
class CuentaController extends Controller
{
    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['La contraseña no es correcta.'],
            ]);
        }

        if ($motivo = EliminarCuenta::bloqueo($user)) {
            return response()->json(['message' => $motivo], 409);
        }

        EliminarCuenta::ejecutar($user);

        return response()->json(['message' => 'Tu cuenta fue eliminada.']);
    }
}
