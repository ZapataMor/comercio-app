<?php

namespace App\Gestion;

use App\Models\AccesoWeb;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Entrada al panel web del negocio con un código aprobado desde la app
 * (ADR-005, decisión 2). La clave de 4 números no sirve para la web.
 *
 * 1. El navegador pide un código (crear) y lo muestra con su QR.
 * 2. En la app, la persona escribe o escanea el código, ve desde qué
 *    navegador se quiere entrar (consultar) y lo aprueba (aprobar).
 * 3. El navegador, que pregunta cada pocos segundos, entra (usar).
 * La fila queda como la sesión web: se puede cerrar desde la app.
 */
final class AccesosWeb
{
    /** Minutos que dura un código sin aprobar. */
    public const MINUTOS_CODIGO = 3;

    /** Horas máximas de una sesión web; después se vuelve a pedir el código. */
    public const HORAS_SESION = 12;

    /** Sin letras ni números que se confunden (0/O, 1/I/L). */
    private const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    private static function codigoNuevo(): string
    {
        do {
            $codigo = '';
            for ($i = 0; $i < 8; $i++) {
                $codigo .= self::ALFABETO[random_int(0, strlen(self::ALFABETO) - 1)];
            }
        } while (AccesoWeb::where('codigo', $codigo)->exists());

        return $codigo;
    }

    public static function crear(Request $request): AccesoWeb
    {
        return AccesoWeb::create([
            'codigo' => self::codigoNuevo(),
            'estado' => 'pendiente',
            'ip' => $request->ip(),
            'navegador' => mb_substr((string) $request->userAgent(), 0, 255),
            'expira_at' => now()->addMinutes(self::MINUTOS_CODIGO),
        ]);
    }

    /** Quita guiones, espacios y el prefijo del QR, y pasa a mayúsculas. */
    public static function normalizar(string $codigo): string
    {
        $codigo = strtoupper(trim($codigo));
        $codigo = preg_replace('/^VITRINA-WEB:/', '', $codigo);

        return preg_replace('/[^A-Z0-9]/', '', $codigo);
    }

    /** El código pendiente y vigente, o un error claro. */
    public static function pendiente(string $codigo): AccesoWeb
    {
        $acceso = AccesoWeb::where('codigo', self::normalizar($codigo))->first();
        if (! $acceso || $acceso->estado !== 'pendiente') {
            throw ValidationException::withMessages(['codigo' => 'Ese código no sirve. Recarga la página de la web y escribe el código nuevo.']);
        }
        if ($acceso->expira_at->isPast()) {
            $acceso->update(['estado' => 'vencido']);
            throw ValidationException::withMessages(['codigo' => 'Ese código ya venció. Recarga la página de la web para ver uno nuevo.']);
        }

        return $acceso;
    }

    /** Lo que la app muestra antes de aprobar. */
    public static function consultar(string $codigo): array
    {
        $acceso = self::pendiente($codigo);

        return [
            'codigo' => $acceso->codigoVisible(),
            'navegador' => self::describirNavegador($acceso->navegador),
            'creado_hace_segundos' => (int) $acceso->created_at->diffInSeconds(now()),
        ];
    }

    public static function aprobar(string $codigo, User $user): AccesoWeb
    {
        $acceso = self::pendiente($codigo);
        if (! self::puedeEntrar($user)) {
            throw ValidationException::withMessages(['codigo' => 'Ninguno de tus negocios tiene el panel web activo. Pídeselo a Vitrina.']);
        }
        $acceso->update(['estado' => 'aprobado', 'user_id' => $user->id, 'aprobado_at' => now()]);

        return $acceso;
    }

    /** El navegador entra: solo una vez y solo si el código ya está aprobado. */
    public static function usar(AccesoWeb $acceso): ?User
    {
        if ($acceso->estado !== 'aprobado' || ! $acceso->user) {
            return null;
        }
        $acceso->update(['estado' => 'usado', 'usado_at' => now(), 'ultimo_uso_at' => now()]);

        return $acceso->user;
    }

