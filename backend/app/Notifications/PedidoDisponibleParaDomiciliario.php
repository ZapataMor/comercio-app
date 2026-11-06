<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;

/**
 * Avisa a los DOMICILIARIOS que hay un pedido "listo" disponible para tomar.
 *
 * Es un mensaje de DATOS: la app arma la notificación ella misma para ponerle
 * los botones Aceptar y Rechazar. Con un mensaje normal, Android la mostraría
 * sin botones si la app está cerrada.
 */
class PedidoDisponibleParaDomiciliario extends Notification implements ShouldQueue
{
    // En cola: el push sale del worker y no hace esperar al pedido.
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
        $negocio = $this->pedido->negocio?->nombre ?? 'Un negocio';

        return (new FcmMessage)
            ->android(['priority' => 'high'])
            ->data([
                'tipo' => 'pedido_disponible',
                'titulo' => 'Pedido listo para recoger 🛵',
                'cuerpo' => "{$negocio} tiene un pedido listo. ¡Tómalo antes que otro!",
                'pedido_id' => (string) $this->pedido->id,
                'estado' => 'listo',
            ]);
    }
}
