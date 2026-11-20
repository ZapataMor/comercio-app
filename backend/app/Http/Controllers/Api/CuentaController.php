<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\EliminarCuenta;
use App\Support\GoogleIdToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * La persona elimina su propia cuenta desde la app. Lo confirma con su
 * contraseña o, si tiene Google conectado, eligiendo otra vez esa cuenta de
 * Google (`google_id_token`): quien se registró con Google no tiene contraseña.
 * Ver App\Support\EliminarCuenta para qué se borra y qué se conserva.
 */
class CuentaController extends Controller
{
    public function destroy(Request $request, GoogleIdToken $google): JsonResponse
    {
        $request->validate([
            'google_id_token' => ['sometimes', 'string', 'max:4096'],
            'password' => ['exclude_with:google_id_token', 'present', 'string', 'min:1'],
        ]);

        $user = $request->user();

        if ($request->has('google_id_token')) {
            $cuenta = $google->verificar($request->input('google_id_token'), 'google_id_token');
            if ($user->google_id === null || ! hash_equals($user->google_id, $cuenta['sub'])) {
                throw ValidationException::withMessages([
                    'google_id_token' => ['Elige la cuenta de Google que tienes conectada a Vitrina.'],
                ]);
            }
        } elseif (! Hash::check($request->input('password'), $user->password)) {
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
