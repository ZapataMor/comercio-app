<?php

namespace App\Support;

use App\Models\Producto;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

/** Reserva verificable de un precio por un máximo de una hora. */
class PrecioCarrito
{
    public static function reserva(string $token): array
    {
        return json_decode(Crypt::decryptString($token), true, flags: JSON_THROW_ON_ERROR);
    }

    public static function cotizar(Producto $producto, ?int $usuarioId): array
    {
        $vence = now()->addHour();

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
            if ($reserva['producto_id'] === $producto->id && $reserva['usuario_id'] === $usuarioId && $reserva['vence'] > now()->timestamp) {
                return (float) $reserva['precio'];
            }
        } catch (\Throwable) {
            // Una cotización alterada nunca permite fijar el precio desde la app.
        }
        throw ValidationException::withMessages(['items' => 'El carrito venció o su precio ya no es válido. Agrega de nuevo los productos.']);
    }
}
