<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\PedidoReporte;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\PedidoCancelado;
use App\Notifications\PedidoYaAtendido;
use Illuminate\Support\Facades\DB;

/**
 * Cancelar un pedido antes de que salga del negocio.
 *
 *  - El CLIENTE puede cancelar hasta antes de 'en_camino'. Si ya fue
 *    recogido, pasa a devolución hasta que el comercio confirme la recepción.
 *  - El NEGOCIO puede rechazarlo o cancelarlo antes de marcarlo listo,
 *    dejando un motivo escrito. Ver penaliza() para lo ya aceptado.
 *  - El SISTEMA lo cancela si nadie del negocio respondió a tiempo
 *    (comando `pedidos:vencer`).
 *
 * El bloqueo y las transiciones condicionales evitan cancelar al mismo
 * tiempo que el domiciliario sale en camino o confirma una entrega.
 */
class CancelarPedido
{
    public const POR_CLIENTE = 'cliente';

    public const POR_NEGOCIO = 'negocio';

    public const POR_SISTEMA = 'sistema';

    /** Cierre manual de un pedido atascado (ver AdminPedidoController). */
    public const POR_ADMIN = 'administrador';

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
            self::POR_NEGOCIO => ['pendiente', 'aceptado'],
            self::POR_SISTEMA => ['pendiente'],
            self::POR_CLIENTE => ['pendiente', 'aceptado', 'listo', 'tomado', 'recogido'],
            default => [],
        };
    }

    /**
     * ¿Si el negocio cancela ahora, baja su confiabilidad? Solo si lo aceptó
     * hace más de `reputacion.minutos_cancelacion_libre`.
     */
    public static function penaliza(Pedido $pedido): bool
    {
        return $pedido->estado === 'aceptado'
            && $pedido->aceptado_at?->lt(now()->subMinutes((int) config('reputacion.minutos_cancelacion_libre')));
    }

    public static function puede(Pedido $pedido, string $quien): bool
    {
        return in_array($pedido->estado, self::estadosPermitidos($quien), true);
    }

    /** Cancela y avisa a la otra parte. Devuelve false si ya no se podía. */
    public static function ejecutar(Pedido $pedido, string $quien, ?string $motivo): bool
    {
        $resultado = DB::transaction(function () use ($pedido, $quien, $motivo) {
            $actual = Pedido::whereKey($pedido->id)->lockForUpdate()->first();
            if (! $actual || ! self::puede($actual, $quien)) {
                return null;
            }
            $devolver = $actual->estado === 'recogido';
            $resultado = ['ofrecido' => $actual->estado === 'listo', 'penalizar' => $quien === self::POR_NEGOCIO && self::penaliza($actual)];
            $actual->update([
                'estado' => $devolver ? 'devolviendo' : 'cancelado',
                'cancelado_por' => $quien,
                'motivo_cancelacion' => $motivo ? mb_substr(trim($motivo), 0, 255) : null,
                'cancelado_at' => $devolver ? null : now(),
                'codigo_confirmacion' => null,
            ]);
            if ($quien === self::POR_SISTEMA || $quien === self::POR_NEGOCIO) {
                PedidoReporte::registrar($actual, 'negocio', $quien === self::POR_SISTEMA ? 'sin_aceptar' : 'cancelacion_comercio', $motivo ?: 'El comercio no aceptó el pedido dentro del tiempo establecido.');
            }
            if ($quien === self::POR_SISTEMA && $actual->negocio) {
                Reputacion::registrar(Reputacion::NEGOCIO, $actual->negocio, 'pedido_vencido', $actual);
            }

            return $resultado;
        });
        if (! $resultado) {
            return false;
        }

        $pedido->refresh();

        if ($resultado['penalizar'] && $pedido->negocio) {
            Reputacion::registrar(Reputacion::NEGOCIO, $pedido->negocio, 'cancelo_tras_aceptar', $pedido);
        }

        self::avisar($pedido, $quien);

        if ($pedido->domiciliario) {
            Push::enviar($pedido->domiciliario, new EstadoPedidoActualizado($pedido, $pedido->estado === 'devolviendo'
                ? ['Devuelve el pedido al comercio', 'El cliente canceló antes de salir en camino. El comercio debe confirmar la devolución.']
                : ['Pedido cancelado', 'El cliente canceló el pedido. Ya no debes recogerlo.']));
        }

        if ($resultado['ofrecido']) {
            OfrecerPedido::retirar($pedido);
        }

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
