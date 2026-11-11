<?php

use App\Http\Middleware\AvisarEnVivo;
use App\Http\Middleware\CuentaActiva;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Sentry\Laravel\Integration;
use Spatie\Permission\Middleware\RoleMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // Cambios en vivo (Reverb): la app autoriza sus canales privados con su
    // token Sanctum en POST /api/broadcasting/auth. Ver App\Support\EnVivo.
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['prefix' => 'api', 'middleware' => ['api', 'auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trimStrings(except: ['password_actual']);

        // Alias del middleware de roles de Spatie,
        // para poder usar ->middleware('role:comerciante') en las rutas.
        $middleware->alias([
            'role' => RoleMiddleware::class,
        ]);

        // Una cuenta suspendida por el admin pierde el acceso a la API al instante.
        $middleware->api(append: [
            'throttle:api-ip',
            CuentaActiva::class,
            // Avisa a los demás dispositivos de lo que cambió (tiempo real).
            AvisarEnVivo::class,
        ]);
        // El panel web del admin también cambia datos que se ven en la app.
        $middleware->web(append: [AvisarEnVivo::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Reporte de errores: sin SENTRY_LARAVEL_DSN no se envía nada.
        Integration::handles($exceptions);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
