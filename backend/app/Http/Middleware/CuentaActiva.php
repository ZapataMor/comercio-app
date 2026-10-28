<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Corta el acceso a la API de una cuenta suspendida por un admin: borra el
 * token con el que llegó y responde 401, así la app cierra la sesión sola.
 * Va en el grupo 'api' (no toca a quien no trae token).
 */
class CuentaActiva
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');

        if ($user instanceof User && $user->suspendido_at !== null) {
            $user->currentAccessToken()?->delete();

            return response()->json(['message' => self::mensajeSuspension($user)], 401);
        }

        return $next($request);
    }

    public static function mensajeSuspension(User $user): string
    {
        $motivo = $user->motivo_suspension ? " Motivo: {$user->motivo_suspension}." : '';

        return 'Tu cuenta está suspendida.'.$motivo.' Escríbenos a '.config('vitrina.correo_contacto').'.';
    }
}
