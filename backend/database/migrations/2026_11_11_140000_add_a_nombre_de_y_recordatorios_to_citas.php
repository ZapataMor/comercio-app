<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('citas', function (Blueprint $table) {
            // Persona que recibirá el servicio cuando el cliente pide la cita para otra.
            $table->string('a_nombre_de', 150)->nullable();
            // Último recordatorio enviado (o descartado), en minutos antes del inicio.
            $table->unsignedSmallInteger('recordatorio_minutos')->nullable();
            $table->index(['estado', 'inicio']);
        });
    }

    public function down(): void
    {
        Schema::table('citas', function (Blueprint $table) {
            $table->dropIndex(['estado', 'inicio']);
            $table->dropColumn(['a_nombre_de', 'recordatorio_minutos']);
        });
    }
};
