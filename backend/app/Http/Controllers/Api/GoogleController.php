<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Http\Middleware\CuentaActiva;
use App\Models\User;
use App\Support\GoogleIdToken;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Entrar y registrarse con Google.
 *
 * La app abre el selector de cuentas de Google del teléfono y manda aquí el
 * «ID token» que Google le da (ver App\Support\GoogleIdToken). Con él:
 *
 *   · Si esa cuenta de Google ya está conectada a una de Vitrina, se entra.
 *   · Si el correo ya es de una cuenta de Vitrina que no la tiene conectada,
 *     NO se une sola: en Vitrina el correo no se confirma al registrarse, así
 *     que alguien pudo crear una cuenta con un correo ajeno. La persona entra
 *     con su contraseña y conecta Google desde «Mi información».
 *   · Si no, es una cuenta nueva: la primera respuesta trae los datos de
 *     Google (`nuevo: true`) para que la app pida aceptar la política de
 *     privacidad y revisar el nombre; la segunda, con `acepta_terminos`, la crea.
 *
 * Las cuentas creadas con Google no tienen contraseña (pueden crear una en
 * «Mi información») ni celular verificado: el teléfono se pide en el primer
 * pedido o al hacerse domiciliario, como a cualquier cliente.
 */
class GoogleController extends Controller
{
    public function entrar(Request $request, GoogleIdToken $google): JsonResponse
    {
        $request->validate(['id_token' => ['required', 'string', 'max:4096']]);
        $cuenta = $google->verificar($request->input('id_token'));

        $user = User::where('google_id', $cuenta['sub'])->first();
        if ($user) {
            return $this->sesion($user);
        }

        if (User::where('email', $cuenta['email'])->exists()) {
            return response()->json([
                'message' => "Ya tienes una cuenta de Vitrina con {$cuenta['email']}. Entra con tu celular o correo y tu contraseña, y conecta Google desde Mi información.",
                'codigo' => 'correo_existente',
            ], 409);
        }

        if (! $request->boolean('acepta_terminos')) {
            return response()->json([
                'nuevo' => true,
                'perfil' => [
                    'name' => $cuenta['nombre'],
                    'apellidos' => $cuenta['apellidos'],
                    'email' => $cuenta['email'],
                ],
            ]);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'apellidos' => ['required', 'string', 'max:255'],
            // Autorización previa del tratamiento de datos (Ley 1581 de 2012).
            'acepta_terminos' => ['accepted'],
        ], [
            'acepta_terminos.accepted' => 'Debes aceptar la política de privacidad para crear la cuenta.',
        ]);

        try {
            $user = DB::transaction(function () use ($data, $cuenta) {
                $user = User::create([
                    'name' => trim($data['name']),
                    'apellidos' => trim($data['apellidos']),
                    'email' => $cuenta['email'],
                    'password' => null,
                ]);
                // Google ya confirmó el correo.
                $user->forceFill([
                    'google_id' => $cuenta['sub'],
                    'email_verified_at' => now(),
                    'terminos_aceptados_at' => now(),
                ])->save();
                $user->assignRole('usuario');

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            // Dos toques seguidos: la otra petición ya la creó.
            $user = User::where('google_id', $cuenta['sub'])->first();
            if (! $user) {
                throw ValidationException::withMessages(['id_token' => ['Ese correo ya tiene una cuenta. Entra con tu contraseña.']]);
            }

            return $this->sesion($user);
        }

        return $this->sesion($user, 201);
    }

    /** Conecta una cuenta de Google a la cuenta con que se entró (desde «Mi información»). */
    public function conectar(Request $request, GoogleIdToken $google): JsonResponse
    {
        $request->validate(['id_token' => ['required', 'string', 'max:4096']]);
        $cuenta = $google->verificar($request->input('id_token'));
        $user = $request->user();

        if (User::where('google_id', $cuenta['sub'])->whereKeyNot($user->id)->exists()) {
            throw ValidationException::withMessages([
                'id_token' => ['Esa cuenta de Google ya está conectada a otra cuenta de Vitrina.'],
            ]);
        }

        $user->forceFill(['google_id' => $cuenta['sub']]);
        // Sin correo, el de Google sirve para entrar y recuperar la contraseña.
        if (blank($user->email) && ! User::where('email', $cuenta['email'])->exists()) {
            $user->forceFill(['email' => $cuenta['email'], 'email_verified_at' => now()]);
        }
        $user->save();

        return response()->json([
            'message' => 'Listo: ya puedes entrar con Google.',
            'user' => AuthController::userPayload($user),
        ]);
    }

    /** Deja de entrar con Google. Exige tener contraseña: si no, no podría volver a entrar. */
    public function desconectar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->password === null) {
            throw ValidationException::withMessages([
                'google' => ['Crea una contraseña antes de desconectar Google: sin ella no podrías volver a entrar.'],
            ]);
        }

        $user->forceFill(['google_id' => null])->save();

        return response()->json([
            'message' => 'Google quedó desconectado de tu cuenta.',
            'user' => AuthController::userPayload($user),
        ]);
    }

    private function sesion(User $user, int $estado = 200): JsonResponse
    {
        if ($user->suspendido_at !== null) {
            throw ValidationException::withMessages([
                'id_token' => [CuentaActiva::mensajeSuspension($user)],
            ]);
        }

        return response()->json([
            'user' => AuthController::userPayload($user),
            'token' => $user->createToken('api')->plainTextToken,
        ], $estado);
    }
}
