<?php

namespace App\Support;

use App\Models\Negocio;
use App\Models\PedidoItem;
use App\Models\Producto;
use App\Models\TipoProducto;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Recetas preferidas del cliente en una tienda: un plato con los mismos
 * ingredientes quitados o con extra en MIN_PEDIDOS pedidos entregados o más.
 *
 * No se guardan aparte: salen del historial, así que aparecen solas al
 * entregarse el pedido y se van con él. Cada pedido cuenta una vez, aunque
 * traiga varias unidades. Se comparan contra el producto actual: un ingrediente
 * que el negocio quitó deja de contar, y un plato retirado no se recomienda.
 */
class RecetasPreferidas
{
    public const MIN_PEDIDOS = 2;

    private const MAX_RECETAS = 6;

    /**
     * Primero las que más ha pedido y, a igualdad, la más reciente.
     *
     * @return Collection<int, array{producto: Producto, opciones: array{sin?: array<int, string>, extra?: array<int, string>}, veces: int}>
     */
    public static function de(User $cliente, Negocio $negocio): Collection
    {
        return self::lineasConOpciones($cliente, $negocio)
            ->map(fn (PedidoItem $linea) => [
                'linea' => $linea,
                'opciones' => OpcionesPedido::normalizar($linea->producto, $linea->opciones),
            ])
            ->filter(fn (array $fila) => $fila['opciones'] !== null)
            ->groupBy(fn (array $fila) => $fila['linea']->producto_id.json_encode($fila['opciones']))
            ->map(fn (Collection $filas) => [
                'producto' => $filas->first()['linea']->producto,
                'opciones' => $filas->first()['opciones'],
                'veces' => $filas->pluck('linea.pedido_id')->unique()->count(),
                'ultimo' => $filas->max('linea.pedido_id'),
            ])
            ->filter(fn (array $receta) => $receta['veces'] >= self::MIN_PEDIDOS)
            ->sortBy([['veces', 'desc'], ['ultimo', 'desc']])
            ->take(self::MAX_RECETAS)
            ->map(fn (array $receta) => collect($receta)->except('ultimo')->all())
            ->values();
    }

    /** @return Collection<int, PedidoItem> Solo de platos que hoy se pueden pedir. */
    private static function lineasConOpciones(User $cliente, Negocio $negocio): Collection
    {
        return PedidoItem::query()
            ->whereNotNull('opciones')
            ->whereHas('pedido', fn ($q) => $q
                ->where('user_id', $cliente->id)
                ->where('negocio_id', $negocio->id)
                ->where('estado', 'entregado'))
            ->whereHas('producto', fn ($q) => $q
                ->where('negocio_id', $negocio->id)
                ->where('disponible', true)
                ->whereHas('tipoProducto', fn ($t) => $t->where('slug', TipoProducto::SLUG_COMIDA)))
            ->with(['producto.categoria', 'producto.tipoProducto'])
            ->get();
    }
}
