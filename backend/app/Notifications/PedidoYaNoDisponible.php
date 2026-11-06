<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;

/**
 * Aviso SILENCIOSO a los domiciliarios: el pedido que se les ofreció ya no se
 * puede tomar (otro lo tomó o se canceló), así que la app quita su notificación
 * o su modal. No muestra nada: solo lo recibe la app (mensaje de datos de
 * prioridad alta).
 */
class PedidoYaNoDisponible extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Pedido $pedido)
    {
    }

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        return (new FcmMessage)
            ->android(['priority' => 'high'])
            ->data([
                'tipo' => 'pedido_no_disponible',
                'pedido_id' => (string) $this->pedido->id,
            ]);
    }
}
