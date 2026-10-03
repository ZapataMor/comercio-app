<?php

namespace App\Notifications;

use App\Models\Pedido;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Avisa al COMERCIO que acaba de entrar un pedido nuevo (estado "pendiente").
 */
class NuevoPedidoParaComercio extends Notification
{
    use UsaCanalPedidosFcm;

    public function __construct(public Pedido $pedido)
    {
    }

    /** Solo canal push (FCM). */
    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $total = '$' . number_format((float) $this->pedido->total, 0, ',', '.');

        return (new FcmMessage(
            notification: new FcmNotification(
                title: '¡Nuevo pedido! 🛒',
                body: "Recibiste un pedido por {$total}. Tócalo para prepararlo.",
            ),
        ))
            ->android($this->androidAlertaAlta())
            ->data([
            'tipo' => 'nuevo_pedido',
            'pedido_id' => (string) $this->pedido->id,
            // Una persona puede ser miembro de varios negocios: la app abre
            // el pedido dentro del negocio correcto.
            'negocio_id' => (string) $this->pedido->negocio_id,
            'estado' => 'pendiente',
        ]);
    }
}
