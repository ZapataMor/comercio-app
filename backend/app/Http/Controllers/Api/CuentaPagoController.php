<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CuentaPago;
use App\Models\Negocio;
use App\Support\ClavePin;
use App\Support\EditorCuentaPago;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Cuentas donde el negocio recibe transferencias (Nequi, llave, banco, QR…).
 * Las administra el propietario o un administrador del negocio; las ve quien
 * gestiona pedidos (para saber dónde revisar) y el cliente de un pedido
 * aceptado por transferencia.
 *
 * Crear, editar o borrar una pide la clave de 4 números (`pin`): quien
 * entrara a la cuenta de un comerciante no puede cambiar el número para
 * quedarse con las transferencias. Las reglas están en EditorCuentaPago
 * (las comparte el panel web).
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
        ClavePin::comprobar($request->user(), $request->input('pin'));

        $datos = EditorCuentaPago::validar($request, null);
        $cuenta = EditorCuentaPago::crear($negocio, $datos, $request->file('qr'));

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
        ClavePin::comprobar($request->user(), $request->input('pin'));

        $datos = EditorCuentaPago::validar($request, $cuenta);
        EditorCuentaPago::actualizar($cuenta, $datos, $request->file('qr'), $request->boolean('quitar_qr'));

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

        ClavePin::comprobar($request->user(), $request->input('pin'));

        EditorCuentaPago::eliminar($cuenta);

        return response()->json(['message' => 'Cuenta eliminada.']);
    }

    private function sinAcceso(): JsonResponse
    {
        return response()->json(['message' => 'Solo el propietario o un administrador del negocio maneja sus cuentas de pago.'], 403);
    }
}
