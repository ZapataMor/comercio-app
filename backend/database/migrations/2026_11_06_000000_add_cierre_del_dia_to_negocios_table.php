<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Respuesta del dueño a "¿cierras a la hora del horario?", válida para un solo
 * cierre: `cierre_original` es el cierre sobre el que respondió y
 * `cierre_ajustado` la hora que dio si no cierra a esa (null = sí cierra ahí).
 * El horario semanal no se toca.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->timestamp('cierre_original')->nullable();
            $table->timestamp('cierre_ajustado')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn(['cierre_original', 'cierre_ajustado']);
        });
    }
};
