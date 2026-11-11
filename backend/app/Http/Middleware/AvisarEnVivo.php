<?php

namespace App\Http\Middleware;

use App\Support\EnVivo;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Después de cada acción que cambia datos y salió bien, avisa en tiempo real
 * a los demás dispositivos que lo muestran. Qué avisa cada acción: ver
 * EnVivo::acciones().
 */
class AvisarEnVivo
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe()) {
            return $next($request);
        }

        $accion = EnVivo::acciones()[$request->route()?->getActionName()] ?? null;
        $antes = $accion && isset($accion['antes']) ? $accion['antes']($request) : null;

        $response = $next($request);

        // Los errores no avisan. (Las redirecciones del panel web cuentan como
        // éxito: si alguna era un error de validación, solo causa un refresco de más.)
        if ($accion && $response->getStatusCode() < 400) {
            $accion['despues']($request, $response, $antes);
        }

        return $response;
    }
}
