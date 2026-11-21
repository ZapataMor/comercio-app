<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ClavePin;
use App\Support\EliminarCuenta;
use App\Support\Telefono\CodigosTelefono;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

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

    /**
     * Se identifica con su celular verificado o su correo, y confirma con su
     * clave de 4 números (o la contraseña, si su cuenta es de antes).
     */
    public function eliminarCuenta(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'usuario' => ['required_without:email', 'nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255'],
            'clave' => ['required_without:password', 'nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
        ], [
            'usuario.required_without' => 'Escribe tu celular o tu correo.',
            'clave.required_without' => 'Escribe tu clave.',
        ]);
        $identificador = trim((string) ($datos['usuario'] ?? $datos['email'] ?? ''));
        $clave = (string) ($datos['clave'] ?? $datos['password'] ?? '');
        $volver = fn (string $mensaje) => back()->withInput($request->only('usuario'))->withErrors(['usuario' => $mensaje]);

        $telefono = CodigosTelefono::normalizar($identificador);
        $user = $telefono !== null
            ? CodigosTelefono::cuentaConTelefono($telefono)
            : User::where('email', $identificador)->whereNull('eliminado_at')->first();
        if (! $user) {
            return $volver('Los datos no son correctos.');
        }

        if ($user->pin !== null && preg_match('/\A\d{4}\z/', $clave)) {
            try {
                ClavePin::comprobar($user, $clave);
            } catch (ValidationException $e) {
                return $volver(collect($e->errors())->flatten()->first());
            } catch (HttpResponseException) {
                return $volver('Tu clave está bloqueada por intentos fallidos. Desbloquéala en la app con «¿Olvidaste tu clave?».');
            }
        } elseif (! Hash::check($clave, $user->password)) {
            return $volver('Los datos no son correctos.');
        }

        if ($motivo = EliminarCuenta::bloqueo($user)) {
            return $volver($motivo);
        }

        EliminarCuenta::ejecutar($user);

        return redirect()->route('eliminar-cuenta')->with('ok', 'Tu cuenta fue eliminada. Gracias por haber usado Vitrina.');
    }
}
