<?php

namespace App\Support;

use App\Models\Pedido;
use App\Notifications\PedidoCancelado;

/**
 * Cancelar un pedido antes de que salga del negocio.
 *
 *  - El CLIENTE puede cancelar mientras el pedido está 'pendiente' (el
 *    negocio aún no lo marca listo).
 *  - El NEGOCIO puede rechazarlo mientras está 'pendiente' (se agotó algo,
 *    va a cerrar…) o cancelarlo si está 'listo' y ningún domiciliario lo ha
 *    tomado (nadie disponible).
 *
 * Después de que un domiciliario lo toma ya no se cancela desde la app.
 * El cambio es un update condicional: si en el mismo instante un domiciliario
 * lo toma, gana uno solo y el otro recibe "ya no se puede".
 */
class CancelarPedido
{
    public const POR_CLIENTE = 'cliente';

    public const POR_NEGOCIO = 'negocio';

    /** Motivos sugeridos en la app (el texto es libre). */
    public const MOTIVOS_NEGOCIO = [
        'Se agotó un producto',
        'Estamos por cerrar',
        'No hay domiciliario disponible',
        'Dirección fuera de cobertura',
    ];

    public const MOTIVOS_CLIENTE = [
        'Me equivoqué en el pedido',
        'Se demora mucho',
        'Ya no lo necesito',
    ];

    /** Estados desde los que cada quien puede cancelar. */
    public static function estadosPermitidos(string $quien): array
    {
        return $quien === self::POR_NEGOCIO ? ['pendiente', 'listo'] : ['pendiente'];
    }

    public static function puede(Pedido $pedido, string $quien): bool
    {
        return in_array($pedido->estado, self::estadosPermitidos($quien), true)
            && $pedido->domiciliario_id === null;
    }

    /** Cancela y avisa a la otra parte. Devuelve false si ya no se podía. */
    public static function ejecutar(Pedido $pedido, string $quien, ?string $motivo): bool
    {
        $afectados = Pedido::whereKey($pedido->id)
            ->whereIn('estado', self::estadosPermitidos($quien))
            ->whereNull('domiciliario_id')
            ->update([
                'estado' => 'cancelado',
                'cancelado_por' => $quien,
                'motivo_cancelacion' => $motivo ? mb_substr(trim($motivo), 0, 255) : null,
                'cancelado_at' => now(),
            ]);

        if (! $afectados) {
            return false;
        }

        $pedido->refresh();

        if ($quien === self::POR_CLIENTE) {
            $equipo = $pedido->negocio?->miembrosActivos()->get();
            if ($equipo && $equipo->isNotEmpty()) {
                Push::enviar($equipo, new PedidoCancelado($pedido));
            }
        } elseif ($pedido->cliente) {
            Push::enviar($pedido->cliente, new PedidoCancelado($pedido));
        }

        return true;
    }
}
