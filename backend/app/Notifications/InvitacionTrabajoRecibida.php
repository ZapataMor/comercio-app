<?php

namespace App\Notifications;

use App\Models\InvitacionTrabajo;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Avisa a una persona que un negocio la invitó a unirse como trabajadora.
 * La invitación se acepta o rechaza desde "Mis negocios" en la app.
 */
class InvitacionTrabajoRecibida extends Notification
{
    use UsaCanalPedidosFcm;

    public function __construct(public InvitacionTrabajo $invitacion)
    {
    }

    /** Solo canal push (FCM). */
    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $negocio = $this->invitacion->negocio?->nombre ?? 'Un negocio';

        return (new FcmMessage(
            notification: new FcmNotification(
                title: 'Invitación de trabajo 💼',
                body: "{$negocio} quiere añadirte a su equipo. Ábrela para aceptar o rechazar.",
            ),
        ))
            ->android($this->androidAlertaAlta())
            ->data([
                'tipo' => 'invitacion_trabajo',
                'invitacion_id' => (string) $this->invitacion->id,
            ]);
    }
}
