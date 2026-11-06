<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Notifications\EstadoPedidoActualizado;
use App\Support\OfrecerPedido;
use App\Support\Push;
use App\Support\Reputacion;
use App\Support\UbicacionDomiciliario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * API del DOMICILIARIO: ver pedidos listos, tomarlos y avanzar su estado.
 * Flujo: listo -> tomado -> (el negocio confirma con el código de recogida)
 * -> recogido -> en_camino -> (el cliente da el código de entrega) -> entregado.
 * Antes de recogerlo puede soltarlo; después no hay vuelta atrás.
 *
 * Un domiciliario VETADO por baja confiabilidad no ve ni toma pedidos nuevos,
 * pero sí puede terminar las entregas que ya llevaba.
 */
class DomiciliarioController extends Controller
{
    /**
     * Pedidos listos y sin domiciliario (disponibles para tomar). `en_turno`
     * dice si me llegan los avisos de pedidos nuevos, y `compartir_ubicacion` si
     * la app debe enviar mi posición.
     */
    public function disponibles(Request $request): JsonResponse
    {
        $yo = $request->user();

        if ($yo->domiciliarioVetado()) {
            return response()->json([
                'pedidos' => [],
                'vetado' => true,
                'en_turno' => (bool) $yo->en_turno,
                'compartir_ubicacion' => UbicacionDomiciliario::debeCompartir($yo),
            ]);
        }

        $pedidos = Pedido::where('estado', 'listo')
            ->whereNull('domiciliario_id')
            // También es cliente: su propio pedido no lo reparte él.
            ->where('user_id', '!=', $yo->id)
            ->with(['negocio', 'items'])
            ->latest()
            ->get();

        return response()->json([
            'pedidos' => $pedidos->map(fn ($p) => $this->map($p)),
            'en_turno' => (bool) $yo->en_turno,
            'compartir_ubicacion' => UbicacionDomiciliario::debeCompartir($yo),
        ]);
    }

    /**
     * Entrar o salir de turno: solo a quien está en turno le llega el push
     * de "pedido listo para recoger".
     */
    public function turno(Request $request): JsonResponse
    {
        $datos = $request->validate(['en_turno' => ['required', 'boolean']]);

        $yo = $request->user();
        $yo->forceFill(['en_turno' => $datos['en_turno']])->save();

        // Fuera de turno y sin entregas, nadie debe verlo en el mapa.
        if (! UbicacionDomiciliario::debeCompartir($yo)) {
            UbicacionDomiciliario::borrar($yo);
        }

        return response()->json([
            'en_turno' => (bool) $datos['en_turno'],
            'message' => $datos['en_turno']
                ? 'Estás en turno: te avisaremos de los pedidos listos.'
                : 'Saliste de turno: ya no te llegan avisos de pedidos.',
        ]);
    }

    /**
     * Mis entregas activas (tomadas por mí y aún no entregadas). La última
     * que tomé va primero.
     */
    public function entregas(Request $request): JsonResponse
    {
        $pedidos = Pedido::where('domiciliario_id', $request->user()->id)
            ->whereIn('estado', ['tomado', 'recogido', 'en_camino'])
            ->with(['negocio', 'cliente', 'items'])
            ->latest('tomado_at')
            ->latest('id')
            ->get();

        return response()->json(['pedidos' => $pedidos->map(fn ($p) => $this->map($p))]);
    }

