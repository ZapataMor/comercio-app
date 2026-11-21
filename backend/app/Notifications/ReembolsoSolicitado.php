<?php

namespace App\Notifications;

use App\Models\Pedido;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

class ReembolsoSolicitado extends Notification implements ShouldQueue
{
    use Queueable, UsaCanalPedidosFcm;

    public function __construct(public Pedido $pedido) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        return (new FcmMessage(notification: new FcmNotification(
            title: 'Solicitud de reembolso · Pedido #'.$this->pedido->codigo,
            body: 'Debes devolverle la transferencia al cliente. Abre el pedido: ahí ves a dónde devolverla y la marcas como devuelta.',
        )))->android($this->androidAlertaAlta())->data(['tipo' => 'reembolso_solicitado', 'pedido_id' => (string) $this->pedido->id, 'negocio_id' => (string) $this->pedido->negocio_id]);
    }
}
