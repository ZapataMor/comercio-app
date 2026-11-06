<?php

use App\Models\Negocio;
use App\Models\Pedido;
use App\Support\CancelarPedido;
use App\Support\HorarioNegocio;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Abre y cierra los negocios según su horario semanal (ver HorarioNegocio).
Artisan::command('negocios:aplicar-horario', function () {
    $ahora = now();
    $cambiados = 0;

    Negocio::whereNotNull('horario')
        ->whereNull('archivado_at')
        ->each(function (Negocio $negocio) use ($ahora, &$cambiados) {
            if (HorarioNegocio::aplicar($negocio, $ahora)) {
                $cambiados++;
            }
        });

    $this->info("Negocios abiertos/cerrados por horario: {$cambiados}");
})->purpose('Abre y cierra los negocios según su horario');

// Cancela los pedidos que nadie del negocio aceptó a tiempo y le avisa al cliente.
Artisan::command('pedidos:vencer', function () {
    $limite = now()->subMinutes((int) config('reputacion.minutos_para_aceptar'));

    $vencidos = Pedido::where('estado', 'pendiente')
        ->where('created_at', '<=', $limite)
        ->get()
        ->filter(fn (Pedido $pedido) => CancelarPedido::ejecutar($pedido, CancelarPedido::POR_SISTEMA, null));

    $this->info("Pedidos vencidos: {$vencidos->count()}");
})->purpose('Cancela los pedidos que el negocio no aceptó a tiempo');

// En desarrollo corre con `php artisan schedule:work`; en el servidor, con el
// cron de `schedule:run` cada minuto (ver DESPLIEGUE.md).
Schedule::command('negocios:aplicar-horario')->everyMinute()->withoutOverlapping();
Schedule::command('pedidos:vencer')->everyThirtySeconds()->withoutOverlapping();
