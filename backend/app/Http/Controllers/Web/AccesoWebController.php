<?php

namespace App\Http\Controllers\Web;

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Http\Controllers\Controller;
use App\Models\AccesoWeb;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

/**
 * Entrada al panel web del negocio con un código que se aprueba desde la app
 * (ADR-005). El navegador muestra el código y pregunta cada pocos segundos si
 * ya lo aprobaron.
 */
class AccesoWebController extends Controller
{
    public function entrar(Request $request): View|RedirectResponse
    {
        $user = $request->user();
        $actual = ($id = $request->session()->get('acceso_web_id')) ? AccesoWeb::find($id) : null;
        if ($user && AccesosWeb::sesionVigente($actual, $user)) {
            return redirect()->route('negocio.inicio');
        }

        $acceso = AccesosWeb::crear($request);
        $request->session()->put('acceso_web_pendiente', $acceso->id);

        return view('negocio.entrar', [
            'acceso' => $acceso,
            'segundos' => AccesosWeb::MINUTOS_CODIGO * 60,
        ]);
    }

    public function estado(Request $request): JsonResponse
    {
        $acceso = ($id = $request->session()->get('acceso_web_pendiente')) ? AccesoWeb::find($id) : null;
        if (! $acceso) {
            return response()->json(['estado' => 'sin_codigo']);
        }
        if ($acceso->estado === 'pendiente') {
            if ($acceso->expira_at->isPast()) {
                $acceso->update(['estado' => 'vencido']);

                return response()->json(['estado' => 'vencido']);
            }

            return response()->json(['estado' => 'pendiente']);
        }
        if ($acceso->estado !== 'aprobado') {
            return response()->json(['estado' => $acceso->estado]);
        }

        $user = AccesosWeb::usar($acceso);
        if (! $user || $user->suspendido_at !== null || Gestion::negociosConWeb($user)->isEmpty()) {
            if ($user) {
                AccesosWeb::cerrar($acceso);
            }

            return response()->json(['estado' => 'rechazado', 'mensaje' => 'Esta cuenta no puede entrar al panel web.']);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->forget(['acceso_web_pendiente', 'negocio_web_id']);
        $request->session()->put('acceso_web_id', $acceso->id);

        return response()->json(['estado' => 'listo', 'url' => route('negocio.inicio')]);
    }

    public function salir(Request $request): RedirectResponse
    {
        if (($id = $request->session()->get('acceso_web_id')) && ($acceso = AccesoWeb::find($id))) {
            AccesosWeb::cerrar($acceso);
        }
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('negocio.entrar')->with('ok', 'Saliste del panel web.');
    }
}
