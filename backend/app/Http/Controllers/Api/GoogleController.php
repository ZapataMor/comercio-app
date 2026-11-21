<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ClavePin;
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
 *   · Si esa cuenta de Google ya está conectada a una de Vitrina, falta la
 *     clave de 4 números: la primera respuesta trae `requiere_pin` y la app
 *     vuelve a mandar el mismo token con `pin`. Google demuestra quién es,
 *     así que el teléfono queda de confianza. (Las cuentas que aún no tienen
 *     clave entran y la app les pide crearla.)
 *   · Si el correo ya es de una cuenta de Vitrina que no la tiene conectada,
 *     NO se une sola: en Vitrina el correo no se confirma al registrarse, así
 *     que alguien pudo crear una cuenta con un correo ajeno. La persona entra
 *     con su celular y su clave y conecta Google desde «Mi información».
 *   · Si no, es una cuenta nueva: la primera respuesta trae los datos de
 *     Google (`nuevo: true`) para que la app pida aceptar la política de
 *     privacidad, revisar el nombre y crear la clave; la segunda, con
 *     `acepta_terminos` y `pin`, la crea.
 *
 * Las cuentas creadas con Google no tienen contraseña ni celular verificado:
 * la app les ofrece agregar el celular, y se pide en el primer pedido o al
 * hacerse domiciliario, como a cualquier cliente.
 */
class GoogleController extends Controller
{
    public function entrar(Request $request, GoogleIdToken $google): JsonResponse
    {
        $request->validate([
            'id_token' => ['required', 'string', 'max:4096'],
            'pin' => ['nullable', 'string'],
            'dispositivo' => ['nullable', 'string', 'max:100'],
            'nombre_dispositivo' => ['nullable', 'string', 'max:80'],
        ]);
        $cuenta = $google->verificar($request->input('id_token'));

        $user = User::where('google_id', $cuenta['sub'])->first();
        if ($user) {
            AuthController::asegurarActiva($user, 'id_token');
            if ($user->pin !== null) {
                if (! $request->filled('pin')) {
                    return response()->json([
                        'requiere_pin' => true,
                        'user' => ['id' => $user->id, 'name' => $user->name, 'apellidos' => $user->apellidos],
                    ]);
                }
                ClavePin::comprobar($user, $request->input('pin'));
            }

            return $this->sesion($user, $request);
        }

        if (User::where('email', $cuenta['email'])->exists()) {
            return response()->json([
                'message' => "Ya tienes una cuenta de Vitrina con {$cuenta['email']}. Entra con tu celular y tu clave (o tu contraseña, si tu cuenta es de antes) y conecta Google desde Mi información.",
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
            'pin' => ClavePin::reglas(),
        ], [
            'acepta_terminos.accepted' => 'Debes aceptar la política de privacidad para crear la cuenta.',
            'pin.required' => 'Crea tu clave de 4 números.',
            'pin.confirmed' => 'Las dos claves no coinciden.',
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
                    'pin' => $data['pin'], // se cifra sola (cast 'hashed')
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
                throw ValidationException::withMessages(['id_token' => ['Ese correo ya tiene una cuenta. Entra con tu celular y tu clave.']]);
            }

            return $this->sesion($user, $request);
        }

        return $this->sesion($user, $request, 201);
    }

    /**
     * «¿Olvidaste tu clave?» con Google: elige la cuenta de Google conectada
     * y crea una clave nueva (también desbloquea la clave). Como al
     * restablecerla con WhatsApp, se cierran las demás sesiones.
     */
    public function restablecerClave(Request $request, GoogleIdToken $google): JsonResponse
    {
        $datos = $request->validate([
            'id_token' => ['required', 'string', 'max:4096'],
            'pin' => ClavePin::reglas(),
            'nombre_dispositivo' => ['nullable', 'string', 'max:80'],
        ], [
            'pin.required' => 'Escribe tu clave nueva de 4 números.',
            'pin.confirmed' => 'Las dos claves no coinciden.',
        ]);
        $cuenta = $google->verificar($datos['id_token']);

        $user = User::where('google_id', $cuenta['sub'])->whereNull('eliminado_at')->first();
        if (! $user) {
            throw ValidationException::withMessages([
                'id_token' => ['Esa cuenta de Google no está conectada a ninguna cuenta de Vitrina.'],
            ]);
        }
        AuthController::asegurarActiva($user, 'id_token');

        ClavePin::restablecer($user, $datos['pin']);

        return AuthController::sesion($user, ClavePin::confiar($user, $datos['nombre_dispositivo'] ?? null), 200, [
            'message' => 'Listo: tu clave nueva quedó guardada.',
        ]);
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
        // Sin correo, el de Google queda como su correo (ya confirmado por Google).
        if (blank($user->email) && ! User::where('email', $cuenta['email'])->exists()) {
            $user->forceFill(['email' => $cuenta['email'], 'email_verified_at' => now()]);
        }
        $user->save();

        return response()->json([
            'message' => 'Listo: ya puedes entrar con Google.',
            'user' => AuthController::userPayload($user),
        ]);
    }

    /**
     * Deja de entrar con Google. Pide la clave, y exige el celular verificado:
     * sin él no podría volver a entrar desde otro teléfono.
     */
    public function desconectar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->telefono_verificado_at === null) {
            throw ValidationException::withMessages([
                'google' => ['Verifica tu celular antes de desconectar Google: sin él no podrías entrar desde otro teléfono.'],
            ]);
        }
        ClavePin::comprobar($user, $request->input('pin'));

        $user->forceFill(['google_id' => null])->save();

        return response()->json([
            'message' => 'Google quedó desconectado de tu cuenta.',
            'user' => AuthController::userPayload($user),
        ]);
    }

    /** Abre la sesión; Google ya demostró quién es, así que el teléfono queda de confianza. */
    private function sesion(User $user, Request $request, int $estado = 200): JsonResponse
    {
        AuthController::asegurarActiva($user, 'id_token');

        $dispositivo = ClavePin::confiar($user, $request->input('nombre_dispositivo'), $request->input('dispositivo'));

        return AuthController::sesion($user, $dispositivo, $estado);
    }
}
