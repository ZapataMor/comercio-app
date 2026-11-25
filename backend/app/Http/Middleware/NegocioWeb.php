<?php

namespace App\Http\Middleware;

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Models\AccesoWeb;
use App\Models\Negocio;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\View;

/**
 * Protege el panel web del negocio (/negocio):
 * - la sesión tiene que venir de un código aprobado en la app y seguir abierta
 *   (si se cerró desde la app o pasaron 12 horas, se vuelve a pedir el código),
 * - la cuenta no puede estar suspendida,
 * - la persona tiene que ser miembro activo de un negocio con el panel encendido.
 *
 * Deja en el request y en las vistas el negocio elegido y el menú por módulos.
 */
class NegocioWeb
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (! $user) {
            return redirect()->route('login');
        }

        $idAcceso = $request->session()->get('acceso_web_id');
        $acceso = $idAcceso ? AccesoWeb::find($idAcceso) : null;
        if (! AccesosWeb::sesionVigente($acceso, $user)) {
            // Sin sesión de la web del negocio (por ejemplo, el super administrador
            // que entró con contraseña): se pide el código sin cerrar su sesión.
            if (! $idAcceso) {
                return redirect()->route('login');
            }

            return $this->sacar($request, 'Tu sesión en la web se cerró. Vuelve a entrar con el código.');
        }
        if ($user->suspendido_at !== null) {
            AccesosWeb::cerrar($acceso);

            return $this->sacar($request, 'Tu cuenta está suspendida.');
        }

        $negocios = Gestion::negociosConWeb($user);
        if ($negocios->isEmpty()) {
            if ($user->hasRole('administrador')) {
                return redirect()->route('admin.panel')->with('error', 'Tu cuenta no es de ningún negocio con panel web.');
            }
            AccesosWeb::cerrar($acceso);

            return $this->sacar($request, 'Ninguno de tus negocios tiene el panel web activo.');
        }

        $negocio = $negocios->firstWhere('id', (int) $request->session()->get('negocio_web_id'));
        if (! $negocio && $negocios->count() === 1) {
            $negocio = $negocios->first();
            $request->session()->put('negocio_web_id', $negocio->id);
        }
        if (! $negocio && ! $request->routeIs('negocio.elegir', 'negocio.cambiar')) {
            return redirect()->route('negocio.elegir');
        }

        if (! $acceso->ultimo_uso_at || $acceso->ultimo_uso_at->lt(now()->subMinute())) {
            $acceso->forceFill(['ultimo_uso_at' => now()])->saveQuietly();
        }

        $request->attributes->set('negocios_web', $negocios);
        if ($negocio instanceof Negocio) {
            $request->attributes->set('negocio_web', $negocio);
            View::share('negocioWeb', $negocio);
            View::share('menuWeb', Gestion::menu($user, $negocio));
            View::share('administraWeb', Gestion::administra($user, $negocio));
        }
        View::share('negociosWeb', $negocios);

        return $next($request);
    }

    private function sacar(Request $request, string $mensaje)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->with('error', $mensaje);
    }
}
