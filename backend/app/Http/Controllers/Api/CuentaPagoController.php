<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CuentaPago;
use App\Models\Negocio;
use App\Support\FotoOptimizada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Cuentas donde el negocio recibe transferencias (Nequi, llave, banco, QR…).
 * Las administra el propietario o un administrador del negocio; las ve quien
 * gestiona pedidos (para saber dónde revisar) y el cliente de un pedido
 * aceptado por transferencia.
 */
class CuentaPagoController extends Controller
{
    public function index(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->administra($request->user()) && ! $negocio->puede($request->user(), 'gestionar_pedidos')) {
            return $this->sinAcceso();
        }

        return response()->json([
            'cuentas' => $negocio->cuentasPago->map->datos()->values(),
            'puede_editar' => $negocio->administra($request->user()),
            'maximo' => CuentaPago::MAXIMO,
        ]);
    }

    public function store(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->administra($request->user())) {
            return $this->sinAcceso();
        }

        $datos = $this->validar($request, null);

        $cuenta = DB::transaction(function () use ($negocio, $datos, $request) {
            Negocio::whereKey($negocio->id)->lockForUpdate()->first();
            if ($negocio->cuentasPago()->count() >= CuentaPago::MAXIMO) {
                abort(422, 'Puedes tener hasta '.CuentaPago::MAXIMO.' cuentas. Borra una para agregar otra.');
            }
            $cuenta = $negocio->cuentasPago()->make($datos);
            $cuenta->orden = (int) $negocio->cuentasPago()->max('orden') + 1;
            if ($request->hasFile('qr')) {
                $cuenta->qr = FotoOptimizada::guardarEn($request->file('qr'), 'cuentas-pago');
            }
            $cuenta->save();

            return $cuenta;
        });

        return response()->json(['message' => 'Cuenta guardada.', 'cuenta' => $cuenta->datos()], 201);
    }

    /** Editar (llega como POST multipart por la foto del QR). */
    public function update(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->administra($request->user())) {
            return $this->sinAcceso();
        }

        $cuenta = $negocio->cuentasPago()->find($id);
        if (! $cuenta) {
            return response()->json(['message' => 'Cuenta no encontrada.'], 404);
        }

        $datos = $this->validar($request, $cuenta);
        $cuenta->fill($datos);
        $anterior = null;
        if ($request->hasFile('qr')) {
            $anterior = $cuenta->qr;
            $cuenta->qr = FotoOptimizada::guardarEn($request->file('qr'), 'cuentas-pago');
        } elseif ($request->boolean('quitar_qr')) {
            $anterior = $cuenta->qr;
            $cuenta->qr = null;
        }
        if ($cuenta->tipo === 'qr' && ! $cuenta->qr) {
            throw ValidationException::withMessages(['qr' => 'Sube la imagen del código QR.']);
        }
        $cuenta->save();
        if ($anterior) {
            Storage::disk('public')->delete($anterior);
        }

        return response()->json(['message' => 'Cuenta actualizada.', 'cuenta' => $cuenta->datos()]);
    }

    public function destroy(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->administra($request->user())) {
            return $this->sinAcceso();
        }

        $cuenta = $negocio->cuentasPago()->find($id);
        if (! $cuenta) {
            return response()->json(['message' => 'Cuenta no encontrada.'], 404);
        }

        // Los pedidos ya pagados conservan su copia de la cuenta (pago_cuenta).
        $cuenta->delete();
        if ($cuenta->qr) {
            Storage::disk('public')->delete($cuenta->qr);
        }

        return response()->json(['message' => 'Cuenta eliminada.']);
    }

    /** Reglas según el tipo: número o llave, banco, ahorros/corriente, QR. */
    private function validar(Request $request, ?CuentaPago $cuenta): array
    {
        $tipo = $request->input('tipo', $cuenta?->tipo);
        $datos = $request->validate([
            'tipo' => [$cuenta ? 'sometimes' : 'required', Rule::in(CuentaPago::TIPOS)],
            'titular' => [$cuenta ? 'sometimes' : 'required', 'string', 'min:3', 'max:100'],
            'numero' => [$tipo === 'qr' ? 'nullable' : 'required', 'string', 'max:60', 'regex:/\A[\p{L}\p{N}@._+\- ]+\z/u'],
            'banco' => [$tipo === 'banco' ? 'required' : 'nullable', 'string', 'max:60'],
            'tipo_cuenta' => [in_array($tipo, CuentaPago::CON_TIPO_CUENTA, true) ? 'required' : 'nullable', Rule::in(CuentaPago::TIPOS_CUENTA)],
            'qr' => [$tipo === 'qr' && ! $cuenta?->qr ? 'required' : 'nullable', 'image', 'max:4096'],
            'quitar_qr' => ['sometimes', 'boolean'],
        ], [
            'titular.required' => 'Escribe a nombre de quién está la cuenta.',
            'numero.required' => $tipo === 'llave' ? 'Escribe la llave.' : 'Escribe el número.',
            'numero.regex' => 'Usa solo letras, números, @, punto, guion o espacios.',
            'banco.required' => 'Escribe el nombre del banco.',
            'tipo_cuenta.required' => 'Elige si es de ahorros o corriente.',
            'qr.required' => 'Sube la imagen del código QR.',
            'qr.image' => 'El código QR debe ser una imagen.',
        ]);

        unset($datos['qr'], $datos['quitar_qr']);
        if (isset($datos['numero'])) {
            $datos['numero'] = trim(preg_replace('/\s+/', ' ', $datos['numero']));
        }
        // Lo que no aplica al tipo no se guarda.
        if ($tipo !== 'banco') {
            $datos['banco'] = null;
        }
        if (! in_array($tipo, CuentaPago::CON_TIPO_CUENTA, true)) {
            $datos['tipo_cuenta'] = null;
        }

        return $datos;
    }

    private function sinAcceso(): JsonResponse
    {
        return response()->json(['message' => 'Solo el propietario o un administrador del negocio maneja sus cuentas de pago.'], 403);
    }
}
