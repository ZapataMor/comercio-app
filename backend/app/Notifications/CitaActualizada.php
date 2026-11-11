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

    public function __construct(public Cita $cita, public bool $alNegocio = false, public bool $reasignada = false, public bool $reprogramada = false) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $para = $this->alNegocio && $this->cita->a_nombre_de ? ' · A nombre de '.$this->cita->a_nombre_de : '';

        return (new FcmMessage(notification: new FcmNotification(
            title: $this->reprogramada ? 'Cita reprogramada: confirma la nueva hora' : ($this->cita->estado === 'no_asistio' ? 'Cita cancelada: no asistió' : ($this->reasignada ? 'Cambió el profesional de tu cita' : ($this->cita->estado === 'pendiente' ? 'Nueva solicitud de cita' : 'Cita '.$this->cita->estado))),
            body: $this->cita->servicio_nombre.$para.' · '.$this->cita->inicio->format('d/m/Y H:i').($this->cita->estado === 'no_asistio' ? '. Tu cita se canceló porque pasaron más de 15 minutos sin registrar tu llegada. Solicita una nueva cita para renovar tu reserva.' : ($this->reasignada ? '. Ahora te atenderá '.$this->cita->profesional?->nombre_completo.'. Conservamos tu horario.' : ($this->cita->estado === 'pendiente' ? '. Revisa también tu agenda presencial antes de confirmar.' : ''))),
        )))->android($this->androidAlertaAlta())->data([
            'tipo' => $this->alNegocio ? 'cita_negocio' : 'cita_cliente',
            'cita_id' => (string) $this->cita->id, 'negocio_id' => (string) $this->cita->negocio_id,
        ]);
    }
}
