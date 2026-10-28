<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\EliminarCuenta;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Páginas públicas que exige Play Store: política de privacidad y una forma
 * de eliminar la cuenta sin entrar a la app.
 */
class PublicoController extends Controller
{
    public function privacidad(): View
    {
        return view('publico.privacidad');
    }

    public function eliminarCuentaForm(): View
    {
        return view('publico.eliminar-cuenta');
    }

    public function eliminarCuenta(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $datos['email'])->whereNull('eliminado_at')->first();

        if (! $user || ! Hash::check($datos['password'], $user->password)) {
            return back()->withInput($request->only('email'))
                ->withErrors(['email' => 'Las credenciales no son correctas.']);
        }

        if ($motivo = EliminarCuenta::bloqueo($user)) {
            return back()->withInput($request->only('email'))->withErrors(['email' => $motivo]);
        }

        EliminarCuenta::ejecutar($user);

        return redirect()->route('eliminar-cuenta')->with('ok', 'Tu cuenta fue eliminada. Gracias por haber usado Vitrina.');
    }
}
