<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Avisa a los DOMICILIARIOS que hay un pedido "listo" disponible para tomar.
 */
class PedidoDisponibleParaDomiciliario extends Notification
{
    public function __construct(public Pedido $pedido)
    {
    }

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $negocio = $this->pedido->negocio?->nombre ?? 'Un negocio';

        return (new FcmMessage(
            notification: new FcmNotification(
                title: 'Pedido listo para recoger 🛵',
                body: "{$negocio} tiene un pedido listo. ¡Tómalo antes que otro!",
            ),
        ))->data([
            'tipo' => 'pedido_disponible',
            'pedido_id' => (string) $this->pedido->id,
            'estado' => 'listo',
        ]);
    }
}
