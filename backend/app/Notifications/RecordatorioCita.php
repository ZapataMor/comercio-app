<?php

namespace App\Notifications;

use App\Models\Cita;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

/**
 * Recordatorio al cliente antes de su cita confirmada. Es solo una notificación:
 * no usa el canal de alarma de pedidos ni actualiza pantallas en vivo.
 */
class RecordatorioCita extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Cita $cita, public int $minutos) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public static function cuanto(int $minutos): string
    {
        return match (true) {
            $minutos >= 1440 => 'Tu cita es mañana',
            $minutos >= 120 => 'Tu cita es en '.intdiv($minutos, 60).' horas',
            $minutos >= 60 => 'Tu cita es en 1 hora',
            default => "Tu cita es en {$minutos} minutos",
        };
    }

    public function toFcm(object $notifiable): FcmMessage
    {
        $cita = $this->cita;
        $para = $cita->a_nombre_de ? " (a nombre de {$cita->a_nombre_de})" : '';

        return (new FcmMessage(notification: new FcmNotification(
            title: self::cuanto($this->minutos),
            body: $cita->servicio_nombre.$para.' en '.($cita->negocio?->nombre ?? 'el negocio').' · '
                .$cita->inicio->format('d/m/Y').' a las '.$cita->inicio->format('g:i a').'. Recuerda llegar a tiempo: después de 15 minutos de retraso la cita se cancela.',
        )))->data([
            'tipo' => 'cita_cliente', 'recordatorio' => (string) $this->minutos,
            'cita_id' => (string) $cita->id, 'negocio_id' => (string) $cita->negocio_id,
        ]);
    }
}
