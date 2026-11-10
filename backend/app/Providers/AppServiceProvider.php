<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->limitesDeIntentos();
    }

    /**
     * Límites de intentos de las rutas públicas (anti fuerza bruta).
     *
     * Cada límite tiene su propia llave: con `throttle:6,1` a secas todas las
     * rutas públicas compartían el mismo contador por IP (dos logins fallidos
     * bloqueaban "olvidé mi contraseña"), y en Colombia muchos teléfonos salen
     * a internet con la misma IP del operador. Por eso las de cuenta cuentan
     * por correo + IP.
     */
    private function limitesDeIntentos(): void
    {
        $respuesta = fn (Request $r, array $headers) => response()->json([
            'message' => 'Has realizado demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.',
        ], 429, $headers);
        RateLimiter::for('api-ip', fn (Request $r) => Limit::perMinute(300)
            ->by('ip|'.$r->ip())->response($respuesta));
        RateLimiter::for('api-usuario', fn (Request $r) => [
            Limit::perMinute(120)->by('usuario|'.$r->user()->id)->response($respuesta),
            Limit::perMinute($r->isMethod('GET') ? 120 : 40)
                ->by(($r->isMethod('GET') ? 'lectura|' : 'escritura|').$r->user()->id)->response($respuesta),
        ]);
        $correo = fn (Request $r) => mb_strtolower((string) $r->input('email'));

        // Login y registro (API y web): 6 por minuto por correo e IP.
        RateLimiter::for('acceso', fn (Request $r) => Limit::perMinute(6)->by('acceso|'.mb_strtolower(trim((string) $r->input('username', $r->input('email')))).'|'.$r->ip()));

        // Pedir código de recuperación: 3 por minuto y 10 por hora por correo.
        RateLimiter::for('codigo-clave', fn (Request $r) => [
            Limit::perMinute(3)->by('codigo-min|'.$correo($r).'|'.$r->ip()),
            Limit::perHour(10)->by('codigo-hora|'.$correo($r)),
        ]);

        // Usar el código (además, el código se anula tras 5 fallos).
        RateLimiter::for('restablecer-clave', fn (Request $r) => Limit::perMinute(6)->by('restablecer|'.$correo($r).'|'.$r->ip()));

        // Eliminar la cuenta desde la web pública.
        RateLimiter::for('eliminar-cuenta', fn (Request $r) => Limit::perMinute(5)->by('eliminar|'.$correo($r).'|'.$r->ip()));

        // Códigos de recogida y entrega: 4 dígitos, así que se limitan los
        // intentos por persona y pedido para que no se puedan adivinar.
        RateLimiter::for('codigo-pedido', fn (Request $r) => Limit::perMinute(6)
            ->by('codigo-pedido|'.$r->user()?->id.'|'.$r->route('id'))
            ->response(fn () => response()->json(['message' => 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'], 429)));

        // Lecturas públicas sin sesión (lista de barrios).
        RateLimiter::for('publico', fn (Request $r) => Limit::perMinute(60)->by('publico|'.$r->ip()));

        // GPS del domiciliario: la app lo manda cada ~10 s; esto frena un
        // celular que se quede enviando en bucle.
        RateLimiter::for('ubicacion', fn (Request $r) => Limit::perMinute(20)->by('ubicacion|'.$r->user()?->id));
    }
}
