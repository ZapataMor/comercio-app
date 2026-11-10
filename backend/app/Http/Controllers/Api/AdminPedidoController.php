<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\PedidoCancelado;
use App\Support\CancelarPedido;
use App\Support\OfrecerPedido;
use App\Support\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Pedidos vistos por el ADMINISTRADOR: la salida para los que se atascan
 * (cliente ausente, código perdido, domiciliario suspendido, negocio que dejó
 * de responder). Los ve todos y puede cerrarlos a mano, dejando el motivo.
 */
class AdminPedidoController extends Controller
{
    /**
     * Pedidos, los más antiguos primero (20 por página). Por defecto los que
     * siguen en curso; `?estado=` filtra por uno y `?buscar=` por código.
     */
    public function index(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'estado' => ['sometimes', Rule::in([...Pedido::ESTADOS, 'cancelado', 'devolviendo'])],
            'buscar' => ['sometimes', 'nullable', 'string', 'max:20'],
        ]);

        $pagina = Pedido::query()
            ->with(['negocio', 'cliente', 'domiciliario'])
            ->when(
                $datos['estado'] ?? null,
                fn ($q, $estado) => $q->where('estado', $estado),
                fn ($q) => $q->whereIn('estado', Pedido::EN_CURSO),
            )
            ->when(filled($datos['buscar'] ?? null), fn ($q) => $q->where('codigo', mb_strtoupper(trim($datos['buscar']))))
            ->oldest()
            ->oldest('id')
            ->paginate(20);

        return response()->json([
            'pedidos' => $pagina->getCollection()->map(fn (Pedido $p) => $this->map($p))->values(),
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total' => $pagina->total(),
        ]);
    }

    /**
     * Cerrar a mano un pedido en curso. `cancelado` sirve en cualquier estado;
     * `entregado` solo si el domiciliario ya lo había recogido. El motivo es
     * obligatorio y queda guardado junto con quién lo cerró.
     */
    public function cerrar(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'resultado' => ['required', Rule::in(['entregado', 'cancelado'])],
            'motivo' => ['required', 'string', 'max:255'],
        ], [
            'motivo.required' => 'Escribe por qué cierras el pedido.',
        ]);

        $pedido = Pedido::find($id);
        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }
        if ($pedido->estado === 'devolviendo') {
            return response()->json(['message' => 'El comercio debe confirmar la devolución antes de cerrar este pedido.'], 409);
        }

        $motivo = trim($datos['motivo']);
        $entregado = $datos['resultado'] === 'entregado';
        $desde = $entregado ? Pedido::CON_CODIGO_ENTREGA : array_diff(Pedido::EN_CURSO, ['devolviendo']);
        $estabaOfrecido = $pedido->estado === 'listo';

        $cierre = ['cerrado_por_admin_id' => $request->user()->id, 'nota_admin' => $motivo, 'codigo_confirmacion' => null];
        $cambios = $entregado
            ? ['estado' => 'entregado', 'entregado_at' => now()]
            : ['estado' => 'cancelado', 'cancelado_por' => CancelarPedido::POR_ADMIN, 'motivo_cancelacion' => $motivo, 'cancelado_at' => now()];

        // Update condicional: si justo lo entregan o lo cancelan, gana uno solo.
        $afectados = Pedido::whereKey($pedido->id)->whereIn('estado', $desde)->update($cambios + $cierre);
        if (! $afectados) {
            return response()->json([
                'message' => $entregado
                    ? 'Solo se puede dar por entregado un pedido que el domiciliario ya recogió.'
                    : 'Ese pedido ya terminó.',
            ], 409);
        }

        $pedido->refresh();

        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, $entregado ? new EstadoPedidoActualizado($pedido) : new PedidoCancelado($pedido));
        }
        if (! $entregado) {
            $equipo = $pedido->negocio?->miembrosActivos()->get();
            if ($equipo && $equipo->isNotEmpty()) {
                Push::enviar($equipo, new PedidoCancelado($pedido));
            }
            if ($estabaOfrecido) {
                OfrecerPedido::retirar($pedido);
            }
        }

        return response()->json([
            'message' => $entregado ? 'Pedido dado por entregado.' : 'Pedido cancelado.',
            'pedido' => $this->map($pedido),
        ]);
    }

    private function map(Pedido $p): array
    {
        return [
            'id' => $p->id,
            'codigo' => $p->codigo,
            'estado' => $p->estado,
            'estado_label' => $p->estadoLabel(),
            'fecha' => $p->created_at->format('d/m/Y H:i'),
            // Cuánto lleva sin moverse: lo que delata a un pedido atascado.
            'minutos_sin_cambios' => (int) $p->updated_at->diffInMinutes(now()),
            'total' => (float) $p->total,
            'metodo_pago' => $p->metodo_pago,
            'direccion_entrega' => $p->direccion_entrega,
            'telefono_contacto' => $p->telefono_contacto,
            'negocio' => $p->negocio?->nombre,
            'negocio_telefono' => $p->negocio?->telefono,
            'cliente' => $p->cliente?->nombre_completo,
            'domiciliario' => $p->domiciliario?->nombre_completo,
            'domiciliario_telefono' => $p->domiciliario?->telefono,
            'domiciliario_suspendido' => $p->domiciliario !== null && $p->domiciliario->suspendido_at !== null,
            'novedad' => $p->novedad,
            'cancelado_por' => $p->cancelado_por,
            'motivo_cancelacion' => $p->motivo_cancelacion,
            'nota_admin' => $p->nota_admin,
        ];
    }
}
