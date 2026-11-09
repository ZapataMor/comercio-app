<?php

namespace App\Notifications;

use App\Models\Cita;
use App\Notifications\Concerns\UsaCanalPedidosFcm;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

class CitaActualizada extends Notification implements ShouldQueue
{
    use Queueable, UsaCanalPedidosFcm;

    public function __construct(public Cita $cita, public bool $alNegocio = false) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        return (new FcmMessage(notification: new FcmNotification(
            title: $this->cita->estado === 'pendiente' ? 'Nueva solicitud de cita' : 'Cita '.$this->cita->estado,
            body: $this->cita->servicio_nombre.' · '.$this->cita->inicio->format('d/m/Y H:i').($this->cita->estado === 'pendiente' ? '. Revisa también tu agenda presencial antes de confirmar.' : ''),
        )))->android($this->androidAlertaAlta())->data([
            'tipo' => $this->alNegocio ? 'cita_negocio' : 'cita_cliente',
            'cita_id' => (string) $this->cita->id, 'negocio_id' => (string) $this->cita->negocio_id,
        ]);
    }
}
