<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Rules\Telefono;
use App\Support\ClavePin;
use App\Support\Telefono\CodigosTelefono;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * «¿Olvidaste tu clave?» con el celular: un código de 6 números llega por
 * WhatsApp al celular verificado y con él se crea una clave nueva de 4
 * números (también desbloquea la clave y sirve a las cuentas de antes para
 * crear su primera clave). Con Google, ver GoogleController::restablecerClave.
 *
 * Ya no se recupera por correo: en Vitrina el correo escrito a mano no se
 * confirma, y el de Google ya tiene su propio camino.
 *
 * El código lo maneja CodigosTelefono (10 minutos, 5 intentos). Pedirlo no
 * revela si el número tiene cuenta. Al acertar se entra directamente: el
 * código demostró quién es, así que el teléfono queda de confianza.
 */
class RecuperarClaveController extends Controller
{
    public function __construct(private CodigosTelefono $codigos) {}

    public function enviarCodigo(Request $request): JsonResponse
    {
        $telefono = $this->telefono($request);
        $user = CodigosTelefono::cuentaConTelefono($telefono);
        $codigoPrueba = null;

        if ($user && $user->suspendido_at === null) {
            try {
                $codigoPrueba = $this->codigos->enviar($telefono, CodigosTelefono::CLAVE, $user->id);
            } catch (ValidationException $e) {
                // Espera entre envíos o WhatsApp falló: la respuesta sigue
                // siendo la misma para no revelar que el número tiene cuenta.
                Log::warning('Código de recuperación por WhatsApp no enviado: '.collect($e->errors())->flatten()->first());
            }
        }

        return response()->json(array_filter([
            'message' => 'Si el número tiene una cuenta, te enviamos un código por WhatsApp.',
            'espera' => CodigosTelefono::SEGUNDOS_ESPERA,
            'codigo_prueba' => $codigoPrueba,
        ], fn ($v) => $v !== null));
    }

    public function restablecer(Request $request): JsonResponse
    {
        $telefono = $this->telefono($request);
        $datos = $request->validate([
            'codigo' => ['required', 'digits:6'],
            'pin' => ClavePin::reglas(),
            'nombre_dispositivo' => ['nullable', 'string', 'max:80'],
        ], [
            'codigo.required' => 'Escribe el código de 6 números.',
            'codigo.digits' => 'El código tiene 6 números.',
            'pin.required' => 'Escribe tu clave nueva de 4 números.',
            'pin.confirmed' => 'Las dos claves no coinciden.',
        ]);

        $user = CodigosTelefono::cuentaConTelefono($telefono);
        if (! $user) {
            throw ValidationException::withMessages([
                'codigo' => ['El código venció o ya no sirve. Pide uno nuevo.'],
            ]);
        }

        $this->codigos->comprobar($telefono, CodigosTelefono::CLAVE, $datos['codigo'], $user->id);
        AuthController::asegurarActiva($user, 'codigo');
        ClavePin::restablecer($user, $datos['pin']);

        return AuthController::sesion($user, ClavePin::confiar($user, $datos['nombre_dispositivo'] ?? null), 200, [
            'message' => 'Listo: tu clave nueva quedó guardada.',
        ]);
    }

    private function telefono(Request $request): string
    {
        $request->merge(['telefono' => CodigosTelefono::normalizar($request->input('telefono')) ?? $request->input('telefono')]);

        return $request->validate(
            ['telefono' => ['required', 'string', new Telefono]],
            ['telefono.required' => 'Escribe el celular de tu cuenta.'],
        )['telefono'];
    }
}
