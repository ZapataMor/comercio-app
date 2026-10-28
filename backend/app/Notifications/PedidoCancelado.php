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

/**
 * Avisa que un pedido se canceló:
 *  - al CLIENTE, si lo rechazó/canceló el negocio (abre el seguimiento);
 *  - al EQUIPO del negocio, si lo canceló el cliente (abre el pedido).
 */
class PedidoCancelado extends Notification implements ShouldQueue
{
    // En cola: el push sale del worker y no hace esperar al pedido.
    use Queueable, UsaCanalPedidosFcm;

    public function __construct(public Pedido $pedido)
    {
    }

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $paraCliente = $notifiable->getKey() === $this->pedido->user_id;
        $motivo = $this->pedido->motivo_cancelacion;

        [$titulo, $cuerpo] = $paraCliente
            ? ['Tu pedido fue cancelado', ($this->pedido->negocio?->nombre ?? 'El negocio').' no pudo atenderlo'.($motivo ? ": {$motivo}" : '.')]
            : ["Pedido #{$this->pedido->id} cancelado", 'El cliente canceló el pedido'.($motivo ? ": {$motivo}" : '.')];

        return (new FcmMessage(
            notification: new FcmNotification(title: $titulo, body: $cuerpo),
        ))
            ->android($this->androidAlertaAlta())
            ->data($paraCliente
                ? ['tipo' => 'estado_pedido', 'pedido_id' => (string) $this->pedido->id, 'estado' => 'cancelado']
                : ['tipo' => 'pedido_cancelado', 'pedido_id' => (string) $this->pedido->id, 'negocio_id' => (string) $this->pedido->negocio_id]);
    }
}
