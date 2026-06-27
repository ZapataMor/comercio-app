<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Avisa al CLIENTE que su pedido cambió de estado.
 * El texto se adapta al estado actual del pedido.
 */
class EstadoPedidoActualizado extends Notification
{
    /**
     * Título y cuerpo del aviso según el estado del pedido.
     *
     * @var array<string, array{0: string, 1: string}>
     */
    private const MENSAJES = [
        'listo' => ['Tu pedido está listo 🎉', 'Pronto un domiciliario lo recogerá.'],
        'tomado' => ['Domiciliario asignado 🛵', 'Va camino al local a recoger tu pedido.'],
        'recogido' => ['Pedido recogido 📦', 'Tu domiciliario ya tiene tu pedido.'],
        'en_camino' => ['¡Tu pedido va en camino! 🚀', 'Está muy cerca de llegar.'],
        'entregado' => ['Pedido entregado ✅', '¡Que lo disfrutes! Gracias por tu compra.'],
    ];

    public function __construct(public Pedido $pedido)
    {
    }

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        [$titulo, $cuerpo] = self::MENSAJES[$this->pedido->estado]
            ?? ['Tu pedido se actualizó', $this->pedido->estadoLabel()];

        return (new FcmMessage(
            notification: new FcmNotification(title: $titulo, body: $cuerpo),
        ))->data([
            'tipo' => 'estado_pedido',
            'pedido_id' => (string) $this->pedido->id,
            'estado' => $this->pedido->estado,
        ]);
    }
}
