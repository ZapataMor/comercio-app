<?php

namespace App\Support\Telefono;

use App\Models\CodigoTelefono;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Códigos de 6 dígitos que llegan por WhatsApp para confirmar un celular.
 *
 * Propósitos:
 *  - registro: confirma el número antes de crear la cuenta. Al acertar se
 *    entrega un token que /register consume (así el formulario puede fallar
 *    por otra cosa sin gastar otro código).
 *  - clave:    "olvidé mi contraseña" con el celular.
 *  - cambio:   verificar el número desde Mi información.
 *
 * Cada código vence a los 10 minutos y se anula tras 5 intentos fallidos.
 * Entre dos envíos al mismo número hay que esperar 60 segundos; los topes
 * por hora y por día están en AppServiceProvider (límite 'codigo-telefono').
 */
class CodigosTelefono
{
    public const REGISTRO = 'registro';

    public const CLAVE = 'clave';

    public const CAMBIO = 'cambio';

    public const MINUTOS_VIGENCIA = 10;

    public const MINUTOS_TOKEN = 30;

    public const SEGUNDOS_ESPERA = 60;

    public const MAX_INTENTOS = 5;

    public function __construct(private EnviadorCodigos $enviador) {}

    /**
     * Deja el número en 10 dígitos: quita espacios, guiones y el +57.
     * Devuelve null si no parece un celular colombiano.
     */
    public static function normalizar(mixed $valor): ?string
    {
        if (! is_string($valor) && ! is_int($valor)) {
            return null;
        }
        $digitos = preg_replace('/\D+/', '', (string) $valor);
        if (strlen($digitos) === 12 && str_starts_with($digitos, '57')) {
            $digitos = substr($digitos, 2);
        }

        return preg_match('/\A3\d{9}\z/', $digitos) ? $digitos : null;
    }

    /** La cuenta (activa) que tiene este número verificado, si hay una. */
    public static function cuentaConTelefono(string $telefono): ?User
    {
        return User::where('telefono', $telefono)
            ->whereNotNull('telefono_verificado_at')
            ->whereNull('eliminado_at')
            ->first();
    }

    /**
     * Crea un código nuevo (anula el anterior) y lo envía.
     *
     * @return string|null el código, solo con el canal de prueba en local,
     *                     para que la app lo muestre sin abrir el log.
     *
     * @throws ValidationException si hay que esperar o el envío falló.
     */
    public function enviar(string $telefono, string $proposito, ?int $userId = null): ?string
    {
        $anterior = $this->consulta($telefono, $proposito, $userId)->latest('id')->first();
        if ($anterior) {
            $faltan = self::SEGUNDOS_ESPERA - (int) $anterior->created_at->diffInSeconds(now(), true);
            if ($faltan > 0) {
                throw ValidationException::withMessages([
                    'telefono' => ["Espera {$faltan} segundos para pedir otro código."],
                ]);
            }
        }

        $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $fila = DB::transaction(function () use ($telefono, $proposito, $userId, $codigo) {
            $this->consulta($telefono, $proposito, $userId)->delete();

            return CodigoTelefono::create([
                'telefono' => $telefono,
                'proposito' => $proposito,
                'user_id' => $userId,
                'codigo' => Hash::make($codigo),
                'expira_at' => now()->addMinutes(self::MINUTOS_VIGENCIA),
            ]);
        });

        try {
            $this->enviador->enviar($telefono, $codigo);
        } catch (\Throwable $e) {
            $fila->delete();
            report($e);

            throw ValidationException::withMessages([
                'telefono' => ['No pudimos enviarte el código por WhatsApp. Inténtalo de nuevo en unos minutos.'],
            ]);
        }

        return $this->enviador->esDePrueba() && app()->environment('local', 'testing') ? $codigo : null;
    }

    /**
     * Revisa el código y, si es correcto, lo gasta.
     *
     * @throws ValidationException (campo `codigo`) si no sirve.
     */
    public function comprobar(string $telefono, string $proposito, string $codigo, ?int $userId = null): void
    {
        $this->revisar($telefono, $proposito, $codigo, $userId)->delete();
    }

    /**
     * Registro: revisa el código y devuelve el token con el que /register
     * crea la cuenta (vale 30 minutos).
     */
    public function verificarParaRegistro(string $telefono, string $codigo): string
    {
        $fila = $this->revisar($telefono, self::REGISTRO, $codigo, null);
        $token = Str::random(48);
        $fila->forceFill([
            'verificado_at' => now(),
            'token' => hash('sha256', $token),
            'expira_at' => now()->addMinutes(self::MINUTOS_TOKEN),
        ])->save();

        return $token;
    }

    /**
     * Gasta el token de registro. Debe llamarse dentro de la transacción que
     * crea la cuenta, para que dos registros no usen el mismo token.
     *
     * @throws ValidationException (campo `telefono`) si no sirve.
     */
    public function consumirTokenRegistro(string $telefono, string $token): void
    {
        $fila = $this->consulta($telefono, self::REGISTRO, null)
            ->whereNotNull('verificado_at')
            ->lockForUpdate()
            ->latest('id')
            ->first();

        if (! $fila || $fila->expira_at->isPast() || ! hash_equals((string) $fila->token, hash('sha256', $token))) {
            throw ValidationException::withMessages([
                'telefono' => ['Confirma tu número otra vez: la verificación venció.'],
            ]);
        }

        $fila->delete();
    }

    /**
     * Busca el código vigente y lo compara. Un fallo suma un intento; el
     * contador se guarda fuera de cualquier transacción para que la
     * excepción no lo deshaga.
     */
    private function revisar(string $telefono, string $proposito, string $codigo, ?int $userId): CodigoTelefono
    {
        $fila = $this->consulta($telefono, $proposito, $userId)
            ->whereNull('verificado_at')
            ->latest('id')
            ->first();

        if (! $fila || $fila->expira_at->isPast() || $fila->intentos >= self::MAX_INTENTOS) {
            $fila?->delete();

            throw ValidationException::withMessages([
                'codigo' => ['El código venció o ya no sirve. Pide uno nuevo.'],
            ]);
        }

        if (! Hash::check($codigo, $fila->codigo)) {
            // Incremento atómico: dos intentos a la vez no cuentan como uno.
            CodigoTelefono::whereKey($fila->id)->increment('intentos');
            $quedan = self::MAX_INTENTOS - $fila->intentos - 1;

            throw ValidationException::withMessages([
                'codigo' => [$quedan > 0
                    ? 'El código no es correcto.'
                    : 'El código no es correcto y ya no sirve. Pide uno nuevo.'],
            ]);
        }

        return $fila;
    }

    private function consulta(string $telefono, string $proposito, ?int $userId)
    {
        return CodigoTelefono::where('telefono', $telefono)
            ->where('proposito', $proposito)
            ->when($userId === null, fn ($q) => $q->whereNull('user_id'), fn ($q) => $q->where('user_id', $userId));
    }
}
