<?php

namespace App\Http\Controllers\Web;

use App\Gestion\AccesosWeb;
use App\Http\Controllers\Controller;
use App\Http\Middleware\CuentaActiva;
use App\Models\AccesoWeb;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Login/Logout para la interfaz WEB (Blade), usando sesión con cookies.
 * Es independiente del login de la API (que usa tokens Sanctum).
 */
class AuthWebController extends Controller
{
    /** Procesa el login web. */
    public function login(Request $request): RedirectResponse
    {
        $campo = $request->has('username') ? 'username' : 'email';
        $datos = $request->validate([
            $campo => ['required', 'string', 'max:255'],
            'password' => ['present', 'string', 'min:1'],
        ]);

        $identificador = trim($datos[$campo]);
        $credenciales = [
            str_contains($identificador, '@') ? 'email' : 'username' => strtolower($identificador),
            'password' => $datos['password'],
        ];
        if (! Auth::attempt($credenciales, $request->boolean('remember'))) {
            return back()
                ->withInput($request->only($campo))
                ->withErrors([$campo => 'Las credenciales no son correctas.']);
        }

        $user = Auth::user();
        if ($user->suspendido_at !== null || ! $user->hasRole('administrador')) {
            $mensaje = $user->suspendido_at !== null
                ? CuentaActiva::mensajeSuspension($user)
                : 'El panel web es solo para administradores. Usa la app Vitrina.';
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return back()
                ->withInput($request->only($campo))
                ->withErrors([$campo => $mensaje]);
        }

        // Evita "session fixation": nueva sesión tras autenticar.
        $request->session()->regenerate();

        return redirect()->intended(route('admin.panel'));
    }

    /** Cierra la sesión web. */
    public function logout(Request $request): RedirectResponse
    {
        // Si entró con QR, WhatsApp o Google, también se cierra su sesión web.
        if (($id = $request->session()->get('acceso_web_id')) && ($acceso = AccesoWeb::find($id))) {
            AccesosWeb::cerrar($acceso);
        }
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
