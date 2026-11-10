<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;

/**
 * Qué pasa con las entregas de un domiciliario que deja de poder repartir
 * (lo suspenden). Lo que aún no recogió vuelve a ofrecerse a los demás; lo que
 * ya lleva encima no se puede reasignar y lo cierra un administrador.
 */
class EntregasDomiciliario
{
    /** Pedidos que ya recogió y siguen sin entregar. */
    public static function yaRecogidas(User $domiciliario): int
    {
        return Pedido::where('domiciliario_id', $domiciliario->id)
            ->whereIn('estado', Pedido::CON_CODIGO_ENTREGA)
            ->count();
    }

    /**
     * Devuelve a "listo" los pedidos que tomó y no ha recogido, y avisa a los
     * demás domiciliarios y al cliente.
     *
     * @return int cuántos se liberaron
     */
    public static function liberarSinRecoger(User $domiciliario): int
    {
        $liberados = 0;

        Pedido::where('domiciliario_id', $domiciliario->id)
            ->where('estado', 'tomado')
            ->pluck('id')
            ->each(function (int $id) use ($domiciliario, &$liberados) {
                // Update condicional: si el negocio confirma la recogida a la vez, gana uno.
                $afectados = Pedido::whereKey($id)
                    ->where('domiciliario_id', $domiciliario->id)
                    ->where('estado', 'tomado')
                    ->update([
                        'estado' => 'listo',
                        'domiciliario_id' => null,
                        'minutos_recogida' => null,
                        'tomado_at' => null,
                        'codigo_confirmacion' => null,
                    ]);

                if (! $afectados) {
                    return;
                }

                $liberados++;
                $pedido = Pedido::find($id);
                OfrecerPedido::aDomiciliarios($pedido, excepto: $domiciliario->id);

                if ($pedido->cliente) {
                    Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido, [
                        'Cambio de domiciliario 🛵',
                        'Estamos buscando otro domiciliario para tu pedido.',
                    ]));
                }
            });

        return $liberados;
    }
}
