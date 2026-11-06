<?php

namespace App\Support;

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\Producto;
use App\Models\Resena;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Reseñas públicas de tiendas y productos. No tocan el nivel de confiabilidad
 * (Support\Reputacion): ese mide si cumplieron con el pedido; estas, si la
 * tienda y sus productos le gustaron al cliente.
 */
class Resenas
{
    private const TIENDA = 'tienda';

    /** Promedio y total, tal como los usa la app. */
    public static function resumen(Negocio|Producto $sujeto): array
    {
        return [
            'promedio' => $sujeto->resenas_promedio === null ? null : (float) $sujeto->resenas_promedio,
            'total' => (int) $sujeto->resenas_total,
        ];
    }

    /**
     * Crea o corrige las reseñas de un pedido: se puede reseñar la tienda hoy
     * y un producto cuando se haya usado, y cambiar de opinión dentro del plazo.
     *
     * @param  array{estrellas: int, comentario?: ?string}|null  $tienda
     * @param  array<int, array{producto_id: int, estrellas: int, comentario?: ?string}>  $productos
     */
    public static function guardar(Pedido $pedido, ?array $tienda, array $productos): void
    {
        DB::transaction(function () use ($pedido, $tienda, $productos) {
            if ($tienda) {
                self::escribir($pedido, null, $tienda);
                self::recalcular($pedido->negocio);
            }

            foreach ($productos as $datos) {
                $productoId = (int) $datos['producto_id'];
                self::escribir($pedido, $productoId, $datos);
                self::recalcular(Producto::findOrFail($productoId));
            }
        });
    }

    /** Vuelve a contar el promedio y el total de una tienda o un producto. */
    public static function recalcular(Negocio|Producto $sujeto): void
    {
        $resenas = $sujeto instanceof Producto
            ? Resena::visibles()->where('producto_id', $sujeto->id)
            : Resena::visibles()->where('negocio_id', $sujeto->id)->whereNull('producto_id');

        $promedio = (clone $resenas)->avg('estrellas');

        // Sin pasar por el modelo: una reseña no es un cambio del catálogo.
        $sujeto->newQueryWithoutScopes()->whereKey($sujeto->id)->toBase()->update([
            'resenas_promedio' => $promedio === null ? null : round((float) $promedio, 1),
            'resenas_total' => (clone $resenas)->count(),
        ]);
    }

    /**
     * Lo que se ve en público de una reseña, más lo que quien mira puede hacer
     * con ella.
     *
     * @param  bool  $reportada  quien mira ya la reportó
     * @param  bool  $esPropietario  quien mira es dueño de la tienda reseñada
     */
    public static function publica(Resena $resena, User $yo, bool $reportada, bool $esPropietario): array
    {
        return [
            'id' => $resena->id,
            'autor' => self::autor($resena->user),
            'estrellas' => $resena->estrellas,
            'comentario' => $resena->comentario,
            'fecha' => $resena->created_at->format('d/m/Y'),
            'respuesta' => self::respuesta($resena),
            'propia' => $resena->user_id === $yo->id,
            'reportada' => $reportada,
            'puede_responder' => $esPropietario && $resena->respuesta === null,
        ];
    }

    /** @return array{texto: string, fecha: string}|null */
    public static function respuesta(Resena $resena): ?array
    {
        return $resena->respuesta === null ? null : [
            'texto' => $resena->respuesta,
            'fecha' => $resena->respondida_at->format('d/m/Y'),
        ];
    }

    /**
     * Las reseñas del cliente en este pedido y lo que aún puede reseñar; null
     * si no hay nada que mostrar.
     */
    public static function dePedido(Pedido $pedido): ?array
    {
        $editable = $pedido->puedeResenarse();
        $resenas = $pedido->resenas->keyBy('objeto');

        if (! $editable && $resenas->isEmpty()) {
            return null;
        }

        $productos = self::lineasPorProducto($pedido)
            ->filter(fn (PedidoItem $i) => $resenas->has(self::objeto($i->producto_id)) || ($editable && $i->producto))
            ->map(function (PedidoItem $i) use ($resenas) {
                $resena = $resenas->get(self::objeto($i->producto_id));

                return [
                    'producto_id' => $i->producto_id,
                    'nombre' => $i->nombre,
                    'imagen' => $i->producto?->imagen ? '/storage/'.$i->producto->imagen : null,
                    'estrellas' => $resena?->estrellas,
                    'comentario' => $resena?->comentario,
                ];
            })
            ->values();

        $tienda = $resenas->get(self::TIENDA);

        return [
            'tienda' => $tienda ? ['estrellas' => $tienda->estrellas, 'comentario' => $tienda->comentario] : null,
            'productos' => $productos,
            'hasta' => ($pedido->entregado_at ?? $pedido->updated_at)
                ->copy()->addDays((int) config('reputacion.dias_para_resenar'))->format('d/m/Y'),
        ];
    }

    /** Ids de los productos del pedido que se pueden reseñar. */
    public static function productosResenables(Pedido $pedido): array
    {
        return self::lineasPorProducto($pedido)
            ->filter(fn (PedidoItem $i) => $i->producto !== null)
            ->pluck('producto_id')
            ->values()
            ->all();
    }

    /** Una línea por producto: dos tallas de la misma camisa son una reseña. */
    private static function lineasPorProducto(Pedido $pedido): Collection
    {
        return $pedido->items->whereNotNull('producto_id')->unique('producto_id');
    }

    private static function escribir(Pedido $pedido, ?int $productoId, array $datos): void
    {
        Resena::updateOrCreate(
            ['pedido_id' => $pedido->id, 'objeto' => $productoId ? self::objeto($productoId) : self::TIENDA],
            [
                'user_id' => $pedido->user_id,
                'negocio_id' => $pedido->negocio_id,
                'producto_id' => $productoId,
                'estrellas' => (int) $datos['estrellas'],
                'comentario' => filled($datos['comentario'] ?? null) ? trim($datos['comentario']) : null,
            ],
        );
    }

    private static function objeto(int $productoId): string
    {
        return "producto:{$productoId}";
    }

    /** Nombre e inicial ("Ana M."): las reseñas son públicas. */
    private static function autor(User $user): string
    {
        if ($user->eliminado_at) {
            return 'Cliente de Vitrina';
        }

        $partes = preg_split('/\s+/', trim("{$user->name} {$user->apellidos}"));
        $inicial = isset($partes[1]) ? ' '.mb_strtoupper(mb_substr($partes[1], 0, 1)).'.' : '';

        return $partes[0].$inicial;
    }
}
