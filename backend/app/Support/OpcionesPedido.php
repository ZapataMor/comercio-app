<?php

namespace App\Support;

use App\Models\Producto;
use App\Models\TipoProducto;

/**
 * Lo que el cliente puede elegir en una línea del pedido, según el tipo del
 * producto: talla y color (ropa y calzado) o ingredientes que quita o de los
 * que quiere más (comida). Los demás tipos no tienen opciones.
 *
 * El carrito vive en el teléfono y su copia del producto puede estar vieja:
 * aquí se compara siempre contra el producto actual.
 */
class OpcionesPedido
{
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
     * De los ingredientes solo pasan los que trae el producto: si el negocio
     * quitó uno después de que el cliente lo marcó, simplemente se ignora.
     *
     * @param  array<string, mixed>  $item
     * @return array{talla?: string, color?: string, sin?: array<int, string>, extra?: array<int, string>}|null
     */
    public static function normalizar(Producto $producto, array $item): ?array
    {
        $opciones = match ($producto->tipoProducto?->slug) {
            TipoProducto::SLUG_ROPA => [
                'talla' => $item['talla'] ?? null,
                'color' => $item['color'] ?? null,
            ],
            TipoProducto::SLUG_COMIDA => self::ingredientes($producto, $item),
            default => [],
        };

        return array_filter($opciones) ?: null;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{sin: array<int, string>, extra: array<int, string>}
     */
    private static function ingredientes(Producto $producto, array $item): array
    {
        $incluidos = $producto->atributos ?? [];
        $sin = array_values(array_intersect($incluidos, $item['sin'] ?? []));

        return [
            'sin' => $sin,
            'extra' => array_values(array_diff(array_intersect($incluidos, $item['extra'] ?? []), $sin)),
        ];
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
