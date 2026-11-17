<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AdminWeb
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user()->suspendido_at !== null) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors(['username' => 'Tu cuenta está suspendida.']);
        }
        if ($request->isMethodSafe()) {
            return $next($request);
        }

        return DB::transaction(function () use ($request, $next) {
            $response = $next($request);
            if ($response->getStatusCode() < 400 && ! array_intersect(['errors', 'error'], $request->session()->get('_flash.new', []))) {
                DB::table('admin_acciones')->insert([
                    'admin_id' => $request->user()->id,
                    'accion' => $request->route()->getName(),
                    'recurso' => $request->path(),
                    'detalle' => json_encode($request->only(['motivo', 'resolucion', 'rol', 'username', 'resultado', 'tarifa_domicilio']), JSON_UNESCAPED_UNICODE),
                    'created_at' => now(),
                ]);
            }

            return $response;
        });
    }
}
