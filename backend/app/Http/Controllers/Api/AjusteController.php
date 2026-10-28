<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ajuste;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ajustes de la plataforma: la app del cliente lee la tarifa de domicilio
 * (para mostrar el total en el checkout) y el admin la cambia.
 */
class AjusteController extends Controller
{
    /** Lo que necesita saber cualquier usuario logueado. */
    public function publicos(): JsonResponse
    {
        return response()->json([
            'tarifa_domicilio' => Ajuste::tarifaDomicilio(),
        ]);
    }

    /** Admin: cambiar la tarifa de domicilio (aplica a los pedidos nuevos). */
    public function actualizar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'tarifa_domicilio' => ['required', 'integer', 'min:0', 'max:100000'],
        ]);

        Ajuste::guardar(Ajuste::TARIFA_DOMICILIO, $datos['tarifa_domicilio']);

        return response()->json([
            'message' => 'Tarifa de domicilio actualizada. Aplica a los pedidos nuevos.',
            'tarifa_domicilio' => Ajuste::tarifaDomicilio(),
        ]);
    }
}
