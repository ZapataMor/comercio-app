<?php

namespace App\Notifications;

use App\Models\Pedido;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use App\Support\CancelarPedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Avisa que un pedido se canceló:
 *  - al CLIENTE, si lo rechazó/canceló el negocio (abre el seguimiento);
 *  - al EQUIPO del negocio, si lo canceló el cliente (abre el pedido);
 *  - a los dos, si venció porque nadie del negocio respondió a tiempo.
 */
class PedidoCancelado extends Notification implements ShouldQueue
{
    // En cola: el push sale del worker y no hace esperar al pedido.
    use Queueable, UsaCanalPedidosFcm;

    public function __construct(public Pedido $pedido) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $paraCliente = $notifiable->getKey() === $this->pedido->user_id;
        $motivo = $this->pedido->motivo_cancelacion;

        $negocio = $this->pedido->negocio?->nombre ?? 'El negocio';
        $vencido = $this->pedido->cancelado_por === CancelarPedido::POR_SISTEMA;

        $porAdmin = $this->pedido->cancelado_por === CancelarPedido::POR_ADMIN;

        [$titulo, $cuerpo] = match (true) {
            $porAdmin && $paraCliente => ['Tu pedido fue cancelado', 'Vitrina cerró tu pedido'.($motivo ? ": {$motivo}" : '.')],
            $porAdmin => ["Pedido #{$this->pedido->codigo} cancelado", 'Vitrina cerró el pedido'.($motivo ? ": {$motivo}" : '.')],
            $vencido && $paraCliente => ['Tu pedido no fue recibido', "{$negocio} no recibió tu pedido. No se te cobra nada."],
            $vencido => ["Pedido #{$this->pedido->codigo} vencido", 'Nadie lo aceptó a tiempo y se le avisó al cliente.'],
            $paraCliente => ['Tu pedido fue cancelado', "{$negocio} no pudo atenderlo".($motivo ? ": {$motivo}" : '.')],
            default => ["Pedido #{$this->pedido->codigo} cancelado", 'El cliente canceló el pedido'.($motivo ? ": {$motivo}" : '.')],
        };

        return (new FcmMessage(
            notification: new FcmNotification(title: $titulo, body: $cuerpo),
        ))
            ->android($this->androidAlertaAlta())
            ->data($paraCliente
                ? ['tipo' => 'estado_pedido', 'pedido_id' => (string) $this->pedido->id, 'estado' => 'cancelado']
                : ['tipo' => 'pedido_cancelado', 'pedido_id' => (string) $this->pedido->id, 'negocio_id' => (string) $this->pedido->negocio_id]);
    }
}
