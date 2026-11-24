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
use Illuminate\Validation\ValidationException;

/**
 * Páginas legales del sitio: privacidad, términos, membresía, cookies,
 * cancelaciones y una forma de eliminar la cuenta sin entrar a la app (las
 * dos últimas, junto con la privacidad, las exige Play Store).
 */
class PublicoController extends Controller
{
    public function privacidad(): View
    {
        return view('publico.privacidad');
    }

    /** Versión corta que exige el Decreto 1377 de 2013 (art. 14 y 15). */
    public function avisoPrivacidad(): View
    {
        return view('publico.aviso-privacidad');
    }

    /** Términos y condiciones de uso para clientes, negocios y domiciliarios. */
    public function terminos(): View
    {
        return view('publico.terminos');
    }

    /** Condiciones de los planes que pagan los negocios en la web. */
    public function membresia(): View
    {
        return view('publico.membresia');
    }

    public function cookies(): View
    {
        return view('publico.cookies');
    }

    /** Reglas de cancelación y devolución, en palabras para el cliente. */
    public function cancelaciones(): View
    {
        return view('publico.cancelaciones');
    }

    public function eliminarCuentaForm(): View
    {
        return view('publico.eliminar-cuenta');
    }

    /**
     * Se identifica con su celular verificado (o el correo de su cuenta de
     * Google) y confirma con su clave de 4 números.
     */
    public function eliminarCuenta(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'usuario' => ['required', 'string', 'max:255'],
            'clave' => ['required', 'string', 'max:255'],
        ], [
            'usuario.required' => 'Escribe tu celular o tu correo.',
            'clave.required' => 'Escribe tu clave de 4 números.',
        ]);
        $identificador = trim($datos['usuario']);
        $clave = $datos['clave'];
        $volver = fn (string $mensaje) => back()->withInput($request->only('usuario'))->withErrors(['usuario' => $mensaje]);

        $telefono = CodigosTelefono::normalizar($identificador);
        $user = $telefono !== null
            ? CodigosTelefono::cuentaConTelefono($telefono)
            : User::where('email', $identificador)->whereNull('eliminado_at')->first();
        if (! $user) {
            return $volver('Los datos no son correctos.');
        }

        try {
            ClavePin::comprobar($user, $clave);
        } catch (ValidationException $e) {
            return $volver(collect($e->errors())->flatten()->first());
        } catch (HttpResponseException) {
            return $volver('Tu clave está bloqueada por intentos fallidos. Desbloquéala en la app con «¿Olvidaste tu clave?».');
        }

        if ($motivo = EliminarCuenta::bloqueo($user)) {
            return $volver($motivo);
        }

        EliminarCuenta::ejecutar($user);

        return redirect()->route('eliminar-cuenta')->with('ok', 'Tu cuenta fue eliminada. Gracias por haber usado Vitrina.');
    }
}
