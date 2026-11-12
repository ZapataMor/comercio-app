<?php

namespace App\Support\Telefono;

/**
 * Canal por el que llega el código al celular. Hoy: WhatsApp Cloud API de
 * Meta, o el log mientras no haya cuenta de Meta. Un canal de SMS se
 * agregaría como otra implementación de esta interfaz.
 */
interface EnviadorCodigos
{
    /**
     * @param  string  $telefono  10 dígitos (3001234567), sin el indicativo.
     *
     * @throws \RuntimeException si no se pudo entregar al canal.
     */
    public function enviar(string $telefono, string $codigo): void;

    /** Canal de prueba: el código no sale del servidor. */
    public function esDePrueba(): bool;
}
