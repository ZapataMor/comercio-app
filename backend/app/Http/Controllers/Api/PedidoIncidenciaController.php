<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Notifications\EstadoPedidoActualizado;
use App\Support\OpcionesPedido;
use App\Support\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PedidoIncidenciaController extends Controller
{
    public function faltante(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403);
        $datos = $request->validate(['motivo' => ['required', 'string', 'min:5', 'max:1000']]);
        $pedido = DB::transaction(function () use ($negocio, $id, $datos) {
            Negocio::whereKey($negocio->id)->lockForUpdate()->firstOrFail();
            $pedido = $negocio->pedidos()->lockForUpdate()->findOrFail($id);
            abort_unless(in_array($pedido->estado, ['pendiente', 'aceptado']), 409, 'Solo puedes informar faltantes antes de marcar listo el pedido.');
            $pedido->update([
                'estado' => 'aceptado', 'aceptado_at' => $pedido->aceptado_at ?? now(),
                'faltante_motivo' => trim($datos['motivo']), 'faltante_at' => now(),
                'faltante_version' => (string) Str::uuid(),
            ]);

            return $pedido;
        });
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido, ['Un producto o ingrediente se agotó', $pedido->faltante_motivo.'. Abre tu pedido para cambiarlo o cancelarlo.']));
        }

        return response()->json(['message' => 'Avisamos al cliente. Espera su elección antes de marcar el pedido como listo.']);
    }

    public function ajustar(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:99'],
            'items.*.producto_id' => ['required', 'integer'],
            'items.*.cantidad' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.talla' => ['nullable', 'string', 'max:100'], 'items.*.color' => ['nullable', 'string', 'max:100'],
            'items.*.sin' => ['nullable', 'array', 'max:30'], 'items.*.sin.*' => ['string', 'max:100'],
            'items.*.extra' => ['nullable', 'array', 'max:30'], 'items.*.extra.*' => ['string', 'max:100'],
            'total_esperado' => ['required', 'numeric', 'min:0'],
            'faltante_version' => ['required', 'string'],
        ]);
        $pedido = $request->user()->pedidos()->findOrFail($id);
        $pedido = DB::transaction(function () use ($pedido, $datos) {
            Negocio::whereKey($pedido->negocio_id)->lockForUpdate()->firstOrFail();
            $pedido = Pedido::lockForUpdate()->findOrFail($pedido->id);
            // La versión impide aceptar una propuesta anterior si el comercio acaba de cambiarla.
            abort_unless($pedido->estado === 'aceptado' && $pedido->faltante_motivo && $pedido->faltante_version === $datos['faltante_version'], 409, 'La solicitud cambió o ya fue resuelta. Actualiza el pedido.');
            $productos = $pedido->negocio->productos()->with('tipoProducto')->whereIn('id', array_column($datos['items'], 'producto_id'))->lockForUpdate()->get()->keyBy('id');
            $anteriores = $pedido->items()->get()->keyBy('producto_id');
            $lineas = [];
            foreach ($datos['items'] as $item) {
                $producto = $productos->get($item['producto_id']);
                abort_unless($producto && $producto->disponible, 422, 'Uno de los productos ya no está disponible. Elige otro.');
                abort_if($problema = OpcionesPedido::problema($producto, $item), 422, $problema ?? 'Opciones no disponibles.');
                $lineas[] = [
                    'producto_id' => $producto->id, 'nombre' => $producto->nombre, 'cantidad' => $item['cantidad'],
                    'precio' => (float) ($anteriores->get($producto->id)?->precio ?? $producto->precio),
                    'opciones' => OpcionesPedido::normalizar($producto, $item),
                ];
            }
            $subtotal = collect($lineas)->sum(fn ($i) => $i['cantidad'] * $i['precio']);
            abort_if(abs($subtotal + (float) $pedido->costo_domicilio - $datos['total_esperado']) >= 0.01, 409, 'El total cambió. Revisa los productos antes de confirmar el cambio.');
            $pedido->items()->delete();
            $pedido->items()->createMany($lineas);
            $pedido->update(['subtotal' => $subtotal, 'total' => $subtotal + (float) $pedido->costo_domicilio, 'faltante_motivo' => null, 'ajustado_at' => now()]);

            return $pedido;
        });
        Push::enviar($pedido->negocio->miembrosActivos()->get(), new EstadoPedidoActualizado($pedido, ['El cliente ajustó su pedido', 'Revisa los productos y los ingredientes elegidos antes de prepararlo.']));

        return response()->json(['message' => 'Cambios confirmados. El comercio recibió tu nueva elección.']);
    }

    public function devolucion(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403);
        $pedido = $negocio->pedidos()->findOrFail($id);
        $cambio = Pedido::whereKey($id)->where('estado', 'devolviendo')->update([
            'estado' => 'cancelado', 'devuelto_at' => now(), 'devolucion_confirmada_por' => $request->user()->id,
            'cancelado_at' => now(), 'cancelado_por' => $pedido->cancelado_por ?? 'cliente_no_encontrado',
            'motivo_cancelacion' => $pedido->motivo_cancelacion ?? 'Cliente no encontrado. El comercio confirmó la devolución.',
            'codigo_confirmacion' => null,
        ]);
        abort_unless($cambio, 409, 'Este pedido no tiene una devolución pendiente.');
        $pedido->refresh();
        $aviso = new EstadoPedidoActualizado($pedido, ['Devolución confirmada', 'El comercio recibió el pedido de vuelta. El pedido quedó cerrado.']);
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, $aviso);
        }
        if ($pedido->domiciliario) {
            Push::enviar($pedido->domiciliario, $aviso);
        }

        return response()->json(['message' => 'Devolución confirmada. Pedido cerrado.']);
    }
}
