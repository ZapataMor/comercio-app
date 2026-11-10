<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\PedidoYaAtendido;
use App\Support\CancelarPedido;
use App\Support\OfrecerPedido;
use App\Support\Push;
use App\Support\Reputacion;
use App\Support\UbicacionDomiciliario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * API de pedidos del lado del NEGOCIO (app móvil): ver los pedidos que
 * recibe un negocio (por grupos, con resumen del día), aceptarlos, marcarlos
 * como "listos para recoger", entregárselos al domiciliario con su código o
 * rechazarlos. Puede hacerlo cualquier miembro activo (propietario o trabajador).
 */
class ComercioPedidoController extends Controller
{
    /** Qué estados entran en cada pestaña del historial. */
    private const GRUPOS = [
        'en_espera' => ['pendiente'],
        'en_curso' => ['aceptado', 'listo', 'tomado', 'recogido', 'en_camino', 'devolviendo'],
        'entregados' => ['entregado'],
        'cancelados' => ['cancelado'],
    ];

    /**
     * Pedidos sin aceptar de todos mis negocios: la app hace sonar la alarma
     * mientras haya alguno, sin importar qué negocio tenga abierto.
     */
    public function porAceptar(Request $request): JsonResponse
    {
        $negocios = $request->user()->negociosActivos()->pluck('negocios.id');

        $pedidos = Pedido::whereIn('negocio_id', $negocios)
            ->where('estado', 'pendiente')
            ->with('negocio:id,nombre')
            ->oldest()
            ->get()
            ->map(fn (Pedido $p) => [
                'id' => $p->id,
                'codigo' => $p->codigo,
                'negocio_id' => $p->negocio_id,
                'negocio' => $p->negocio?->nombre,
                'total' => (float) $p->total,
                'segundos' => $p->segundosParaAceptar(),
            ]);

        return response()->json(['pedidos' => $pedidos]);
    }

    /**
     * Pedidos recibidos por el negocio.
     *
     * - Con `?grupo=en_espera|en_curso|entregados|cancelados`: historial
     *   paginado (20 por página, `?page=`).
     * - Sin grupo (lo que consulta el Inicio cada pocos segundos): los que
     *   siguen en curso más los entregados de los últimos 7 días (ahí están
     *   los de "dinero por confirmar").
     */
    public function index(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $consulta = $negocio->pedidos()
            ->with(['cliente', 'items', 'domiciliario'])
            ->latest()
            ->latest('id');

        $grupo = $request->query('grupo');
        if ($grupo !== null) {
            if (! array_key_exists($grupo, self::GRUPOS)) {
                return response()->json(['message' => 'Grupo de pedidos no válido.'], 422);
            }

            $pagina = $consulta->whereIn('estado', self::GRUPOS[$grupo])->paginate(20);

            return response()->json([
                'pedidos' => $pagina->getCollection()->map(fn ($p) => $this->map($p))->values(),
                'pagina' => $pagina->currentPage(),
                'ultima_pagina' => $pagina->lastPage(),
                'total' => $pagina->total(),
            ]);
        }

        $pedidos = $consulta
            ->where(fn ($q) => $q
                ->whereIn('estado', Pedido::EN_CURSO)
                ->orWhere(fn ($q2) => $q2->where('estado', 'entregado')->where('created_at', '>=', now()->subDays(7))))
            ->get()
            ->map(fn ($p) => $this->map($p));

        return response()->json(['pedidos' => $pedidos]);
    }

    /** Un pedido del negocio (p. ej. al abrirlo desde un push). */
    public function show(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $pedido = $negocio->pedidos()->with(['cliente', 'items', 'domiciliario'])->find($id);
        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        return response()->json($this->map($pedido));
    }

    /**
     * Resumen de HOY (hora de Colombia): pedidos recibidos, entregados,
     * cancelados y ventas. Las ventas son el subtotal de lo entregado: el
     * domicilio no es del negocio.
     */
    public function resumen(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $hoy = fn () => $negocio->pedidos()->where('created_at', '>=', now()->startOfDay());

        return response()->json([
            'pedidos' => $hoy()->count(),
            'en_curso' => $hoy()->whereIn('estado', Pedido::EN_CURSO)->count(),
            'entregados' => $hoy()->where('estado', 'entregado')->count(),
            'cancelados' => $hoy()->where('estado', 'cancelado')->count(),
            'ventas' => (float) $hoy()->where('estado', 'entregado')->sum('subtotal'),
        ]);
    }

