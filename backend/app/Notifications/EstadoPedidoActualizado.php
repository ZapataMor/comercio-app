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
 * Avisa al CLIENTE que su pedido cambió de estado.
 * El texto se adapta al estado actual del pedido.
 */
class EstadoPedidoActualizado extends Notification implements ShouldQueue
{
    // En cola: el push sale del worker y no hace esperar al pedido.
    use Queueable, UsaCanalPedidosFcm;

    /**
     * Título y cuerpo del aviso según el estado del pedido.
     *
     * @var array<string, array{0: string, 1: string}>
     */
    private const MENSAJES = [
        'aceptado' => ['El negocio aceptó tu pedido ✅', 'Ya lo están preparando.'],
        'listo' => ['Tu pedido está listo 🎉', 'Pronto un domiciliario lo recogerá.'],
        'tomado' => ['Domiciliario asignado 🛵', 'Va camino al local a recoger tu pedido.'],
        'recogido' => ['Pedido recogido 📦', 'Tu domiciliario ya tiene tu pedido.'],
        'en_camino' => ['¡Tu pedido va en camino! 🚀', 'Está muy cerca de llegar.'],
        'entregado' => ['Pedido entregado ✅', '¡Que lo disfrutes! Gracias por tu compra.'],
    ];

    /** @param array{0: string, 1: string}|null $texto  Reemplaza el texto del estado. */
    public function __construct(public Pedido $pedido, public ?array $texto = null) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        [$titulo, $cuerpo] = $this->texto
            ?? self::MENSAJES[$this->pedido->estado]
            ?? ['Tu pedido se actualizó', $this->pedido->estadoLabel()];

        // Para no tener que abrir la app cuando llegue el domiciliario.
        if ($notifiable->getKey() === $this->pedido->user_id && in_array($this->pedido->estado, Pedido::CON_CODIGO_ENTREGA, true) && $this->pedido->codigo_confirmacion) {
            $cuerpo = "Tu código de entrega es {$this->pedido->codigo_confirmacion}. Dáselo al domiciliario al recibirlo.";
        }

        return (new FcmMessage(
            notification: new FcmNotification(title: $titulo, body: $cuerpo),
        ))
            ->android($this->androidAlertaAlta())
            ->data([
                'tipo' => $notifiable->getKey() === $this->pedido->user_id ? 'estado_pedido'
                    : ($notifiable->getKey() === $this->pedido->domiciliario_id ? 'entrega_actualizada' : 'pedido_negocio_actualizado'),
                'pedido_id' => (string) $this->pedido->id,
                'negocio_id' => (string) $this->pedido->negocio_id,
                'estado' => $this->pedido->estado,
            ]);
    }
}
