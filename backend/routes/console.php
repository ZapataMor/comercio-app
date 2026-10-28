<?php

use App\Models\Negocio;
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

// En desarrollo corre con `php artisan schedule:work`; en el servidor, con el
// cron de `schedule:run` cada minuto (ver DESPLIEGUE.md).
Schedule::command('negocios:aplicar-horario')->everyMinute()->withoutOverlapping();
