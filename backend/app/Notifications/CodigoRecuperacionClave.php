<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Correo con el código de 6 dígitos para poner una contraseña nueva.
 * Se envía al momento (no en cola): la persona lo está esperando en la app.
 */
class CodigoRecuperacionClave extends Notification
{
    public function __construct(public string $codigo) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Tu código para recuperar la contraseña de Vitrina')
            ->greeting('Hola, '.$notifiable->name)
            ->line('Usa este código en la app para poner una contraseña nueva:')
            ->line('**'.$this->codigo.'**')
            ->line('Vence en '.\App\Http\Controllers\Api\RecuperarClaveController::MINUTOS_VIGENCIA.' minutos.')
            ->line('Si no lo pediste tú, ignora este correo: tu contraseña no cambia.')
            ->salutation('— Vitrina');
    }
}
