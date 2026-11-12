<?php

use App\Models\Negocio;
use App\Models\Pedido;
use App\Notifications\PreguntaCierreNegocio;
use App\Support\CancelarPedido;
use App\Support\EnVivo;
use App\Support\AgendaCitas;
use App\Support\HorarioNegocio;
use App\Support\Push;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Abre y cierra los negocios según su horario semanal (ver HorarioNegocio).
Artisan::command('negocios:aplicar-horario', function () {
    $ahora = now();
    $cambiados = 0;

    Negocio::whereNotNull('horario')
        ->whereNull('archivado_at')
        ->each(function (Negocio $negocio) use ($ahora, &$cambiados) {
            if (HorarioNegocio::aplicar($negocio, $ahora)) {
                // Los clientes que lo miran lo ven abrir o cerrar al instante.
                EnVivo::datosNegocio($negocio->id);
                $cambiados++;
            }
        });

    $this->info("Negocios abiertos/cerrados por horario: {$cambiados}");
})->purpose('Abre y cierra los negocios según su horario');

// A los dueños cuyo negocio cierra pronto: ¿cierras a esa hora? Una vez por cierre.
Artisan::command('negocios:preguntar-cierre', function () {
    $ahora = now();
    $preguntados = 0;

    Negocio::whereNotNull('horario')
        ->whereNull('archivado_at')
        ->where('activo', true)
        ->each(function (Negocio $negocio) use ($ahora, &$preguntados) {
            $cierre = HorarioNegocio::cierreSinConfirmar($negocio, $ahora);
            if (! $cierre || $negocio->cierre_preguntado?->eq($cierre)) {
                return;
            }

            $negocio->forceFill(['cierre_preguntado' => $cierre])->save();
            $duenos = $negocio->miembrosActivos()->get()->filter(fn ($m) => $negocio->puede($m, 'cambiar_estado'));
            Push::enviar($duenos, new PreguntaCierreNegocio($negocio, HorarioNegocio::hora($cierre->format('H:i'))));
            // Con la app abierta la pregunta aparece al instante, sin esperar el push.
            EnVivo::avisar(EnVivo::negocio($negocio->id), 'cierre', ['negocio_id' => $negocio->id]);
            $preguntados++;
        });

    $this->info("Dueños preguntados por el cierre: {$preguntados}");
})->purpose('Pregunta a los dueños si cierran a la hora del horario');

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
Schedule::command('negocios:preguntar-cierre')->everyMinute()->withoutOverlapping();
Schedule::command('pedidos:vencer')->everyThirtySeconds()->withoutOverlapping();

Artisan::command('citas:vencer', function () {
    $this->info('Solicitudes de cita vencidas: '.AgendaCitas::vencer());
})->purpose('Libera las solicitudes de cita sin respuesta en una hora');
Schedule::command('citas:vencer')->everyMinute()->withoutOverlapping();

Artisan::command('citas:cancelar-inasistencias', function () {
    $this->info('Citas canceladas por inasistencia: '.AgendaCitas::cancelarInasistencias());
})->purpose('Cancela y notifica las citas sin llegada después de 15 minutos');
Schedule::command('citas:cancelar-inasistencias')->everyMinute()->withoutOverlapping();

Artisan::command('citas:recordar', function () {
    $this->info('Recordatorios de cita enviados: '.AgendaCitas::enviarRecordatorios());
})->purpose('Recuerda al cliente su cita 1 día, 5 horas, 1 hora y 15 minutos antes');
Schedule::command('citas:recordar')->everyMinute()->withoutOverlapping();

Artisan::command('busqueda:reindexar', function () {
    $this->info('Filas reindexadas para la búsqueda: '.\App\Support\Busqueda::reindexar());
})->purpose('Recalcula el texto normalizado de la búsqueda tolerante a errores');

// Prueba de WhatsApp Cloud API: envía un código de ejemplo con la plantilla
// configurada (ver Vitrina/00 - Inicio/Configurar WhatsApp Cloud API.md).
Artisan::command('whatsapp:probar {telefono : Celular de 10 dígitos, ej. 3001234567}', function (string $telefono) {
    $numero = \App\Support\Telefono\CodigosTelefono::normalizar($telefono);
    if ($numero === null) {
        $this->error('El número debe ser un celular colombiano de 10 dígitos que empiece por 3.');

        return 1;
    }
    $driver = config('services.whatsapp.driver');
    $this->line("Canal: {$driver}".($driver === 'cloud' ? '' : ' (modo prueba: el código solo va al log)'));
    try {
        app(\App\Support\Telefono\EnviadorCodigos::class)->enviar($numero, '123456');
    } catch (\Throwable $e) {
        $this->error('No se pudo enviar: '.$e->getMessage());

        return 1;
    }
    $this->info("Listo: se envió el código 123456 al {$numero}.");
})->purpose('Envía un código de prueba por WhatsApp para revisar la configuración de Meta');
