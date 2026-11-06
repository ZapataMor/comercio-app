<?php

namespace App\Notifications;

use App\Models\Negocio;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Le pregunta al DUEÑO si cierra a la hora del horario automático, aunque tenga
 * la app cerrada: al tocarla se abre la app con el modal ConfirmarCierre.
 */
class PreguntaCierreNegocio extends Notification implements ShouldQueue
{
    // En cola: el push sale del worker y no frena el cron.
    use Queueable, UsaCanalPedidosFcm;

    public function __construct(public Negocio $negocio, public string $horaCierre)
    {
    }

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        return (new FcmMessage(
            notification: new FcmNotification(
                title: "¿Cierras a las {$this->horaCierre}?",
                body: "{$this->negocio->nombre} se cerrará solo a esa hora. Toca para confirmar o cambiarla por hoy.",
            ),
        ))
            ->android($this->androidAlertaAlta())
            ->data([
                'tipo' => 'confirmar_cierre',
                'negocio_id' => (string) $this->negocio->id,
            ]);
    }
}
