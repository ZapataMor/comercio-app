<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\PedidoDisponibleParaDomiciliario;
use App\Support\CancelarPedido;
use App\Support\Push;
use App\Support\Reputacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * API de pedidos del lado del NEGOCIO (app móvil): ver los pedidos que
 * recibe un negocio (por grupos, con resumen del día), marcarlos como "listos
 * para recoger" o rechazarlos. Puede hacerlo cualquier miembro activo
 * (propietario o trabajador).
 */
class ComercioPedidoController extends Controller
{
    /** Qué estados entran en cada pestaña del historial. */
    private const GRUPOS = [
        'en_espera' => ['pendiente'],
        'en_curso' => ['listo', 'tomado', 'recogido', 'en_camino'],
        'entregados' => ['entregado'],
        'cancelados' => ['cancelado'],
    ];

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
            'motivo' => ['nullable', 'string', 'max:255'],
        ]);

        $pedido = $negocio->pedidos()->find($id);
        if (! $pedido || ! CancelarPedido::ejecutar($pedido, CancelarPedido::POR_NEGOCIO, $datos['motivo'] ?? null)) {
            return response()->json([
                'message' => 'Ese pedido ya no se puede cancelar (un domiciliario ya lo tomó o ya terminó).',
            ], 409);
        }

        return response()->json(['message' => 'Pedido cancelado. Le avisamos al cliente.']);
    }

    /** Forma JSON de un pedido para el negocio. */
    private function map(Pedido $p): array
    {
        return [
            'id' => $p->id,
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
            'minutos_preparacion' => $p->minutos_preparacion,
            'novedad' => $p->novedad,
            'dinero_estado' => $p->dinero_estado,
            'puede_confirmar_dinero' => $p->puedeConfirmarDinero(),
            'cancelado_por' => $p->cancelado_por,
            'motivo_cancelacion' => $p->motivo_cancelacion,
            'puede_cancelar' => CancelarPedido::puede($p, CancelarPedido::POR_NEGOCIO),
            'motivos_cancelacion' => CancelarPedido::MOTIVOS_NEGOCIO,
            'items' => $p->items->map(fn ($i) => ['nombre' => $i->nombre, 'cantidad' => $i->cantidad]),
        ];
    }

    /** Marcar un pedido pendiente como "listo" (lo verán los domiciliarios). */
    public function marcarListo(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        // Solo pedidos de ESTE negocio y que estén pendientes.
        $pedido = $negocio->pedidos()->where('id', $id)->where('estado', 'pendiente')->first();
        if (! $pedido) {
            return response()->json(['message' => 'No se puede marcar listo ese pedido.'], 409);
        }

        $pedido->update(['estado' => 'listo', 'listo_at' => now()]);

        // ¿Cumplió el tiempo de preparación que promete el negocio?
        if ($pedido->minutos_preparacion) {
            $tarde = Reputacion::excedeTiempo($pedido->created_at, $pedido->listo_at, $pedido->minutos_preparacion);
            Reputacion::registrar(Reputacion::NEGOCIO, $negocio, $tarde ? 'preparacion_tarde' : 'preparacion_a_tiempo', $pedido);
        }

        // Avisa a los domiciliarios habilitados que hay un pedido para tomar.
        // Solo a los que están en turno (y no vetados).
        $domiciliarios = User::role('domiciliario')
            ->whereNull('domiciliario_vetado_at')
            ->whereNull('suspendido_at')
            ->where('en_turno', true)
            ->get();
        Push::enviar($domiciliarios, new PedidoDisponibleParaDomiciliario($pedido));

        // Y avisa al cliente que su pedido ya está listo.
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido));
        }

        return response()->json([
            'message' => $domiciliarios->isEmpty()
                ? 'Pedido listo, pero ahora no hay domiciliarios en turno. Si nadie lo toma, puedes cancelarlo.'
                : 'Pedido listo. Avisamos a '.$domiciliarios->count().' domiciliario(s) en turno.',
            'domiciliarios_en_turno' => $domiciliarios->count(),
        ]);
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
