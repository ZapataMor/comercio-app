<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Notifications\EstadoPedidoActualizado;
use App\Support\Push;
use App\Support\Reputacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API del DOMICILIARIO: ver pedidos listos, tomarlos y avanzar su estado.
 * Flujo: listo -> tomado -> recogido -> en_camino -> entregado.
 *
 * Un domiciliario VETADO por baja confiabilidad no ve ni toma pedidos nuevos,
 * pero sí puede terminar las entregas que ya llevaba.
 */
class DomiciliarioController extends Controller
{
    /**
     * Pedidos listos y sin domiciliario (disponibles para tomar). `en_turno`
     * dice si me llegan los avisos de pedidos nuevos.
     */
    public function disponibles(Request $request): JsonResponse
    {
        $yo = $request->user();

        if ($yo->domiciliarioVetado()) {
            return response()->json(['pedidos' => [], 'vetado' => true, 'en_turno' => (bool) $yo->en_turno]);
        }

        $pedidos = Pedido::where('estado', 'listo')
            ->whereNull('domiciliario_id')
            ->with(['negocio', 'items'])
            ->latest()
            ->get();

        return response()->json([
            'pedidos' => $pedidos->map(fn ($p) => $this->map($p)),
            'en_turno' => (bool) $yo->en_turno,
        ]);
    }

