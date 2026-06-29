<?php

namespace App\Notifications\Concerns;

trait UsaCanalPedidosFcm
{
    private const CANAL_PEDIDOS_FCM = 'pedidos';

    /**
     * Fuerza alertas visibles en Android cuando FCM muestra la notificacion
     * con la app en segundo plano o cerrada.
     *
     * En primer plano Notifee usa el mismo canal desde React Native.
     *
     * @return array<string, mixed>
     */
    private function androidAlertaAlta(): array
    {
        return [
            'priority' => 'high',
            'notification' => [
                'channel_id' => self::CANAL_PEDIDOS_FCM,
                'notification_priority' => 'PRIORITY_HIGH',
                'default_sound' => true,
                'default_vibrate_timings' => true,
            ],
        ];
    }
}
