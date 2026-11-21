<?php

namespace App\Support;

use App\Models\DispositivoConfianza;
use App\Models\User;
use App\Rules\ClaveCuatro;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * La clave de 4 números de cada cuenta (como Nequi) y los teléfonos de
 * confianza.
 *
 * Una clave tan corta solo es segura con dos protecciones:
 *  - Se bloquea a los 5 intentos fallidos seguidos (contando el login y las
 *    acciones que la piden). Se desbloquea creando una nueva con el código
 *    de WhatsApp o con Google («¿Olvidaste tu clave?»).
 *  - Con el celular y la clave solo se entra en un teléfono de confianza.
 *    En uno nuevo se pide además el código de WhatsApp (una sola vez): el
 *    número del cliente no es secreto (lo ven el negocio y el domiciliario).
 *
 * Un teléfono queda de confianza cuando la persona demuestra quién es en él:
 * al registrarse, con el código de WhatsApp o con Google. La app guarda el
 * token que se le entrega; aquí solo queda su huella (sha256). Vence a los
 * DIAS_DISPOSITIVO días sin usarse.
 */
class ClavePin
{
    public const MAX_FALLIDOS = 5;

    public const DIAS_DISPOSITIVO = 180;

    /** Teléfonos de confianza que se conservan por cuenta (los más recientes). */
    public const MAX_DISPOSITIVOS = 10;

    /** Reglas para crear una clave: 4 números difíciles de adivinar, escritos dos veces. */
    public static function reglas(): array
    {
        return ['required', 'string', new ClaveCuatro, 'confirmed'];
    }

    /**
     * Revisa la clave de la cuenta. Un error suma un intento; al quinto se
     * bloquea. Debe llamarse fuera de transacciones: el contador se guarda
     * aunque la petición termine en error.
     *
     * @throws ValidationException si no coincide o la cuenta aún no tiene clave
     * @throws HttpResponseException 423 (`codigo: clave_bloqueada`) si está bloqueada
     */
    public static function comprobar(User $user, mixed $pin, string $campo = 'pin'): void
    {
        if ($user->pin === null) {
            throw ValidationException::withMessages([
                $campo => ['Aún no tienes clave de 4 números. Créala para continuar.'],
            ]);
        }

        if ($user->pin_bloqueado_at !== null) {
            throw self::bloqueada($campo);
        }

        if (! is_string($pin) || $pin === '') {
            throw ValidationException::withMessages([$campo => ['Escribe tu clave de 4 números.']]);
        }

        if (! preg_match('/\A\d{4}\z/', $pin) || ! Hash::check($pin, $user->pin)) {
            // Incremento atómico: dos intentos a la vez cuentan como dos.
            User::whereKey($user->id)->increment('pin_fallidos');
            $fallidos = (int) User::whereKey($user->id)->value('pin_fallidos');
            self::sincronizar($user, ['pin_fallidos' => $fallidos]);

            if ($fallidos >= self::MAX_FALLIDOS) {
                $ahora = now();
                User::whereKey($user->id)->whereNull('pin_bloqueado_at')->update(['pin_bloqueado_at' => $ahora]);
                self::sincronizar($user, ['pin_bloqueado_at' => $ahora]);

                throw self::bloqueada($campo);
            }

            $quedan = self::MAX_FALLIDOS - $fallidos;
            throw ValidationException::withMessages([
                $campo => [$quedan === 1
                    ? 'La clave no es correcta. Te queda 1 intento antes de que se bloquee.'
                    : "La clave no es correcta. Te quedan {$quedan} intentos."],
            ]);
        }

        if ($user->pin_fallidos > 0) {
            User::whereKey($user->id)->update(['pin_fallidos' => 0]);
            self::sincronizar($user, ['pin_fallidos' => 0]);
        }
    }

    /** Pone (o cambia) la clave y la desbloquea. */
    public static function poner(User $user, string $pin): void
    {
        $user->forceFill([
            'pin' => $pin, // se cifra sola (cast 'hashed')
            'pin_fallidos' => 0,
            'pin_bloqueado_at' => null,
        ])->save();
    }

    /**
     * Clave nueva después de «¿Olvidaste tu clave?» (código de WhatsApp o
     * Google): por seguridad se cierran las sesiones abiertas y los demás
     * teléfonos dejan de ser de confianza (quizá alguien conocía la anterior).
     */
    public static function restablecer(User $user, string $pin): void
    {
        self::poner($user, $pin);
        $user->tokens()->delete();
        $user->dispositivosConfianza()->delete();
    }

    /** Error 423 de clave bloqueada (la app ofrece desbloquearla). */
    public static function bloqueada(string $campo = 'pin'): HttpResponseException
    {
        $mensaje = 'Tu clave quedó bloqueada por intentos fallidos. Desbloquéala creando una nueva con «¿Olvidaste tu clave?».';

        return new HttpResponseException(response()->json([
            'message' => $mensaje,
            'codigo' => 'clave_bloqueada',
            'errors' => [$campo => [$mensaje]],
        ], 423));
    }

    // ---------------- Teléfonos de confianza ----------------

    /**
     * Marca el teléfono de la petición como de confianza para la cuenta y
     * devuelve el token que la app debe guardar. Si la app ya traía uno
     * válido de esta cuenta, lo reutiliza.
     */
    public static function confiar(User $user, ?string $nombre = null, ?string $actual = null): string
    {
        if ($actual !== null && self::esDeConfianza($user, $actual)) {
            return $actual;
        }

        $token = Str::random(48);
        DispositivoConfianza::create([
            'user_id' => $user->id,
            'token' => hash('sha256', $token),
            'nombre' => filled($nombre) ? Str::limit(trim($nombre), 77) : null,
            'ultimo_uso_at' => now(),
        ]);

        // Solo los más recientes: un teléfono que reinstala la app crea otro.
        $viejos = $user->dispositivosConfianza()->orderByDesc('ultimo_uso_at')->orderByDesc('id')
            ->skip(self::MAX_DISPOSITIVOS)->take(PHP_INT_MAX)->pluck('id');
        if ($viejos->isNotEmpty()) {
            DispositivoConfianza::whereIn('id', $viejos)->delete();
        }

        return $token;
    }

    /** El teléfono de confianza de ese token, si sigue vigente (con su cuenta cargada). */
    public static function dispositivo(mixed $token): ?DispositivoConfianza
    {
        if (! is_string($token) || $token === '' || strlen($token) > 100) {
            return null;
        }

        $dispositivo = DispositivoConfianza::with('user')->where('token', hash('sha256', $token))->first();
        if (! $dispositivo || ! $dispositivo->user || $dispositivo->user->eliminado_at !== null) {
            return null;
        }
        $usado = $dispositivo->ultimo_uso_at ?? $dispositivo->created_at;
        if ($usado->lt(now()->subDays(self::DIAS_DISPOSITIVO))) {
            $dispositivo->delete();

            return null;
        }

        return $dispositivo;
    }

    public static function esDeConfianza(User $user, mixed $token): bool
    {
        return self::dispositivo($token)?->user_id === $user->id;
    }

    /** Anota que el teléfono se acaba de usar para entrar (para el vencimiento). */
    public static function usar(string $token): void
    {
        DispositivoConfianza::where('token', hash('sha256', $token))->update(['ultimo_uso_at' => now()]);
    }

    /** Copia en el modelo lo que ya se guardó con una consulta, sin dejarlo "sucio". */
    private static function sincronizar(User $user, array $valores): void
    {
        $user->forceFill($valores)->syncOriginalAttributes(array_keys($valores));
    }
}