    /**
     * Mis entregas completadas, la más reciente primero (20 por página,
     * `?page=`). `total` = cuántas he entregado en total.
     */
    public function historial(Request $request): JsonResponse
    {
        $pagina = Pedido::where('domiciliario_id', $request->user()->id)
            ->where('estado', 'entregado')
            ->with(['negocio', 'cliente', 'items'])
            ->latest('entregado_at')
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'pedidos' => $pagina->getCollection()->map(fn ($p) => $this->map($p))->values(),
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total' => $pagina->total(),
        ]);
    }

    /**
     * Mi posición actual (GPS del celular), cada pocos segundos. Solo se
     * guarda en turno o con una entrega en curso; `compartir: false` le dice
     * a la app que deje de enviarla.
     */
    public function ubicacion(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $yo = $request->user();

        if (! UbicacionDomiciliario::debeCompartir($yo)) {
            UbicacionDomiciliario::borrar($yo);

            return response()->json(['compartir' => false]);
        }

        UbicacionDomiciliario::guardar($yo, (float) $datos['lat'], (float) $datos['lng']);

        return response()->json(['compartir' => true]);
    }

    /** Mi nivel de confiabilidad, por qué (últimos eventos) y mis caritas promedio. */
    public function reputacion(Request $request): JsonResponse
    {
        $yo = $request->user();

        return response()->json([
            'reputacion' => Reputacion::resumen(Reputacion::DOMICILIARIO, $yo),
            'eventos' => Reputacion::historial(Reputacion::DOMICILIARIO, $yo),
            'caritas' => Reputacion::caritasPromedio($yo),
        ]);
    }

    /** Tomar un pedido disponible (indicando en cuántos minutos, 1 a 20, lo recojo). */
    public function tomar(Request $request, int $id): JsonResponse
    {
        if ($request->user()->domiciliarioVetado()) {
            return response()->json([
                'message' => 'Tu cuenta de domiciliario está suspendida por baja confiabilidad.',
            ], 403);
        }

        $datos = $request->validate([
            'minutos_recogida' => ['required', 'integer', 'min:1', 'max:20'],
        ]);

        // Update condicional: evita choques si dos lo toman a la vez.
        $afectados = Pedido::where('id', $id)
            ->where('estado', 'listo')
            ->whereNull('domiciliario_id')
            ->where('user_id', '!=', $request->user()->id)
            ->update([
                'estado' => 'tomado',
                'domiciliario_id' => $request->user()->id,
                'minutos_recogida' => $datos['minutos_recogida'],
                'tomado_at' => now(),
                // Se lo dicta al negocio para que le entregue el pedido.
                'codigo_recogida' => Pedido::generarCodigo(),
            ]);

        if (! $afectados) {
            return response()->json(['message' => 'Ese pedido ya no está disponible (lo tomó otro domiciliario o se canceló).'], 409);
        }

        // Avisa al cliente que ya tiene domiciliario asignado.
        $pedido = Pedido::find($id);
        if ($pedido?->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        // A los demás se les quita la oferta: ya no pueden tomarlo.
        if ($pedido) {
            OfrecerPedido::retirar($pedido, excepto: $request->user()->id);
        }

        return response()->json(['message' => 'Pedido tomado. Pasa a recogerlo.']);
    }

    /**
     * Devolver un pedido tomado antes de recogerlo: vuelve a estar disponible
     * para los demás. Una vez recogido no hay vuelta atrás.
     */
    public function soltar(Request $request, int $id): JsonResponse
    {
        $yo = $request->user();

        // Update condicional: si el negocio confirma la recogida a la vez, gana uno.
        $afectados = Pedido::where('id', $id)
            ->where('domiciliario_id', $yo->id)
            ->where('estado', 'tomado')
            ->update([
                'estado' => 'listo',
                'domiciliario_id' => null,
                'minutos_recogida' => null,
                'tomado_at' => null,
                'codigo_recogida' => null,
            ]);

        if (! $afectados) {
            return response()->json(['message' => 'Ya no puedes soltar este pedido: solo se puede antes de recogerlo.'], 409);
        }

        $pedido = Pedido::find($id);
        OfrecerPedido::aDomiciliarios($pedido, excepto: $yo->id);

        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido, [
                'Cambio de domiciliario 🛵',
                'Estamos buscando otro domiciliario para tu pedido.',
            ]));
        }

        if (! UbicacionDomiciliario::debeCompartir($yo)) {
            UbicacionDomiciliario::borrar($yo);
        }

        return response()->json(['message' => 'Soltaste el pedido. Ya está disponible para otros domiciliarios.']);
    }

    public function enCamino(Request $request, int $id): JsonResponse
    {
        return $this->avanzar($this->pedidoMio($request, $id, 'recogido'), 'en_camino', 'Pedido en camino.');
    }

    /** Confirma la entrega con el código que le da el cliente (queda la hora exacta). */
    public function entregado(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate(
            ['codigo' => ['required', 'digits:4']],
            ['codigo.required' => 'Pídele el código al cliente.', 'codigo.digits' => 'El código tiene 4 dígitos.'],
        );

        $pedido = $this->pedidoMio($request, $id, 'en_camino');

        if ($pedido && ! hash_equals((string) $pedido->codigo_entrega, $datos['codigo'])) {
            throw ValidationException::withMessages(['codigo' => ['Ese no es el código del cliente. Pídeselo de nuevo.']]);
        }

        return $this->avanzar($pedido, 'entregado', '¡Entrega completada!');
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

        // Marca de tiempo del estado (en_camino_at, entregado_at).
        $pedido->update(['estado' => $hacia, "{$hacia}_at" => now()]);

        // Avisa al cliente del nuevo estado (en camino / entregado).
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
            // Se lo dicta al negocio al llegar por el pedido.
            'codigo_recogida' => $p->estado === 'tomado' ? $p->codigo_recogida : null,
            'fecha_entrega' => $p->entregado_at?->format('d/m/Y H:i'),
            'direccion_entrega' => $p->direccion_entrega,
            // El teléfono del cliente solo lo ve quien lleva el pedido.
            'telefono_contacto' => in_array($p->estado, Pedido::EN_RUTA, true) ? $p->telefono_contacto : null,
            'novedad' => $p->novedad,
            'negocio' => $p->negocio ? [
                'nombre' => $p->negocio->nombre,
                'direccion' => $p->negocio->direccion,
                'telefono' => $p->negocio->telefono,
                // Para abrir "Cómo llegar" en Google Maps.
                'lat' => $p->negocio->lat,
                'lng' => $p->negocio->lng,
            ] : null,
            'cliente' => $p->relationLoaded('cliente') && $p->cliente ? ['name' => $p->cliente->nombre_completo] : null,
            'items' => $p->items->map(fn ($i) => ['nombre' => $i->nombre, 'cantidad' => $i->cantidad]),
        ];
    }
}
