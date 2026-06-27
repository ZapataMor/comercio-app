<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\PedidoDisponibleParaDomiciliario;
use App\Support\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API de pedidos del lado del COMERCIANTE (app móvil): ver los pedidos que
 * recibe su negocio y marcarlos como "listos para recoger".
 */
class ComercioPedidoController extends Controller
{
    /** Pedidos recibidos por MI negocio. */
    public function index(Request $request): JsonResponse
    {
        $negocio = $request->user()->negocio;
        if (! $negocio) {
            return response()->json(['pedidos' => []]);
        }

        $pedidos = $negocio->pedidos()
            ->with(['cliente', 'items', 'domiciliario'])
            ->latest()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'estado' => $p->estado,
                'estado_label' => $p->estadoLabel(),
                'total' => (float) $p->total,
                'metodo_pago' => $p->metodo_pago,
                'direccion_entrega' => $p->direccion_entrega,
                'telefono_contacto' => $p->telefono_contacto,
                'cliente' => $p->cliente?->name,
                'domiciliario' => $p->domiciliario?->name,
                'items' => $p->items->map(fn ($i) => ['nombre' => $i->nombre, 'cantidad' => $i->cantidad]),
            ]);

        return response()->json(['pedidos' => $pedidos]);
    }

    /** Marcar un pedido pendiente como "listo" (lo verán los domiciliarios). */
    public function marcarListo(Request $request, int $id): JsonResponse
    {
        $negocio = $request->user()->negocio;
        if (! $negocio) {
            return response()->json(['message' => 'Primero crea tu negocio.'], 409);
        }

        // Solo pedidos de MI negocio y que estén pendientes.
        $pedido = $negocio->pedidos()->where('id', $id)->where('estado', 'pendiente')->first();
        if (! $pedido) {
            return response()->json(['message' => 'No se puede marcar listo ese pedido.'], 409);
        }

        $pedido->update(['estado' => 'listo']);

        // Avisa a TODOS los domiciliarios que hay un pedido para tomar.
        Push::enviar(User::role('domiciliario')->get(), new PedidoDisponibleParaDomiciliario($pedido));

        // Y avisa al cliente que su pedido ya está listo.
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        return response()->json(['message' => 'Pedido listo. Los domiciliarios ya pueden tomarlo.']);
    }
}
