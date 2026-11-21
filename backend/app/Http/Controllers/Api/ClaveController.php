<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Support\ClavePin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * La clave de 4 números desde la app, con la sesión abierta.
 *
 *  - guardar: cambia la clave (pide la actual) y cierra las demás sesiones
 *    (quizá alguien conocía la anterior); la de este teléfono sigue.
 *  - comprobar: antes de una acción delicada en dos pasos (cambiar el
 *    celular), la app revisa la clave primero. Cuenta como un intento.
 */
class ClaveController extends Controller
{
    public function guardar(Request $request): JsonResponse
    {
        $user = $request->user();

        $datos = $request->validate([
            'pin' => ClavePin::reglas(),
        ], [
            'pin.required' => 'Escribe tu clave nueva de 4 números.',
            'pin.confirmed' => 'Las dos claves no coinciden.',
        ]);

        ClavePin::comprobar($user, $request->input('pin_actual'), 'pin_actual');
        if (Hash::check($datos['pin'], $user->pin)) {
            throw ValidationException::withMessages(['pin' => ['La clave nueva es igual a la actual.']]);
        }

        ClavePin::poner($user, $datos['pin']);
        $actual = $user->currentAccessToken();
        $user->tokens()->when($actual instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($actual->getKey()))->delete();

        return response()->json([
            'message' => 'Listo: tu clave cambió.',
            'user' => AuthController::userPayload($user),
        ]);
    }

    public function comprobar(Request $request): JsonResponse
    {
        ClavePin::comprobar($request->user(), $request->input('pin'));

        return response()->json(['message' => 'Clave correcta.']);
    }
}
