<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Aviso en tiempo real de que algo cambió (ver App\Support\EnVivo).
 *
 * No lleva los datos nuevos, solo QUÉ cambió (`tema`) y de quién (ids): cada
 * app vuelve a pedir lo que muestra con su propio token, así que nadie ve por
 * el WebSocket nada que la API no le dejaría ver.
 *
 * Se emite sin cola (ShouldBroadcastNow): el aviso tiene que llegar ya, y la
 * cola de push puede estar ocupada o corriendo código viejo.
 */
class CambioEnVivo implements ShouldBroadcastNow
{
    /**
     * @param  list<string>  $canales  'catalogo' es público; el resto, privados.
     */
    public function __construct(
        public array $canales,
        public string $tema,
        public array $datos = [],
    ) {}

    public function broadcastOn(): array
    {
        return array_map(
            fn (string $canal) => $canal === 'catalogo' ? new Channel($canal) : new PrivateChannel($canal),
            $this->canales,
        );
    }

    public function broadcastAs(): string
    {
        return 'cambio';
    }

    public function broadcastWith(): array
    {
        return ['tema' => $this->tema, ...$this->datos];
    }
}
