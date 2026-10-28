<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

/**
 * Login/Logout para la interfaz WEB (Blade), usando sesión con cookies.
 * Es independiente del login de la API (que usa tokens Sanctum).
 */
class AuthWebController extends Controller
{
    /** Muestra el formulario de login. */
    public function showLogin(): View
    {
        return view('auth.login');
    }

    /** Procesa el login web. */
    public function login(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! Auth::attempt($datos, $request->boolean('remember'))) {
            return back()
                ->withInput($request->only('email'))
                ->withErrors(['email' => 'Las credenciales no son correctas.']);
        }

        // La web es solo para administradores: los demás usan la app.
        if (! Auth::user()->hasRole('administrador')) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return back()
                ->withInput($request->only('email'))
                ->withErrors(['email' => 'El panel web es solo para administradores. Usa la app Vitrina.']);
        }

        // Evita "session fixation": nueva sesión tras autenticar.
        $request->session()->regenerate();

        return redirect()->intended(route('admin.panel'));
    }

    /** Cierra la sesión web. */
    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
