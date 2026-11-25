<?php

namespace App\Http\Controllers\Web;

use App\Gestion\AccesosWeb;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Models\AccesoWeb;
use App\Models\User;
use App\Rules\Telefono;
use App\Support\ClavePin;
use App\Support\GoogleIdToken;
use App\Support\Telefono\CodigosTelefono;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Login web (/login): una sola puerta para el panel del negocio y el del
 * administrador, con tres maneras de entrar (ADR-005):
 *
 * - QR: el navegador muestra un código que se aprueba desde la app.
 * - WhatsApp: celular + clave de 4 números + código por WhatsApp (siempre:
 *   un computador nunca queda como teléfono de confianza).
 * - Google: la cuenta de Google conectada en la app + clave de 4 números.
 *
 * El administrador de Vitrina también puede entrar con su usuario y
 * contraseña (AuthWebController). Cada sesión queda como una fila de
 * accesos_web, que se puede cerrar desde la app.
 */
class AccesoWebController extends Controller
{
    /** Minutos que se recuerda el primer paso (clave ya revisada) antes de pedir el código o la clave. */
    private const MINUTOS_PASO = 10;

    public function entrar(Request $request): View|RedirectResponse
    {
        $user = $request->user();
        $actual = ($id = $request->session()->get('acceso_web_id')) ? AccesoWeb::find($id) : null;
        if ($user && AccesosWeb::sesionVigente($actual, $user)) {
            return redirect()->to(AccesosWeb::destino($user));
        }

        $acceso = AccesosWeb::crear($request);
        $request->session()->put('acceso_web_pendiente', $acceso->id);

        $celular = $this->paso($request, 'login_celular');
        $google = $this->paso($request, 'login_google');
        $errores = session('errors')?->getBag('default');
        $pestana = session('pestana') ?? match (true) {
            $errores?->hasAny(['google']) || $google !== null => 'google',
            $errores?->hasAny(['telefono', 'pin', 'codigo']) || $celular !== null => 'whatsapp',
            default => 'qr',
        };

        return view('negocio.entrar', [
            'acceso' => $acceso,
            'segundos' => AccesosWeb::MINUTOS_CODIGO * 60,
            'pestana' => $pestana,
            'celular' => $celular,
            'google' => $google,
            'googleClientId' => config('services.google.web_client_id'),
        ]);
    }

    public function estado(Request $request): JsonResponse
    {
        // La página pregunta cada 2 segundos: sin esto, una pregunta que llega
        // justo después de enviar un formulario se gastaría sus avisos (errores,
        // pestaña abierta) antes de que la página los muestre.
        $request->session()->reflash();

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
        if (! $user || ! AccesosWeb::puedeEntrar($user)) {
            if ($user) {
                AccesosWeb::cerrar($acceso);
            }

            return response()->json(['estado' => 'rechazado', 'mensaje' => 'Esta cuenta no puede entrar al panel web.']);
        }

        AccesosWeb::iniciarSesion($request, $acceso->fresh());

        return response()->json(['estado' => 'listo', 'url' => AccesosWeb::destino($user)]);
    }

    // ------------------------------------------------------------ WhatsApp

    /** Paso 1: celular y clave. Si están bien, se envía el código por WhatsApp. */
    public function celular(Request $request, CodigosTelefono $codigos): RedirectResponse
    {
        $request->merge(['telefono' => CodigosTelefono::normalizar($request->input('telefono')) ?? $request->input('telefono')]);
        $datos = $this->validarEn($request, 'whatsapp', [
            'telefono' => ['required', 'string', new Telefono],
            'pin' => ['required', 'string'],
        ], ['telefono.required' => 'Escribe tu número de celular.', 'pin.required' => 'Escribe tu clave de 4 números.']);

        $user = CodigosTelefono::cuentaConTelefono($datos['telefono']);
        if (! $user) {
            return $this->error('whatsapp', 'telefono', 'Este celular no tiene una cuenta verificada en Vitrina.');
        }
        $this->enPestana('whatsapp', fn () => ClavePin::comprobar($user, $datos['pin']));
        if (! AccesosWeb::puedeEntrar($user)) {
            return $this->error('whatsapp', 'telefono', $this->sinAcceso($user));
        }

        $espera = $codigos->segundosParaReenviar($user->telefono, CodigosTelefono::ACCESO, $user->id);
        $codigoPrueba = $espera > 0 ? null : $codigos->enviar($user->telefono, CodigosTelefono::ACCESO, $user->id);
        $request->session()->put('login_celular', ['user_id' => $user->id, 'telefono' => $user->telefono, 'hasta' => now()->addMinutes(self::MINUTOS_PASO)->timestamp, 'codigo_prueba' => $codigoPrueba]);

        return redirect()->route('login')->with('pestana', 'whatsapp')
            ->with('ok', $espera > 0 ? 'Escribe el código que te enviamos por WhatsApp.' : 'Te enviamos un código por WhatsApp.');
    }

