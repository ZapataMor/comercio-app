<?php

namespace App\Support;

use App\Models\Pedido;
use App\Notifications\PedidoCancelado;
use App\Notifications\PedidoYaAtendido;

/**
 * Cancelar un pedido antes de que salga del negocio.
 *
 *  - El CLIENTE puede cancelar mientras el negocio no lo tenga listo
 *    ('pendiente' o 'aceptado').
 *  - El NEGOCIO puede rechazarlo mientras está 'pendiente', cancelarlo
 *    después de aceptarlo (sin consecuencias los primeros minutos, ver
 *    penaliza()) o cancelarlo si está 'listo' y ningún domiciliario lo ha
 *    tomado (nadie disponible).
 *  - El SISTEMA lo cancela si nadie del negocio respondió a tiempo
 *    (comando `pedidos:vencer`).
 *
 * Después de que un domiciliario lo toma ya no se cancela desde la app.
 * El cambio es un update condicional: si en el mismo instante un domiciliario
 * lo toma, gana uno solo y el otro recibe "ya no se puede".
 */
class CancelarPedido
{
    public const POR_CLIENTE = 'cliente';

    public const POR_NEGOCIO = 'negocio';

    public const POR_SISTEMA = 'sistema';

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
        return match ($quien) {
            self::POR_NEGOCIO => ['pendiente', 'aceptado', 'listo'],
            self::POR_SISTEMA => ['pendiente'],
            default => ['pendiente', 'aceptado'],
        };
    }

    /**
     * ¿Si el negocio cancela ahora, baja su confiabilidad? Solo si lo aceptó
     * hace más de `reputacion.minutos_cancelacion_libre`. Un pedido listo que
     * nadie toma no cuenta: ahí la falta no es del negocio.
     */
    public static function penaliza(Pedido $pedido): bool
    {
        return $pedido->estado === 'aceptado'
            && $pedido->aceptado_at?->lt(now()->subMinutes((int) config('reputacion.minutos_cancelacion_libre')));
    }

    public static function puede(Pedido $pedido, string $quien): bool
    {
        return in_array($pedido->estado, self::estadosPermitidos($quien), true)
            && $pedido->domiciliario_id === null;
    }

    /** Cancela y avisa a la otra parte. Devuelve false si ya no se podía. */
    public static function ejecutar(Pedido $pedido, string $quien, ?string $motivo): bool
    {
        $penalizar = $quien === self::POR_NEGOCIO && self::penaliza($pedido);

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

        if ($penalizar && $pedido->negocio) {
            Reputacion::registrar(Reputacion::NEGOCIO, $pedido->negocio, 'cancelo_tras_aceptar', $pedido);
        }

        self::avisar($pedido, $quien);

        return true;
    }

    /**
     * El cliente se entera si no fue él quien canceló. Al equipo se le avisa
     * si no fue uno de ellos; si fue, un aviso silencioso calla la alarma en
     * los demás teléfonos.
     */
    private static function avisar(Pedido $pedido, string $quien): void
    {
        if ($quien !== self::POR_CLIENTE && $pedido->cliente) {
            Push::enviar($pedido->cliente, new PedidoCancelado($pedido));
        }

        $equipo = $pedido->negocio?->miembrosActivos()->get();
        if ($equipo && $equipo->isNotEmpty()) {
            Push::enviar($equipo, $quien === self::POR_NEGOCIO ? new PedidoYaAtendido($pedido) : new PedidoCancelado($pedido));
        }
    }
}
