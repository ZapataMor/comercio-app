<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\User;

class EfectivoDomiciliario
{
    public static function bloqueado(User $user): bool
    {
        return ($user->reputacion_domiciliario ?? config('reputacion.inicial')) < 70
            && Pedido::where('domiciliario_id', $user->id)->efectivoPendiente()->exists();
    }
}
