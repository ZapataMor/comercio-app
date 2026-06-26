<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * API de pedidos del CLIENTE: crear un pedido (desde el carrito de la app),
 * listar mis pedidos y ver el seguimiento de uno.
 */
class PedidoController extends Controller
{
    /** Crear un pedido. El carrito vive en la app; aquí llegan los ítems. */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'negocio_id' => ['required', 'integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.producto_id' => ['required', 'integer'],
            'items.*.cantidad' => ['required', 'integer', 'min:1', 'max:99'],
            'metodo_pago' => ['required', Rule::in(Pedido::METODOS_PAGO)],
            'direccion_entrega' => ['required', 'string', 'max:255'],
            'telefono_contacto' => ['required', 'string', 'max:30'],
        ]);

        // El negocio debe estar abierto.
        $negocio = Negocio::where('activo', true)->find($datos['negocio_id']);
        if (! $negocio) {
            return response()->json(['message' => 'Ese negocio no está disponible.'], 422);
        }

        // Productos de ESTE negocio, disponibles, que estén en el pedido.
        $ids = collect($datos['items'])->pluck('producto_id');
        $productos = $negocio->productos()
            ->where('disponible', true)
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');

        // Todos los ítems deben corresponder a un producto válido del negocio.
        foreach ($datos['items'] as $item) {
            if (! $productos->has($item['producto_id'])) {
                return response()->json(['message' => 'Hay un producto que ya no está disponible.'], 422);
            }
        }

        $pedido = DB::transaction(function () use ($request, $negocio, $datos, $productos) {
            $pedido = Pedido::create([
                'negocio_id' => $negocio->id,
                'user_id' => $request->user()->id,
                'estado' => 'pendiente',
                'metodo_pago' => $datos['metodo_pago'],
                'total' => 0,
                'direccion_entrega' => $datos['direccion_entrega'],
                'telefono_contacto' => $datos['telefono_contacto'],
            ]);

            $total = 0;
            foreach ($datos['items'] as $item) {
                $p = $productos[$item['producto_id']];
                $pedido->items()->create([
                    'producto_id' => $p->id,
                    'nombre' => $p->nombre,
                    'precio' => $p->precio,
                    'cantidad' => $item['cantidad'],
                ]);
                $total += $p->precio * $item['cantidad'];
            }

            $pedido->update(['total' => $total]);

            return $pedido;
        });

        return response()->json(['id' => $pedido->id, 'message' => '¡Pedido confirmado!'], 201);
    }

    /** Mis pedidos (más recientes primero). */
    public function index(Request $request): JsonResponse
    {
        $pedidos = $request->user()->pedidos()
            ->with('negocio')
            ->latest()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'estado' => $p->estado,
                'estado_label' => $p->estadoLabel(),
                'total' => (float) $p->total,
                'negocio' => $p->negocio?->nombre,
                'fecha' => $p->created_at->format('d/m/Y H:i'),
            ]);

        return response()->json(['pedidos' => $pedidos]);
    }

    /** Seguimiento de un pedido propio. */
    public function show(Request $request, int $id): JsonResponse
    {
        $pedido = $request->user()->pedidos()->with(['negocio', 'items', 'domiciliario'])->find($id);

        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        return response()->json([
            'id' => $pedido->id,
            'estado' => $pedido->estado,
            'estado_label' => $pedido->estadoLabel(),
            'estados' => Pedido::ESTADOS,
            'estado_index' => $pedido->estadoIndex(),
            'total' => (float) $pedido->total,
            'metodo_pago' => $pedido->metodo_pago,
            'direccion_entrega' => $pedido->direccion_entrega,
            'minutos_recogida' => $pedido->minutos_recogida,
            'negocio' => $pedido->negocio?->nombre,
            'domiciliario' => $pedido->domiciliario?->name,
            'items' => $pedido->items->map(fn ($i) => [
                'nombre' => $i->nombre,
                'cantidad' => $i->cantidad,
                'precio' => (float) $i->precio,
            ]),
        ]);
    }
}
