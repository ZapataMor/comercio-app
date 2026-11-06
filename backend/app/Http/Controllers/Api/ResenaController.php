<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Resena;
use App\Support\Resenas;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Reseñas públicas de tiendas y productos (ver Support\Resenas). */
class ResenaController extends Controller
{
    /**
     * Reseñas de una tienda o, con `?producto_id=`, de uno de sus productos:
     * resumen con la distribución de estrellas y 20 reseñas por página.
     */
    public function index(Request $request, int $id): JsonResponse
    {
        $negocio = Negocio::whereNull('vetado_at')->whereNull('archivado_at')->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no encontrado.'], 404);
        }

        $productoId = $request->integer('producto_id') ?: null;
        $resenas = Resena::where('negocio_id', $negocio->id)
            ->when($productoId, fn ($q) => $q->where('producto_id', $productoId), fn ($q) => $q->whereNull('producto_id'));

        $conteo = (clone $resenas)
            ->selectRaw('estrellas, count(*) as cantidad')
            ->groupBy('estrellas')
            ->pluck('cantidad', 'estrellas');
        $total = (int) $conteo->sum();
        $pagina = (clone $resenas)->with('user')->latest()->latest('id')->paginate(20);

        return response()->json([
            'resumen' => [
                'promedio' => $total ? round($conteo->map(fn ($n, $e) => $n * $e)->sum() / $total, 1) : null,
                'total' => $total,
                'distribucion' => collect([5, 4, 3, 2, 1])
                    ->map(fn ($e) => ['estrellas' => $e, 'cantidad' => (int) ($conteo[$e] ?? 0)])
                    ->all(),
            ],
            'resenas' => collect($pagina->items())->map(fn (Resena $r) => Resenas::publica($r))->values(),
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
        ]);
    }

    /**
     * El cliente reseña lo que compró: la tienda, los productos o ambos. Se
     * puede enviar por partes y corregir mientras dure el plazo.
     */
    public function guardar(Request $request, int $id): JsonResponse
    {
        $pedido = $request->user()->pedidos()
            ->with(['negocio', 'items.producto', 'calificacion'])
            ->find($id);

        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        if (! $pedido->puedeResenarse()) {
            return response()->json(['message' => 'Este pedido ya no se puede reseñar.'], 409);
        }

        $datos = $request->validate([
            'tienda' => ['nullable', 'array', 'required_without:productos'],
            'tienda.estrellas' => ['required_with:tienda', 'integer', 'between:1,5'],
            'tienda.comentario' => ['nullable', 'string', 'max:500'],
            'productos' => ['nullable', 'array', 'required_without:tienda'],
            'productos.*.producto_id' => ['required', 'integer', 'distinct', Rule::in(Resenas::productosResenables($pedido))],
            'productos.*.estrellas' => ['required', 'integer', 'between:1,5'],
            'productos.*.comentario' => ['nullable', 'string', 'max:500'],
        ], [
            'tienda.required_without' => 'Califica la tienda o al menos un producto.',
            'productos.required_without' => 'Califica la tienda o al menos un producto.',
            'productos.*.producto_id.in' => 'Ese producto no está en este pedido.',
            'tienda.estrellas.between' => 'Elige de 1 a 5 estrellas.',
            'productos.*.estrellas.between' => 'Elige de 1 a 5 estrellas.',
        ]);

        Resenas::guardar($pedido, $datos['tienda'] ?? null, $datos['productos'] ?? []);

        return response()->json(['message' => '¡Gracias! Tu reseña ayuda a otros clientes.'], 201);
    }
}
