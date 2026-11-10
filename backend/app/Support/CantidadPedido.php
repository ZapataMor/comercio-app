<?php

namespace App\Support;

use App\Models\Producto;
use Illuminate\Validation\ValidationException;

class CantidadPedido
{
    public static function validar(Producto $producto, mixed $cantidad): void
    {
        $valor = (float) $cantidad;
        $peso = $producto->tipo_venta === 'peso';
        $valida = $valor >= ($peso ? 0.001 : 1) && $valor <= 99
            && abs($valor - round($valor, $peso ? 3 : 0)) < 0.00000001;
        if (! $valida) {
            throw ValidationException::withMessages(['items' => $peso
                ? "La cantidad de {$producto->nombre} debe estar entre 0,001 y 99, con hasta tres decimales."
                : "La cantidad de {$producto->nombre} debe ser un número entero entre 1 y 99."]);
        }
    }
}
