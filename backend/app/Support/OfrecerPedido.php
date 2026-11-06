<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\User;
use App\Notifications\PedidoDisponibleParaDomiciliario;
use Illuminate\Support\Collection;

/**
 * Ofrece un pedido listo a los domiciliarios: cuando el negocio lo marca
 * listo y cuando un domiciliario lo suelta.
 */
class OfrecerPedido
{
    /**
     * Avisa a los que están en turno (y no vetados ni suspendidos), menos al
     * cliente del pedido si también reparte y a `$excepto` (quien lo soltó).
     *
     * @return Collection<int, User> a quiénes se les avisó
     */
    public static function aDomiciliarios(Pedido $pedido, ?int $excepto = null): Collection
    {
        $domiciliarios = User::role('domiciliario')
            ->whereNull('domiciliario_vetado_at')
            ->whereNull('suspendido_at')
            ->where('en_turno', true)
            ->whereKeyNot(array_filter([$pedido->user_id, $excepto]))
            ->get();

        Push::enviar($domiciliarios, new PedidoDisponibleParaDomiciliario($pedido));

        return $domiciliarios;
    }
}
