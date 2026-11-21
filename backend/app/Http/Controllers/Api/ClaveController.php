<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Support\ClavePin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * La clave de 4 números desde la app, con la sesión abierta.
 *
 *  - guardar: la crea (las cuentas de antes no tienen: la app no las deja
 *    seguir sin ella) o la cambia (pide la actual).
 *  - comprobar: antes de una acción delicada en dos pasos (cambiar el
 *    celular), la app revisa la clave primero. Cuenta como un intento.
 */
class ClaveController extends Controller
{
    public function guardar(Request $request): JsonResponse
    {
        $user = $request->user();
        $creando = $user->pin === null;

        $datos = $request->validate([
            'pin' => ClavePin::reglas(),
            'nombre_dispositivo' => ['nullable', 'string', 'max:80'],
        ], [
            'pin.required' => 'Escribe tu clave nueva de 4 números.',
            'pin.confirmed' => 'Las dos claves no coinciden.',
        ]);

        if (! $creando) {
            ClavePin::comprobar($user, $request->input('pin_actual'), 'pin_actual');
            if (Hash::check($datos['pin'], $user->pin)) {
                throw ValidationException::withMessages(['pin' => ['La clave nueva es igual a la actual.']]);
            }
        }

        ClavePin::poner($user, $datos['pin']);

        return response()->json(array_filter([
            'message' => $creando ? 'Listo: tu clave quedó creada.' : 'Listo: tu clave cambió.',
            'user' => AuthController::userPayload($user),
            // Al crearla, este teléfono (donde ya tiene la sesión) queda de
            // confianza: si cierra la sesión, vuelve con «Continuar como».
            'dispositivo' => $creando ? ClavePin::confiar($user, $datos['nombre_dispositivo'] ?? null) : null,
        ], fn ($v) => $v !== null));
    }

    public function comprobar(Request $request): JsonResponse
    {
        ClavePin::comprobar($request->user(), $request->input('pin'));

        return response()->json(['message' => 'Clave correcta.']);
    }
}
