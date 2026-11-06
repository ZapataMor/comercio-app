<?php

namespace App\Notifications;

use App\Models\Pedido;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;

/**
 * Avisa al COMERCIO que acaba de entrar un pedido nuevo (estado "pendiente").
 *
 * Es un mensaje de DATOS: la app arma la notificación ella misma para que suene
 * la alarma cada 10 segundos hasta que alguien lo acepte, también con la app
 * cerrada. Con un mensaje normal, Android mostraría una notificación de un
 * solo sonido.
 */
class NuevoPedidoParaComercio extends Notification implements ShouldQueue
{
    // En cola: el push sale del worker y no hace esperar al pedido.
    use Queueable;

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

        return (new FcmMessage)
            ->android(['priority' => 'high'])
            ->data([
                'tipo' => 'nuevo_pedido',
                'titulo' => '¡Nuevo pedido! 🛒',
                'cuerpo' => "Pedido por {$total}. Acéptalo antes de que venza.",
                'pedido_id' => (string) $this->pedido->id,
                // Una persona puede ser miembro de varios negocios: la app abre
                // el pedido dentro del negocio correcto.
                'negocio_id' => (string) $this->pedido->negocio_id,
                'estado' => 'pendiente',
                // La alarma se calla sola si nadie responde en este tiempo.
                'segundos' => (string) $this->pedido->segundosParaAceptar(),
            ]);
    }
}
