<?php

namespace App\Support\Telefono;

use Illuminate\Support\Facades\Log;

/**
 * Modo prueba (WHATSAPP_DRIVER=log): el código se escribe en
 * storage/logs/laravel.log y no se envía nada. En local la API además lo
 * devuelve como `codigo_prueba` para que la app lo muestre.
 */
class EnviadorLog implements EnviadorCodigos
{
    public function enviar(string $telefono, string $codigo): void
    {
        Log::info("[WhatsApp de prueba] Código para {$telefono}: {$codigo}");
    }

    public function esDePrueba(): bool
    {
        return true;
    }
}
