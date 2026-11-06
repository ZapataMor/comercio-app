<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\User;
use App\Notifications\PedidoDisponibleParaDomiciliario;
use App\Notifications\PedidoYaNoDisponible;
use Illuminate\Support\Collection;

/**
 * Ofrece un pedido listo a los domiciliarios: cuando el negocio lo marca
 * listo y cuando un domiciliario lo suelta. Y retira la oferta cuando ya no se
 * puede tomar.
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

    /**
     * Quita la oferta de los teléfonos de los domiciliarios. Va a todos, no solo
     * a los que están en turno: quien salió de turno aún puede tener la
     * notificación a la vista.
     */
    public static function retirar(Pedido $pedido, ?int $excepto = null): void
    {
        $domiciliarios = User::role('domiciliario')
            ->whereKeyNot(array_filter([$excepto]))
            ->get();

        Push::enviar($domiciliarios, new PedidoYaNoDisponible($pedido));
    }
}
