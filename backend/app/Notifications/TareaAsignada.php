<?php

namespace App\Notifications;

use App\Models\TareaTrabajo;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Avisa al trabajador que le asignaron una tarea (o un pedido) en el panel
 * web. Al tocarla, la app abre el Inicio de ese negocio con sus tareas.
 */
class TareaAsignada extends Notification implements ShouldQueue
{
    use Queueable, UsaCanalPedidosFcm;

    public function __construct(public TareaTrabajo $tarea) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $negocio = $this->tarea->negocio?->nombre ?? 'Tu negocio';
        $cuando = match (true) {
            ! $this->tarea->fecha => '',
            $this->tarea->fecha->isToday() => ' Para hoy.',
            $this->tarea->fecha->isTomorrow() => ' Para mañana.',
            default => ' Para el '.$this->tarea->fecha->format('d/m').'.',
        };

        return (new FcmMessage(
            notification: new FcmNotification(
                title: ($this->tarea->urgente ? '⚠️ Tarea urgente' : 'Nueva tarea').' · '.$negocio,
                body: $this->tarea->titulo.'.'.$cuando,
            ),
        ))
            ->android($this->androidAlertaAlta())
            ->data([
                'tipo' => 'tarea_asignada',
                'tarea_id' => (string) $this->tarea->id,
                'negocio_id' => (string) $this->tarea->negocio_id,
            ]);
    }
}