    /**
     * Rechazar (pendiente) o cancelar (listo y sin domiciliario) un pedido,
     * con un motivo que ve el cliente. Ver App\Support\CancelarPedido.
     */
    public function cancelar(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $datos = $request->validate([
            'motivo' => ['required', 'string', 'min:5', 'max:255'],
        ]);

        $pedido = $negocio->pedidos()->find($id);
        if (! $pedido || ! CancelarPedido::ejecutar($pedido, CancelarPedido::POR_NEGOCIO, $datos['motivo'] ?? null)) {
            return response()->json([
                'message' => 'Solo puedes cancelar antes de marcar el pedido como listo y debes escribir el motivo.',
            ], 409);
        }

        return response()->json(['message' => 'Pedido cancelado. Le avisamos al cliente.']);
    }

    /** Forma JSON de un pedido para el negocio. */
    private function map(Pedido $p): array
    {
        return [
            'id' => $p->id,
            'codigo' => $p->codigo,
            'estado' => $p->estado,
            'estado_label' => $p->estadoLabel(),
            'fecha' => $p->created_at->format('d/m/Y H:i'),
            'subtotal' => (float) $p->subtotal,
            'costo_domicilio' => (float) $p->costo_domicilio,
            'total' => (float) $p->total,
            'metodo_pago' => $p->metodo_pago,
            'direccion_entrega' => $p->direccion_entrega,
            'telefono_contacto' => $p->telefono_contacto,
            'cliente' => $p->cliente?->nombre_completo,
            'domiciliario' => $p->domiciliario?->nombre_completo,
            // Para coordinar la recogida mientras el domiciliario lo lleva.
            'domiciliario_telefono' => in_array($p->estado, Pedido::EN_RUTA, true) ? $p->domiciliario?->telefono : null,
            'domiciliario_reputacion' => $p->domiciliario
                ? Reputacion::resumen(Reputacion::DOMICILIARIO, $p->domiciliario)
                : null,
            // Mapa: el negocio no le pierde el rastro hasta recibir el dinero.
            'domiciliario_ubicacion' => $p->negocioVeDomiciliario()
                ? UbicacionDomiciliario::de($p->domiciliario, aunqueSeaVieja: true)
                : null,
            'minutos_preparacion' => $p->minutos_preparacion,
            // Sin aceptar: segundos que quedan antes de que venza.
            'segundos_para_aceptar' => $p->estado === 'pendiente' ? $p->segundosParaAceptar() : null,
            'novedad' => $p->novedad,
            'faltante_motivo' => $p->faltante_motivo,
            'puede_confirmar_devolucion' => $p->estado === 'devolviendo',
            'cliente_no_encontrado_at' => $p->cliente_no_encontrado_at?->toIso8601String(),
            'dinero_estado' => $p->dinero_estado,
            'puede_confirmar_dinero' => $p->puedeConfirmarDinero(),
            'cancelado_por' => $p->cancelado_por,
            'motivo_cancelacion' => $p->motivo_cancelacion,
            'puede_cancelar' => CancelarPedido::puede($p, CancelarPedido::POR_NEGOCIO),
            // Cancelarlo ahora le bajaría la confiabilidad al negocio.
            'cancelar_penaliza' => CancelarPedido::penaliza($p),
            'motivos_cancelacion' => CancelarPedido::MOTIVOS_NEGOCIO,
            'items' => $p->items->map(fn ($i) => [
                'nombre' => $i->nombre,
                'cantidad' => $i->cantidad,
                // Talla, color o ingredientes: lo que el negocio debe preparar.
                'detalle' => $i->detalle(),
            ]),
        ];
    }

    /**
     * Aceptar un pedido: el negocio se compromete a prepararlo y la alarma se
     * calla en todos los teléfonos del equipo. Update condicional: si dos lo
     * aceptan a la vez, o justo vence o lo cancela el cliente, gana uno solo.
     */
    public function aceptar(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $afectados = $negocio->pedidos()
            ->where('id', $id)
            ->where('estado', 'pendiente')
            ->update(['estado' => 'aceptado', 'aceptado_at' => now()]);

        if (! $afectados) {
            return response()->json(['message' => 'Ese pedido ya no está en espera.'], 409);
        }

        $pedido = $negocio->pedidos()->find($id);

        Push::enviar($negocio->miembrosActivos()->get(), new PedidoYaAtendido($pedido));
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        return response()->json(['message' => 'Pedido aceptado. El cliente ya lo sabe.']);
    }

