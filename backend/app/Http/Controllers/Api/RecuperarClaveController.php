<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\CodigoRecuperacionClave;
use App\Support\Telefono\CodigosTelefono;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * "Olvidé mi contraseña" para la app: un código de 6 dígitos (más cómodo en
 * el teléfono que un enlace) que llega por correo o, si la persona escribe
 * su celular verificado, por WhatsApp.
 *
 * Por correo el código se guarda cifrado en `password_reset_tokens`, vence a
 * los 15 minutos y se anula tras 5 intentos fallidos. Por celular lo maneja
 * CodigosTelefono (10 minutos, 5 intentos). Las respuestas nunca revelan si
 * un correo o un número está registrado.
 */
class RecuperarClaveController extends Controller
{
    public const MINUTOS_VIGENCIA = 15;

    private const MAX_INTENTOS = 5;

    public function __construct(private CodigosTelefono $codigos) {}

    public function enviarCodigo(Request $request): JsonResponse
    {
        if ($request->filled('telefono') && ! $request->filled('email')) {
            return $this->enviarCodigoTelefono($request);
        }

        $datos = $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        $user = User::where('email', $datos['email'])
            ->whereNull('eliminado_at')
            ->whereNull('suspendido_at')
            ->first();

        if ($user) {
            $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $user->email],
                ['token' => Hash::make($codigo), 'created_at' => now()],
            );
            RateLimiter::clear($this->llaveIntentos($user->email));

            try {
                $user->notify(new CodigoRecuperacionClave($codigo));
            } catch (\Throwable $e) {
                Log::error('No se pudo enviar el código de recuperación: '.$e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Si el correo está registrado, te enviamos un código. Revisa también la carpeta de spam.',
        ]);
    }

    public function restablecer(Request $request): JsonResponse
    {
        if ($request->filled('telefono') && ! $request->filled('email')) {
            return $this->restablecerConTelefono($request);
        }

        $datos = $request->validate([
            'email' => ['required', 'string', 'email'],
            'codigo' => ['required', 'digits:6'],
            'password' => ['present', 'string', 'min:5', 'confirmed'],
        ]);

        $llave = $this->llaveIntentos($datos['email']);
        $registro = DB::table('password_reset_tokens')->where('email', $datos['email'])->first();

        $vencido = ! $registro
            || now()->diffInMinutes($registro->created_at, true) > self::MINUTOS_VIGENCIA
            || RateLimiter::tooManyAttempts($llave, self::MAX_INTENTOS);

        if ($vencido) {
            DB::table('password_reset_tokens')->where('email', $datos['email'])->delete();

            throw ValidationException::withMessages([
                'codigo' => ['El código venció o ya no sirve. Pide uno nuevo.'],
            ]);
        }

        if (! Hash::check($datos['codigo'], $registro->token)) {
            RateLimiter::hit($llave, self::MINUTOS_VIGENCIA * 60);

            throw ValidationException::withMessages([
                'codigo' => ['El código no es correcto.'],
            ]);
        }

        $user = User::where('email', $datos['email'])->whereNull('eliminado_at')->firstOrFail();
        $this->ponerClave($user, $datos['password']);
        DB::table('password_reset_tokens')->where('email', $datos['email'])->delete();
        RateLimiter::clear($llave);

        return response()->json(['message' => 'Listo. Ya puedes entrar con tu contraseña nueva.']);
    }

    private function enviarCodigoTelefono(Request $request): JsonResponse
    {
        $telefono = $this->telefono($request);
        $user = CodigosTelefono::cuentaConTelefono($telefono);
        $codigoPrueba = null;

        if ($user && $user->suspendido_at === null) {
            try {
                $codigoPrueba = $this->codigos->enviar($telefono, CodigosTelefono::CLAVE, $user->id);
            } catch (ValidationException $e) {
                // Espera entre envíos o WhatsApp falló: la respuesta sigue
                // siendo la misma para no revelar que el número tiene cuenta.
                Log::warning('Código de recuperación por WhatsApp no enviado: '.collect($e->errors())->flatten()->first());
            }
        }

        return response()->json(array_filter([
            'message' => 'Si el número tiene una cuenta, te enviamos un código por WhatsApp.',
            'codigo_prueba' => $codigoPrueba,
        ], fn ($v) => $v !== null));
    }

    private function restablecerConTelefono(Request $request): JsonResponse
    {
        $telefono = $this->telefono($request);
        $datos = $request->validate([
            'codigo' => ['required', 'digits:6'],
            'password' => ['present', 'string', 'min:5', 'confirmed'],
        ]);

        $user = CodigosTelefono::cuentaConTelefono($telefono);
        if (! $user) {
            throw ValidationException::withMessages([
                'codigo' => ['El código venció o ya no sirve. Pide uno nuevo.'],
            ]);
        }

        $this->codigos->comprobar($telefono, CodigosTelefono::CLAVE, $datos['codigo'], $user->id);
        $this->ponerClave($user, $datos['password']);

        return response()->json(['message' => 'Listo. Ya puedes entrar con tu contraseña nueva.']);
    }

    private function ponerClave(User $user, string $password): void
    {
        $user->password = $password; // se hashea solo (cast 'hashed')
        $user->save();

        // Por seguridad se cierran las sesiones abiertas en otros teléfonos.
        $user->tokens()->delete();
    }

    private function telefono(Request $request): string
    {
        $request->merge(['telefono' => CodigosTelefono::normalizar($request->input('telefono')) ?? $request->input('telefono')]);

        return $request->validate(['telefono' => ['required', 'string', new \App\Rules\Telefono]])['telefono'];
    }

    private function llaveIntentos(string $email): string
    {
        return 'recuperar-clave:'.mb_strtolower($email);
    }
}
