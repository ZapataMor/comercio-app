<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Rules\Telefono;
use App\Support\Telefono\CodigosTelefono;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Confirmar un celular con un código que llega por WhatsApp.
 *
 *  - Registro (sin sesión): /telefono/codigo y /telefono/verificar. Al
 *    acertar se devuelve un token `verificacion` que /register exige.
 *  - Mi información (con sesión): /perfil/telefono/codigo y
 *    /perfil/telefono/verificar. Al acertar el número queda guardado y
 *    verificado en la cuenta.
 *
 * Un número verificado sirve para entrar y recuperar la contraseña, por eso
 * solo puede estar verificado en una cuenta.
 */
class TelefonoController extends Controller
{
    public function __construct(private CodigosTelefono $codigos) {}

    public function codigoRegistro(Request $request): JsonResponse
    {
        $telefono = $this->telefono($request);

        if (CodigosTelefono::cuentaConTelefono($telefono)) {
            throw ValidationException::withMessages([
                'telefono' => ['Este número ya tiene una cuenta. Inicia sesión o recupera tu contraseña.'],
            ]);
        }

        return $this->respuestaEnvio($this->codigos->enviar($telefono, CodigosTelefono::REGISTRO));
    }

    public function verificarRegistro(Request $request): JsonResponse
    {
        $telefono = $this->telefono($request);
        $codigo = $this->codigo($request);

        return response()->json([
            'message' => 'Número confirmado.',
            'telefono' => $telefono,
            'verificacion' => $this->codigos->verificarParaRegistro($telefono, $codigo),
        ]);
    }

    public function codigoPerfil(Request $request): JsonResponse
    {
        $user = $request->user();
        $telefono = $this->telefono($request);

        if ($user->telefono === $telefono && $user->telefono_verificado_at !== null) {
            throw ValidationException::withMessages(['telefono' => ['Este número ya está verificado en tu cuenta.']]);
        }
        $this->asegurarLibre($telefono, $user);

        return $this->respuestaEnvio($this->codigos->enviar($telefono, CodigosTelefono::CAMBIO, $user->id));
    }

    public function verificarPerfil(Request $request): JsonResponse
    {
        $user = $request->user();
        $telefono = $this->telefono($request);
        $codigo = $this->codigo($request);

        $this->codigos->comprobar($telefono, CodigosTelefono::CAMBIO, $codigo, $user->id);

        DB::transaction(function () use ($user, $telefono) {
            User::whereKey($user->id)->lockForUpdate()->first();
            $this->asegurarLibre($telefono, $user);
            $user->forceFill(['telefono' => $telefono, 'telefono_verificado_at' => now()])->save();
        });

        return response()->json([
            'message' => 'Listo. Ya puedes entrar con tu celular.',
            'user' => AuthController::userPayload($user->fresh()),
        ]);
    }

    private function telefono(Request $request): string
    {
        $request->merge(['telefono' => CodigosTelefono::normalizar($request->input('telefono')) ?? $request->input('telefono')]);
        $datos = $request->validate(['telefono' => ['required', 'string', new Telefono]]);

        return $datos['telefono'];
    }

    private function codigo(Request $request): string
    {
        return $request->validate(['codigo' => ['required', 'digits:6']])['codigo'];
    }

    private function asegurarLibre(string $telefono, User $user): void
    {
        $duena = CodigosTelefono::cuentaConTelefono($telefono);
        if ($duena && $duena->id !== $user->id) {
            throw ValidationException::withMessages(['telefono' => ['Este número ya está verificado en otra cuenta.']]);
        }
    }

    private function respuestaEnvio(?string $codigoPrueba): JsonResponse
    {
        return response()->json(array_filter([
            'message' => 'Te enviamos un código de 6 números por WhatsApp.',
            'espera' => CodigosTelefono::SEGUNDOS_ESPERA,
            'vence_en_minutos' => CodigosTelefono::MINUTOS_VIGENCIA,
            // Solo en local con el canal de prueba (WHATSAPP_DRIVER=log).
            'codigo_prueba' => $codigoPrueba,
        ], fn ($v) => $v !== null));
    }
}
