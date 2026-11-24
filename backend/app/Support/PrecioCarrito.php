<?php

namespace App\Support;

use App\Models\Producto;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

/**
 * Cotización verificable del precio de un producto para el carrito de un
 * cliente. El carrito ya no vence: la cotización solo prueba que el producto y
 * el cliente son los del carrito, y el pedido se cobra al precio vigente (si
 * cambió, la app lo muestra antes con el total esperado).
 */
class PrecioCarrito
{
    public static function reserva(string $token): array
    {
        return json_decode(Crypt::decryptString($token), true, flags: JSON_THROW_ON_ERROR);
    }

    public static function cotizar(Producto $producto, ?int $usuarioId): array
    {
        // Solo sirve para avisar a quien lo tiene en el carrito si cambia el
        // precio (ver carrito_reservas); el carrito no vence.
        $vence = now()->addDays(30);

        return [
            'precio_token' => Crypt::encryptString(json_encode([
                'producto_id' => $producto->id, 'usuario_id' => $usuarioId,
                'precio' => (float) $producto->precio, 'vence' => $vence->timestamp,
            ], JSON_THROW_ON_ERROR)),
            'precio_vence_at' => $vence->toIso8601String(),
        ];
    }

    public static function deItem(Producto $producto, array $item, int $usuarioId): float
    {
        if (empty($item['precio_token'])) {
            return (float) $producto->precio;
        }
        try {
            $reserva = self::reserva($item['precio_token']);
            if ($reserva['producto_id'] === $producto->id && $reserva['usuario_id'] === $usuarioId && (float) $reserva['precio'] > 0) {
                return (float) $producto->precio;
            }
        } catch (\Throwable) {
            // Una cotización alterada nunca permite fijar el precio desde la app.
        }
        throw ValidationException::withMessages(['items' => 'Un producto del carrito ya no es válido. Quítalo y agrégalo de nuevo.']);
    }
}
