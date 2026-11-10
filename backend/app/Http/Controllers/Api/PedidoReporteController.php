<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\PedidoReporte;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PedidoReporteController extends Controller
{
    public function store(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'objetivo' => ['required', Rule::in(['cliente', 'negocio', 'domiciliario'])],
            'motivo' => ['required', 'string', 'min:5', 'max:1000'],
        ]);
        $pedido = Pedido::findOrFail($id);
        $yo = $request->user();
        $cliente = $pedido->user_id === $yo->id;
        $negocio = $pedido->negocio?->esMiembroActivo($yo) ?? false;
        $domiciliario = $pedido->domiciliario_id === $yo->id;
        abort_unless($cliente || $negocio || $domiciliario, 403);
        $objetivo = $datos['objetivo'];
        abort_if(($objetivo === 'cliente' && $cliente) || ($objetivo === 'negocio' && $negocio) || ($objetivo === 'domiciliario' && ($domiciliario || ! $pedido->domiciliario_id)), 422, 'Selecciona a otra parte del pedido para reportar.');
        $reporte = PedidoReporte::registrar($pedido, $objetivo, 'reporte_usuario', trim($datos['motivo']), $yo->id);

        return response()->json(['id' => $reporte->id, 'message' => 'Reporte recibido. El administrador lo revisará.'], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $datos = $request->validate(['estado' => ['sometimes', Rule::in(['pendientes', 'resueltos', 'todos'])]]);
        $pagina = PedidoReporte::with(['pedido.negocio', 'pedido.cliente', 'pedido.domiciliario'])
            ->when(($datos['estado'] ?? 'pendientes') !== 'todos', fn ($q) => ($datos['estado'] ?? 'pendientes') === 'resueltos' ? $q->whereNotNull('resuelto_at') : $q->whereNull('resuelto_at'))
            ->oldest()->orderBy('id')->paginate(20);

        return response()->json([
            'reportes' => $pagina->getCollection()->map(fn ($r) => [
                'id' => $r->id, 'pedido_id' => $r->pedido_id, 'codigo' => $r->pedido?->codigo,
                'objetivo' => $r->objetivo, 'tipo' => $r->tipo, 'motivo' => $r->motivo,
                'fecha' => $r->created_at->format('d/m/Y H:i'), 'resuelto' => $r->resuelto_at !== null,
                'resolucion' => $r->resolucion, 'estado_pedido' => $r->pedido?->estadoLabel(),
                'cliente' => $r->pedido?->cliente?->nombre_completo, 'cliente_id' => $r->pedido?->user_id,
                'negocio' => $r->pedido?->negocio?->nombre, 'negocio_id' => $r->pedido?->negocio_id,
                'domiciliario' => $r->pedido?->domiciliario?->nombre_completo, 'domiciliario_id' => $r->pedido?->domiciliario_id,
            ]),
            'pagina' => $pagina->currentPage(), 'ultima_pagina' => $pagina->lastPage(), 'total' => $pagina->total(),
        ]);
    }

    public function resolver(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate(['resolucion' => ['required', 'string', 'min:5', 'max:1000']]);
        PedidoReporte::findOrFail($id);
        $cambio = PedidoReporte::whereKey($id)->whereNull('resuelto_at')->update([
            'resuelto_at' => now(), 'resuelto_por' => $request->user()->id, 'resolucion' => trim($datos['resolucion']),
        ]);
        abort_unless($cambio, 409, 'Este reporte ya fue atendido.');

        return response()->json(['message' => 'Reporte atendido.']);
    }
}