    /** Marcar un pedido aceptado como "listo" (lo verán los domiciliarios). */
    public function marcarListo(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        // Solo pedidos de ESTE negocio y que ya estén aceptados.
        $pedido = $negocio->pedidos()->where('id', $id)->where('estado', 'aceptado')->first();
        if (! $pedido) {
            return response()->json(['message' => 'No se puede marcar listo ese pedido.'], 409);
        }

        $afectados = Pedido::whereKey($id)->where('estado', 'aceptado')->whereNull('faltante_motivo')
            ->update(['estado' => 'listo', 'listo_at' => now()]);
        if (! $afectados) {
            return response()->json(['message' => 'El pedido cambió o falta que el cliente resuelva un producto agotado.'], 409);
        }
        $pedido->refresh();

        // ¿Cumplió el tiempo de preparación que promete? Cuenta desde que lo aceptó.
        if ($pedido->minutos_preparacion) {
            $tarde = Reputacion::excedeTiempo($pedido->aceptado_at ?? $pedido->created_at, $pedido->listo_at, $pedido->minutos_preparacion);
            Reputacion::registrar(Reputacion::NEGOCIO, $negocio, $tarde ? 'preparacion_tarde' : 'preparacion_a_tiempo', $pedido);
        }

        // Avisa a los domiciliarios habilitados que hay un pedido para tomar.
        $domiciliarios = OfrecerPedido::aDomiciliarios($pedido);

        // Y avisa al cliente que su pedido ya está listo.
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        return response()->json([
            'message' => $domiciliarios->isEmpty()
                ? 'Pedido listo, pero ahora no hay domiciliarios en turno. Avisaremos en cuanto haya uno disponible.'
                : 'Pedido listo. Avisamos a '.$domiciliarios->count().' domiciliario(s) en turno.',
            'domiciliarios_en_turno' => $domiciliarios->count(),
        ]);
    }

    /**
     * El negocio le entrega el pedido al domiciliario: confirma con el código
     * que él le dicta que es quien debía recogerlo. Desde aquí no hay vuelta atrás.
     */
    public function recogido(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $datos = $request->validate(
            ['codigo' => ['required', 'digits:4']],
            ['codigo.required' => 'Pídele el código al domiciliario.', 'codigo.digits' => 'El código tiene 4 dígitos.'],
        );

        $pedido = $negocio->pedidos()->with(['domiciliario', 'cliente'])->where('id', $id)->where('estado', 'tomado')->first();
        if (! $pedido) {
            return response()->json(['message' => 'Ese pedido ya no está esperando domiciliario.'], 409);
        }

        if (! hash_equals((string) $pedido->codigo_confirmacion, $datos['codigo'])) {
            throw ValidationException::withMessages(['codigo' => ['Ese no es el código del domiciliario. Pídeselo de nuevo.']]);
        }

        $afectados = Pedido::conCodigoDeConfirmacion(fn (string $codigo) => Pedido::whereKey($id)->where('estado', 'tomado')
            ->where('codigo_confirmacion', $datos['codigo'])->update([
                'estado' => 'recogido',
                'recogido_at' => now(),
                // Nace aquí: el cliente se lo da al domiciliario para confirmar la entrega.
                'codigo_confirmacion' => $codigo,
            ]));
        if (! $afectados) {
            return response()->json(['message' => 'El pedido cambió. Actualiza para continuar.'], 409);
        }
        $pedido->refresh();

        // ¿Recogió en los minutos que prometió al tomarlo? (con margen; si
        // reportó una novedad, la demora queda anotada pero no resta).
        if ($pedido->domiciliario && Reputacion::excedeTiempo($pedido->tomado_at, $pedido->recogido_at, $pedido->minutos_recogida)) {
            Reputacion::registrar(Reputacion::DOMICILIARIO, $pedido->domiciliario, 'recogida_tarde', $pedido);
        }

        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        return response()->json(['message' => 'Listo: el domiciliario ya lleva el pedido.']);
    }

    /**
     * Pedido en efectivo: el negocio dice si el domiciliario le entregó el
     * dinero. Sube o baja la confiabilidad del domiciliario; no entregarlo
     * es falta grave. Se responde una sola vez.
     */
    public function confirmarDinero(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $datos = $request->validate([
            'estado' => ['required', Rule::in(Pedido::DINERO_ESTADOS)],
        ]);

        $pedido = $negocio->pedidos()->with('domiciliario')->find($id);
        if (! $pedido || ! $pedido->puedeConfirmarDinero() || ! $pedido->domiciliario) {
            return response()->json(['message' => 'Este pedido no tiene dinero por confirmar.'], 409);
        }

        $pedido->update(['dinero_estado' => $datos['estado'], 'dinero_confirmado_at' => now()]);

        $motivo = match ($datos['estado']) {
            'recibido' => 'dinero_entregado',
            'incompleto' => 'dinero_incompleto',
            'no_recibido' => 'dinero_no_entregado',
        };
        Reputacion::registrar(
            Reputacion::DOMICILIARIO,
            $pedido->domiciliario,
            $motivo,
            $pedido,
            ReputacionEvento::ORIGEN_NEGOCIO,
        );

        return response()->json([
            'message' => $datos['estado'] === 'recibido' ? 'Listo, quedó confirmado.' : 'Gracias, lo tendremos en cuenta.',
        ]);
    }

    private function sinAcceso(): JsonResponse
    {
        return response()->json(['message' => 'No tienes acceso a este negocio.'], 403);
    }
}
