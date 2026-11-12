<?php

namespace App\Support\Telefono;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * WhatsApp Cloud API de Meta (WHATSAPP_DRIVER=cloud).
 *
 * Envía la plantilla de autenticación aprobada (categoría "Autenticación",
 * con el botón "Copiar código"). Meta exige el código dos veces: en el
 * cuerpo y en el botón. Los datos salen de config/services.php → whatsapp.
 */
class EnviadorWhatsApp implements EnviadorCodigos
{
    public function __construct(
        private string $token,
        private string $phoneNumberId,
        private string $plantilla,
        private string $idioma,
        private string $version,
    ) {}

    public static function desdeConfig(): self
    {
        $c = config('services.whatsapp');
        foreach (['token', 'phone_number_id', 'plantilla'] as $clave) {
            if (blank($c[$clave] ?? null)) {
                throw new RuntimeException("Falta services.whatsapp.{$clave} (revisa las variables WHATSAPP_* del .env).");
            }
        }

        return new self($c['token'], $c['phone_number_id'], $c['plantilla'], $c['idioma'], $c['version']);
    }

    public function enviar(string $telefono, string $codigo): void
    {
        $respuesta = Http::withToken($this->token)
            ->acceptJson()
            ->timeout(10)
            ->post("https://graph.facebook.com/{$this->version}/{$this->phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => '57'.$telefono,
                'type' => 'template',
                'template' => [
                    'name' => $this->plantilla,
                    'language' => ['code' => $this->idioma],
                    'components' => [
                        ['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $codigo]]],
                        ['type' => 'button', 'sub_type' => 'url', 'index' => '0', 'parameters' => [['type' => 'text', 'text' => $codigo]]],
                    ],
                ],
            ]);

        if ($respuesta->failed()) {
            $error = $respuesta->json('error.message') ?? $respuesta->body();
            $codigoMeta = $respuesta->json('error.code');
            throw new RuntimeException("WhatsApp respondió {$respuesta->status()} (código {$codigoMeta}): {$error}");
        }
    }

    public function esDePrueba(): bool
    {
        return false;
    }
}