    /** ¿Puede usar la web? El administrador de Vitrina, o quien es de un negocio con panel web. */
    public static function puedeEntrar(User $user): bool
    {
        return $user->suspendido_at === null
            && ($user->hasRole('administrador') || Gestion::negociosConWeb($user)->isNotEmpty());
    }

    /** Adónde va al entrar: el administrador a su panel; los demás al del negocio. */
    public static function destino(User $user): string
    {
        return $user->hasRole('administrador') ? route('admin.panel') : route('negocio.inicio');
    }

    /** Sesión web abierta por WhatsApp o Google (sin código que aprobar en la app). */
    public static function crearUsado(Request $request, User $user, string $metodo): AccesoWeb
    {
        return AccesoWeb::create([
            'codigo' => self::codigoNuevo(),
            'estado' => 'usado',
            'metodo' => $metodo,
            'user_id' => $user->id,
            'ip' => $request->ip(),
            'navegador' => mb_substr((string) $request->userAgent(), 0, 255),
            'expira_at' => now(),
            'aprobado_at' => now(),
            'usado_at' => now(),
            'ultimo_uso_at' => now(),
        ]);
    }

    /** Deja al navegador con sesión de esta persona, atada a la fila de la sesión web. */
    public static function iniciarSesion(Request $request, AccesoWeb $acceso): void
    {
        Auth::guard('web')->login($acceso->user);
        $request->session()->regenerate();
        $request->session()->forget(['acceso_web_pendiente', 'negocio_web_id', 'login_celular', 'login_google']);
        $request->session()->put('acceso_web_id', $acceso->id);
    }

    /** ¿La sesión web sigue valiendo? (no se cerró desde la app y no pasó el máximo de horas) */
    public static function sesionVigente(?AccesoWeb $acceso, User $user): bool
    {
        return $acceso
            && $acceso->user_id === $user->id
            && $acceso->estado === 'usado'
            && $acceso->cerrado_at === null
            && $acceso->usado_at?->gt(now()->subHours(self::HORAS_SESION));
    }

    /** Sesiones web abiertas de la persona (para verlas y cerrarlas desde la app). */
    public static function abiertas(User $user): Collection
    {
        return AccesoWeb::where('user_id', $user->id)
            ->where('estado', 'usado')
            ->whereNull('cerrado_at')
            ->where('usado_at', '>', now()->subHours(self::HORAS_SESION))
            ->latest('usado_at')
            ->get();
    }

    public static function cerrar(AccesoWeb $acceso): void
    {
        $acceso->update(['estado' => 'cerrado', 'cerrado_at' => now()]);
    }

    /** «Chrome en Windows», para que la persona reconozca su computador. */
    public static function describirNavegador(?string $agente): string
    {
        $agente = (string) $agente;
        $navegador = match (true) {
            str_contains($agente, 'Edg/') => 'Edge',
            str_contains($agente, 'OPR/') => 'Opera',
            str_contains($agente, 'Firefox/') => 'Firefox',
            str_contains($agente, 'Chrome/') => 'Chrome',
            str_contains($agente, 'Safari/') => 'Safari',
            default => 'Un navegador',
        };
        $sistema = match (true) {
            str_contains($agente, 'Windows') => 'Windows',
            str_contains($agente, 'Android') => 'Android',
            str_contains($agente, 'iPhone') || str_contains($agente, 'iPad') => 'iPhone o iPad',
            str_contains($agente, 'Mac OS') => 'Mac',
            str_contains($agente, 'Linux') => 'Linux',
            default => null,
        };

        return $sistema ? "$navegador en $sistema" : $navegador;
    }

    /** Lo que se muestra de una sesión abierta. */
    public static function resumen(AccesoWeb $acceso): array
    {
        return [
            'id' => $acceso->id,
            'navegador' => self::describirNavegador($acceso->navegador),
            'metodo' => $acceso->metodo,
            'ip' => $acceso->ip,
            'desde' => $acceso->usado_at?->toIso8601String(),
            'ultimo_uso' => ($acceso->ultimo_uso_at ?? $acceso->usado_at)?->toIso8601String(),
        ];
    }
}