    /** Paso 2: el código de 6 números. */
    public function codigoCelular(Request $request, CodigosTelefono $codigos): RedirectResponse
    {
        $paso = $this->paso($request, 'login_celular');
        if (! $paso) {
            return $this->error('whatsapp', 'telefono', 'Vuelve a escribir tu celular y tu clave.');
        }
        $datos = $this->validarEn($request, 'whatsapp', ['codigo' => ['required', 'digits:6']], [
            'codigo.required' => 'Escribe el código de 6 números.', 'codigo.digits' => 'El código tiene 6 números.',
        ]);
        $user = User::find($paso['user_id']);
        $this->enPestana('whatsapp', fn () => $codigos->comprobar($paso['telefono'], CodigosTelefono::ACCESO, $datos['codigo'], $user?->id));

        return $this->abrir($request, $user, 'whatsapp');
    }

    // -------------------------------------------------------------- Google

    /** Paso 1: Google dice quién es (id_token del botón de Google). */
    public function google(Request $request, GoogleIdToken $google): RedirectResponse
    {
        $datos = $this->validarEn($request, 'google', ['credential' => ['required', 'string', 'max:4096']]);
        $cuenta = $this->enPestana('google', fn () => $google->verificar($datos['credential'], 'google'));
        $user = User::where('google_id', $cuenta['sub'])->whereNull('eliminado_at')->first();
        if (! $user) {
            return $this->error('google', 'google', 'Esa cuenta de Google no está conectada a Vitrina. Conéctala en la app, en Mi información.');
        }
        if (! AccesosWeb::puedeEntrar($user)) {
            return $this->error('google', 'google', $this->sinAcceso($user));
        }
        $request->session()->put('login_google', ['user_id' => $user->id, 'nombre' => $user->name, 'correo' => $cuenta['email'] ?? null, 'hasta' => now()->addMinutes(self::MINUTOS_PASO)->timestamp]);

        return redirect()->route('login')->with('pestana', 'google');
    }

    /** Paso 2: la clave de 4 números. */
    public function claveGoogle(Request $request): RedirectResponse
    {
        $paso = $this->paso($request, 'login_google');
        if (! $paso) {
            return $this->error('google', 'google', 'Vuelve a elegir tu cuenta de Google.');
        }
        $datos = $this->validarEn($request, 'google', ['pin' => ['required', 'string']], ['pin.required' => 'Escribe tu clave de 4 números.']);
        $user = User::find($paso['user_id']);
        $this->enPestana('google', fn () => ClavePin::comprobar($user, $datos['pin']));

        return $this->abrir($request, $user, 'google');
    }

    /** Volver a empezar el paso a paso de WhatsApp o de Google. */
    public function cancelar(Request $request): RedirectResponse
    {
        $request->session()->forget(['login_celular', 'login_google']);

        return redirect()->route('login')->with('pestana', $request->input('pestana', 'qr'));
    }

    public function salir(Request $request): RedirectResponse
    {
        if (($id = $request->session()->get('acceso_web_id')) && ($acceso = AccesoWeb::find($id))) {
            AccesosWeb::cerrar($acceso);
        }
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->with('ok', 'Saliste del panel web.');
    }

    // ------------------------------------------------------------- Ayudas

    private function abrir(Request $request, ?User $user, string $metodo): RedirectResponse
    {
        if (! $user || ! AccesosWeb::puedeEntrar($user)) {
            return $this->error($metodo, $metodo === 'google' ? 'google' : 'telefono', $user ? $this->sinAcceso($user) : 'Vuelve a empezar.');
        }
        AuthController::asegurarActiva($user, $metodo === 'google' ? 'google' : 'telefono');
        AccesosWeb::iniciarSesion($request, AccesosWeb::crearUsado($request, $user, $metodo));

        return redirect()->to(AccesosWeb::destino($user));
    }

    /** El primer paso guardado en la sesión, si no ha vencido. */
    private function paso(Request $request, string $clave): ?array
    {
        $paso = $request->session()->get($clave);
        if (! $paso || ($paso['hasta'] ?? 0) < now()->timestamp) {
            $request->session()->forget($clave);

            return null;
        }

        return $paso;
    }

    private function sinAcceso(User $user): string
    {
        return $user->suspendido_at !== null
            ? 'Tu cuenta está suspendida.'
            : 'Tu cuenta no tiene panel web: ninguno de tus negocios lo tiene activo. Pídeselo a Vitrina.';
    }

    private function error(string $pestana, string $campo, string $mensaje): RedirectResponse
    {
        return redirect()->route('login')->with('pestana', $pestana)->withErrors([$campo => $mensaje])->withInput(request()->except(['pin', 'codigo', 'credential']));
    }

    /** Valida y, si falla, vuelve al login con la pestaña abierta. */
    private function validarEn(Request $request, string $pestana, array $reglas, array $mensajes = []): array
    {
        return $this->enPestana($pestana, fn () => $request->validate($reglas, $mensajes));
    }

    /** Ejecuta y, si lanza un error de validación (clave mala, código vencido…), vuelve a la misma pestaña. */
    private function enPestana(string $pestana, callable $hacer): mixed
    {
        try {
            return $hacer();
        } catch (ValidationException $e) {
            session()->flash('pestana', $pestana);
            throw $e->redirectTo(route('login'));
        } catch (HttpResponseException $e) {
            // Clave bloqueada (ClavePin responde 423 en JSON, pensado para la app).
            $datos = json_decode((string) $e->getResponse()->getContent(), true) ?: [];
            throw new HttpResponseException($this->error($pestana, 'pin', $datos['message'] ?? 'No se pudo entrar.'));
        }
    }
}
