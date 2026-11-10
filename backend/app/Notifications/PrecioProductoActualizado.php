<?php

namespace App\Notifications;

use App\Models\Producto;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

class PrecioProductoActualizado extends Notification implements ShouldQueue
{
    use Queueable, UsaCanalPedidosFcm;

    public function __construct(public Producto $producto) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        return (new FcmMessage(notification: new FcmNotification(
            title: 'Cambió el precio de '.$this->producto->nombre,
            body: 'Revisa tu carrito para conservar el producto o eliminarlo. El precio reservado se mantiene hasta que venza el carrito.',
        )))->android($this->androidAlertaAlta())->data(['tipo' => 'precio_carrito', 'producto_id' => (string) $this->producto->id]);
    }
}
