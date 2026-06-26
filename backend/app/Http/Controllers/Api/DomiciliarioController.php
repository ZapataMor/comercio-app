<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API del DOMICILIARIO: ver pedidos listos, tomarlos y avanzar su estado.
 * Flujo: listo -> tomado -> recogido -> en_camino -> entregado.
 */
class DomiciliarioController extends Controller
{
    /** Pedidos listos y sin domiciliario (disponibles para tomar). */
    public function disponibles(): JsonResponse
    {
        $pedidos = Pedido::where('estado', 'listo')
            ->whereNull('domiciliario_id')
            ->with(['negocio', 'items'])
            ->latest()
            ->get();

        return response()->json(['pedidos' => $pedidos->map(fn ($p) => $this->map($p))]);
    }

    /** Mis entregas activas (tomadas por mí y aún no entregadas). */
    public function entregas(Request $request): JsonResponse
    {
        $pedidos = Pedido::where('domiciliario_id', $request->user()->id)
            ->whereIn('estado', ['tomado', 'recogido', 'en_camino'])
            ->with(['negocio', 'cliente', 'items'])
            ->latest()
            ->get();

        return response()->json(['pedidos' => $pedidos->map(fn ($p) => $this->map($p))]);
    }

    /** Mis entregas completadas. */
    public function historial(Request $request): JsonResponse
    {
        $pedidos = Pedido::where('domiciliario_id', $request->user()->id)
            ->where('estado', 'entregado')
            ->with(['negocio', 'items'])
            ->latest()
            ->get();

        return response()->json(['pedidos' => $pedidos->map(fn ($p) => $this->map($p))]);
    }

    /** Tomar un pedido disponible (indicando minutos para recoger). */
    public function tomar(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'minutos_recogida' => ['required', 'integer', 'min:1', 'max:240'],
        ]);

        // Update condicional: evita choques si dos lo toman a la vez.
        $afectados = Pedido::where('id', $id)
            ->where('estado', 'listo')
            ->whereNull('domiciliario_id')
            ->update([
                'estado' => 'tomado',
                'domiciliario_id' => $request->user()->id,
                'minutos_recogida' => $datos['minutos_recogida'],
            ]);

        if (! $afectados) {
            return response()->json(['message' => 'Ese pedido ya fue tomado por otro domiciliario.'], 409);
        }

        return response()->json(['message' => 'Pedido tomado. Pasa a recogerlo.']);
    }

    public function recogido(Request $request, int $id): JsonResponse
    {
        return $this->avanzar($request, $id, 'tomado', 'recogido', 'Pedido recogido.');
    }

    public function enCamino(Request $request, int $id): JsonResponse
    {
        return $this->avanzar($request, $id, 'recogido', 'en_camino', 'Pedido en camino.');
    }

    public function entregado(Request $request, int $id): JsonResponse
    {
        return $this->avanzar($request, $id, 'en_camino', 'entregado', '¡Entrega completada!');
    }

    /** Avanza un pedido MÍO de un estado al siguiente (valida el previo). */
    private function avanzar(Request $request, int $id, string $desde, string $hacia, string $msg): JsonResponse
    {
        $pedido = Pedido::where('id', $id)
            ->where('domiciliario_id', $request->user()->id)
            ->where('estado', $desde)
            ->first();

        if (! $pedido) {
            return response()->json(['message' => 'No se puede actualizar ese pedido.'], 409);
        }

        $pedido->update(['estado' => $hacia]);

        return response()->json(['message' => $msg]);
    }

    /** Forma JSON de un pedido para la app. */
    private function map(Pedido $p): array
    {
        return [
            'id' => $p->id,
            'estado' => $p->estado,
            'estado_label' => $p->estadoLabel(),
            'total' => (float) $p->total,
            'metodo_pago' => $p->metodo_pago,
            'minutos_recogida' => $p->minutos_recogida,
            'direccion_entrega' => $p->direccion_entrega,
            'telefono_contacto' => $p->telefono_contacto,
            'negocio' => $p->negocio ? ['nombre' => $p->negocio->nombre, 'direccion' => $p->negocio->direccion] : null,
            'cliente' => $p->relationLoaded('cliente') && $p->cliente ? ['name' => $p->cliente->name] : null,
            'items' => $p->items->map(fn ($i) => ['nombre' => $i->nombre, 'cantidad' => $i->cantidad]),
        ];
    }
}
