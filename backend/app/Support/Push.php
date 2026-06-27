<?php

namespace App\Support;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as NotificationFacade;

/**
 * Envío de notificaciones push (FCM) tolerante a fallos.
 *
 * Reglas de oro:
 *  - Si Firebase aún no está configurado (no hay credenciales), NO hace nada.
 *    Así el flujo de pedidos funciona igual antes de conectar Firebase (Capa 2).
 *  - Un fallo al enviar el push NUNCA debe romper la operación de negocio
 *    (crear/avanzar un pedido). Por eso se atrapa y se registra en el log.
 */
class Push
{
    /** ¿Hay credenciales de Firebase configuradas? */
    public static function configurado(): bool
    {
        $proyecto = config('firebase.default', 'app');

        return ! empty(config("firebase.projects.{$proyecto}.credentials"));
    }

    /**
     * Envía una notificación a uno o varios usuarios, sin propagar errores.
     *
     * @param  mixed  $destinatarios  un usuario, un array o una Collection de usuarios
     */
    public static function enviar(mixed $destinatarios, Notification $notificacion): void
    {
        if (! self::configurado()) {
            return; // Firebase aún no conectado: no-op silencioso.
        }

        $destinatarios = $destinatarios instanceof Collection || is_array($destinatarios)
            ? $destinatarios
            : [$destinatarios];

        try {
            NotificationFacade::send($destinatarios, $notificacion);
        } catch (\Throwable $e) {
            // El pedido ya se procesó; el push es secundario. Solo lo registramos.
            Log::warning('Fallo enviando notificación push: ' . $e->getMessage());
        }
    }
}
