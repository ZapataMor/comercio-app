<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Resena;
use App\Models\ResenaReporte;
use App\Support\ModeracionResenas;
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
        $negocio = Negocio::whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at')->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no encontrado.'], 404);
        }

        $productoId = $request->integer('producto_id') ?: null;
        $resenas = Resena::visibles()
            ->where('negocio_id', $negocio->id)
            ->when($productoId, fn ($q) => $q->where('producto_id', $productoId), fn ($q) => $q->whereNull('producto_id'));

        $conteo = (clone $resenas)
            ->selectRaw('estrellas, count(*) as cantidad')
            ->groupBy('estrellas')
            ->pluck('cantidad', 'estrellas');
        $total = (int) $conteo->sum();
        $pagina = (clone $resenas)->with('user')->latest()->latest('id')->paginate(20);

        $yo = $request->user();
        $esPropietario = $negocio->administra($yo);
        $reportadas = ResenaReporte::where('user_id', $yo->id)
            ->whereIn('resena_id', collect($pagina->items())->pluck('id'))
            ->pluck('resena_id')
            ->flip();

        return response()->json([
            'resumen' => [
                'promedio' => $total ? round($conteo->map(fn ($n, $e) => $n * $e)->sum() / $total, 1) : null,
                'total' => $total,
                'distribucion' => collect([5, 4, 3, 2, 1])
                    ->map(fn ($e) => ['estrellas' => $e, 'cantidad' => (int) ($conteo[$e] ?? 0)])
                    ->all(),
            ],
            'resenas' => collect($pagina->items())
                ->map(fn (Resena $r) => Resenas::publica($r, $yo, $reportadas->has($r->id), $esPropietario))
                ->values(),
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

    /** Cualquier usuario avisa al admin que una reseña no debería estar. Una vez por reseña. */
    public function reportar(Request $request, int $id): JsonResponse
    {
        $resena = Resena::visibles()->find($id);

        if (! $resena) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        $datos = $request->validate([
            'motivo' => ['required', Rule::in(array_keys(ModeracionResenas::MOTIVOS_REPORTE))],
        ], [
            'motivo.required' => 'Elige un motivo.',
            'motivo.in' => 'Elige un motivo.',
        ]);

        $yo = $request->user();

        if ($resena->user_id === $yo->id) {
            return response()->json(['message' => 'No puedes reportar tu propia reseña.'], 422);
        }

        // Reportar dos veces no suma: el índice único evita el doble envío.
        ResenaReporte::firstOrCreate(
            ['resena_id' => $resena->id, 'user_id' => $yo->id],
            ['motivo' => $datos['motivo']],
        );

        return response()->json(['message' => 'Gracias por avisar. Vamos a revisarla.'], 201);
    }

    /** El propietario de la tienda responde bajo la reseña, una sola vez. */
    public function responder(Request $request, int $id): JsonResponse
    {
        $resena = Resena::visibles()->with('negocio')->find($id);

        if (! $resena) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        if (! $resena->negocio->administra($request->user())) {
            return response()->json(['message' => 'Solo el propietario de la tienda puede responder.'], 403);
        }

        $datos = $request->validate([
            'respuesta' => ['required', 'string', 'max:500'],
        ], [
            'respuesta.required' => 'Escribe tu respuesta.',
        ]);

        // Condicional: dos envíos seguidos no se pisan la respuesta.
        $guardada = Resena::whereKey($resena->id)->whereNull('respuesta')->update([
            'respuesta' => trim($datos['respuesta']),
            'respondida_at' => now(),
        ]);

        if (! $guardada) {
            return response()->json(['message' => 'Esta reseña ya tiene tu respuesta.'], 409);
        }

        return response()->json([
            'message' => 'Respuesta publicada.',
            'respuesta' => Resenas::respuesta($resena->refresh()),
        ], 201);
    }
}