    /**
     * Entrar o salir de turno: solo a quien está en turno le llega el push
     * de "pedido listo para recoger".
     */
    public function turno(Request $request): JsonResponse
    {
        $datos = $request->validate(['en_turno' => ['required', 'boolean']]);

        $request->user()->forceFill(['en_turno' => $datos['en_turno']])->save();

        return response()->json([
            'en_turno' => (bool) $datos['en_turno'],
            'message' => $datos['en_turno']
                ? 'Estás en turno: te avisaremos de los pedidos listos.'
                : 'Saliste de turno: ya no te llegan avisos de pedidos.',
        ]);
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

    /** Mis entregas completadas (20 por página, `?page=`). */
    public function historial(Request $request): JsonResponse
    {
        $pagina = Pedido::where('domiciliario_id', $request->user()->id)
            ->where('estado', 'entregado')
            ->with(['negocio', 'items'])
            ->latest()
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'pedidos' => $pagina->getCollection()->map(fn ($p) => $this->map($p))->values(),
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
        ]);
    }

    /** Mi nivel de confiabilidad y por qué (últimos eventos). */
    public function reputacion(Request $request): JsonResponse
    {
        $yo = $request->user();

        return response()->json([
            'reputacion' => Reputacion::resumen(Reputacion::DOMICILIARIO, $yo),
            'eventos' => Reputacion::historial(Reputacion::DOMICILIARIO, $yo),
        ]);
    }

    /** Tomar un pedido disponible (indicando minutos para recoger). */
    public function tomar(Request $request, int $id): JsonResponse
    {
        if ($request->user()->domiciliarioVetado()) {
            return response()->json([
                'message' => 'Tu cuenta de domiciliario está suspendida por baja confiabilidad.',
            ], 403);
        }

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
                'tomado_at' => now(),
            ]);

        if (! $afectados) {
            return response()->json(['message' => 'Ese pedido ya no está disponible (lo tomó otro domiciliario o se canceló).'], 409);
        }

        // Avisa al cliente que ya tiene domiciliario asignado.
        $pedido = Pedido::find($id);
        if ($pedido?->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        return response()->json(['message' => 'Pedido tomado. Pasa a recogerlo.']);
    }

    public function recogido(Request $request, int $id): JsonResponse
    {
        $pedido = $this->pedidoMio($request, $id, 'tomado');
        $respuesta = $this->avanzar($pedido, 'recogido', 'Pedido recogido.');

        // ¿Recogió en los minutos que prometió al tomarlo? (con margen; si
        // reportó una novedad, la demora queda anotada pero no resta).
        if ($pedido && Reputacion::excedeTiempo($pedido->tomado_at, $pedido->recogido_at, $pedido->minutos_recogida)) {
            Reputacion::registrar(Reputacion::DOMICILIARIO, $request->user(), 'recogida_tarde', $pedido);
        }

        return $respuesta;
    }

    public function enCamino(Request $request, int $id): JsonResponse
    {
        return $this->avanzar($this->pedidoMio($request, $id, 'recogido'), 'en_camino', 'Pedido en camino.');
    }

    public function entregado(Request $request, int $id): JsonResponse
    {
        return $this->avanzar($this->pedidoMio($request, $id, 'en_camino'), 'entregado', '¡Entrega completada!');
    }

    /**
     * Reportar una novedad (lluvia, tráfico, se varó la moto...) de una
     * entrega en curso. Justifica una demora: no resta confiabilidad, y el
     * cliente y el negocio la ven.
     */
    public function novedad(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'novedad' => ['required', 'string', 'max:255'],
        ]);

        $pedido = Pedido::where('id', $id)
            ->where('domiciliario_id', $request->user()->id)
            ->whereIn('estado', ['tomado', 'recogido', 'en_camino'])
            ->first();

        if (! $pedido) {
            return response()->json(['message' => 'Solo puedes reportar novedades de tus entregas en curso.'], 409);
        }

        $pedido->update(['novedad' => trim($datos['novedad']), 'novedad_at' => now()]);

        return response()->json(['message' => 'Novedad reportada. El cliente ya la puede ver.']);
    }

    /** Un pedido MÍO que esté en el estado $desde (o null). */
    private function pedidoMio(Request $request, int $id, string $desde): ?Pedido
    {
        return Pedido::where('id', $id)
            ->where('domiciliario_id', $request->user()->id)
            ->where('estado', $desde)
            ->first();
    }

    /** Avanza el pedido al estado siguiente y guarda cuándo pasó. */
    private function avanzar(?Pedido $pedido, string $hacia, string $msg): JsonResponse
    {
        if (! $pedido) {
            return response()->json(['message' => 'No se puede actualizar ese pedido.'], 409);
        }

        // Marca de tiempo del estado (recogido_at, en_camino_at, entregado_at).
        $pedido->update(['estado' => $hacia, "{$hacia}_at" => now()]);

        // Avisa al cliente del nuevo estado (recogido / en camino / entregado).
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        return response()->json(['message' => $msg]);
    }

    /** Forma JSON de un pedido para la app. */
    private function map(Pedido $p): array
    {
        return [
            'id' => $p->id,
            'estado' => $p->estado,
            'estado_label' => $p->estadoLabel(),
            'subtotal' => (float) $p->subtotal,
            'costo_domicilio' => (float) $p->costo_domicilio,
            'total' => (float) $p->total,
            'metodo_pago' => $p->metodo_pago,
            // Lo que el domiciliario le cobra al cliente al entregar.
            'cobrar' => $p->metodo_pago === 'efectivo' ? (float) $p->total : 0.0,
            'minutos_recogida' => $p->minutos_recogida,
            'direccion_entrega' => $p->direccion_entrega,
            // El teléfono del cliente solo lo ve quien lleva el pedido.
            'telefono_contacto' => in_array($p->estado, Pedido::EN_RUTA, true) ? $p->telefono_contacto : null,
            'novedad' => $p->novedad,
            'negocio' => $p->negocio ? [
                'nombre' => $p->negocio->nombre,
                'direccion' => $p->negocio->direccion,
                'telefono' => $p->negocio->telefono,
            ] : null,
            'cliente' => $p->relationLoaded('cliente') && $p->cliente ? ['name' => $p->cliente->nombre_completo] : null,
            'items' => $p->items->map(fn ($i) => ['nombre' => $i->nombre, 'cantidad' => $i->cantidad]),
        ];
    }
}
