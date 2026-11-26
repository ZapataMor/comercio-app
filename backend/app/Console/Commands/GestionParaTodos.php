<?php

namespace App\Console\Commands;

use App\Gestion\Gestion;
use App\Gestion\Modulos;
use App\Models\Negocio;
use Illuminate\Console\Command;

/**
 * Para pruebas: enciende el panel web de Vitrina Gestión a TODOS los negocios
 * activos (no archivados) con TODOS los módulos opcionales. Después el super
 * administrador apaga, desde /admin/gestion, a los que no deban tenerlo.
 *
 * No borra nada: a los que ya tenían panel solo les suma los módulos que les
 * faltaban; la plantilla que tuvieran se conserva. Los negocios que se creen
 * después no quedan con panel: volver a correrlo o encenderlos a mano.
 */
class GestionParaTodos extends Command
{
    protected $signature = 'vitrina:gestion-para-todos {--force : No preguntar antes de cambiar}';

    protected $description = 'Enciende el panel web y todos los módulos a todos los negocios (para pruebas)';

    public function handle(): int
    {
        $negocios = Negocio::whereNull('archivado_at')->orderBy('id')->get();
        if ($negocios->isEmpty()) {
            $this->info('No hay negocios.');

            return self::SUCCESS;
        }
        if (! $this->option('force') && ! $this->confirm("Se encenderá el panel web con todos los módulos a {$negocios->count()} negocios. ¿Seguir?")) {
            return self::FAILURE;
        }

        $todos = Modulos::opcionales();
        foreach ($negocios as $negocio) {
            Gestion::activar($negocio);
            Gestion::definirModulos($negocio, $todos);
            $this->line("  ✓ {$negocio->nombre}");
        }
        $this->info("Listo: {$negocios->count()} negocios con panel web y ".count($todos).' módulos.');

        return self::SUCCESS;
    }
}
