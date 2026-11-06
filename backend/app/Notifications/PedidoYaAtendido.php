<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;

/**
 * Aviso SILENCIOSO al equipo del negocio: alguien ya aceptó o rechazó el
 * pedido, así que la alarma debe callarse en todos los teléfonos. No muestra
 * nada: solo lo recibe la app (mensaje de datos de prioridad alta).
 */
class PedidoYaAtendido extends Notification implements ShouldQueue
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
                'tipo' => 'pedido_atendido',
                'pedido_id' => (string) $this->pedido->id,
                'negocio_id' => (string) $this->pedido->negocio_id,
            ]);
    }
}
