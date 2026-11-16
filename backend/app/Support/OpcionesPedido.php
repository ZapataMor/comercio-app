<?php

namespace App\Support;

use App\Models\Producto;
use App\Models\TipoProducto;

/**
 * Lo que el cliente puede elegir en una línea del pedido, según el tipo del
 * producto: talla y color (ropa y calzado) o, en la comida, los ingredientes
 * que quita (solo los que se pueden quitar) y los extras que pide aparte, con
 * cuántas porciones de cada uno. Los demás tipos no tienen opciones.
 *
 * El carrito vive en el teléfono y su copia del producto puede estar vieja:
 * aquí se compara siempre contra el producto actual, y el precio de cada extra
 * sale del producto, nunca de lo que mande la app.
 */
class OpcionesPedido
{
    /** Porciones máximas de un mismo extra en una unidad del producto. */
    public const MAX_PORCIONES_EXTRA = 10;

    /**
     * Mensaje para el cliente si la línea no se puede pedir así, o null si está
     * bien. Solo la talla y el color lo impiden: sin ellos el negocio no sabría
     * qué despachar.
     *
     * @param  array<string, mixed>  $item
     */
    public static function problema(Producto $producto, array $item): ?string
    {
        if ($producto->tipoProducto?->slug !== TipoProducto::SLUG_ROPA) {
            return null;
        }

        return self::problemaDe('la talla', $item['talla'] ?? null, $producto->atributos ?? [], $producto)
            ?? self::problemaDe('el color', $item['color'] ?? null, $producto->colores ?? [], $producto);
    }

    /**
     * Opciones listas para guardar en la línea, o null si no hay ninguna.
     * De los ingredientes solo pasan los que trae el producto y se pueden
     * quitar, y de los extras solo los que ofrece hoy, con su precio de hoy: si
     * el negocio quitó uno después de que el cliente lo marcó, se ignora.
     *
     * @param  array<string, mixed>  $item
     * @return array{talla?: string, color?: string, sin?: array<int, string>, extras?: array<int, array{nombre: string, cantidad: int, precio: float}>}|null
     */
    public static function normalizar(Producto $producto, array $item): ?array
    {
        $opciones = match ($producto->tipoProducto?->slug) {
            TipoProducto::SLUG_ROPA => [
                'talla' => $item['talla'] ?? null,
                'color' => $item['color'] ?? null,
            ],
            TipoProducto::SLUG_COMIDA => [
                'sin' => self::sinIngredientes($producto, $item['sin'] ?? []),
                'extras' => self::extras($producto, $item['extras'] ?? []),
            ],
            default => [],
        };

        return array_filter($opciones) ?: null;
    }

    /**
     * Lo que suman los extras a UNA unidad del producto, según las opciones ya
     * normalizadas (o las guardadas en una línea).
     *
     * @param  array<string, mixed>|null  $opciones
     */
    public static function costoExtras(?array $opciones): float
    {
        return round(collect($opciones['extras'] ?? [])
            ->sum(fn ($extra) => (float) ($extra['precio'] ?? 0) * (int) ($extra['cantidad'] ?? 0)), 2);
    }

    /**
     * @param  array<int, mixed>  $pedidos
     * @return array<int, string>
     */
    private static function sinIngredientes(Producto $producto, array $pedidos): array
    {
        $quitables = array_diff($producto->atributos ?? [], $producto->ingredientes_fijos ?? []);

        return array_values(array_intersect($quitables, $pedidos));
    }

    /**
     * Los extras del producto con las porciones pedidas, en el orden del
     * producto. Un nombre repetido en la app cuenta una sola vez.
     *
     * @param  array<int, mixed>  $pedidos
     * @return array<int, array{nombre: string, cantidad: int, precio: float}>
     */
    private static function extras(Producto $producto, array $pedidos): array
    {
        $porciones = collect($pedidos)
            ->filter(fn ($e) => is_array($e) && isset($e['nombre']))
            ->mapWithKeys(fn ($e) => [(string) $e['nombre'] => (int) ($e['cantidad'] ?? 0)]);

        return collect($producto->extras ?? [])
            ->map(fn ($extra) => [
                'nombre' => $extra['nombre'],
                'cantidad' => min(self::MAX_PORCIONES_EXTRA, max(0, $porciones->get($extra['nombre'], 0))),
                'precio' => (float) ($extra['precio'] ?? 0),
            ])
            ->filter(fn ($extra) => $extra['cantidad'] > 0)
            ->values()
            ->all();
    }

    /** @param  array<int, string>  $disponibles */
    private static function problemaDe(string $que, ?string $elegido, array $disponibles, Producto $producto): ?string
    {
        if ($disponibles === []) {
            return null;
        }
        if ($elegido === null) {
            return "Falta elegir {$que} de \"{$producto->nombre}\". Quítalo del carrito y agrégalo de nuevo desde el catálogo.";
        }
        if (! in_array($elegido, $disponibles, true)) {
            return ucfirst($que)." {$elegido} de \"{$producto->nombre}\" ya no está disponible. Elige otra opción en tu carrito.";
        }

        return null;
    }
}
