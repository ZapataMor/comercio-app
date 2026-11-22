<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Por transferencia el negocio le entrega el domicilio al domiciliario al
 * recoger. Antes de salir, el domiciliario dice si se lo dieron: true (sí),
 * false (no, el negocio se lo debe) o null (aún no responde o no aplica).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->boolean('domicilio_recibido')->nullable();
            $table->timestamp('domicilio_respondido_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropColumn(['domicilio_recibido', 'domicilio_respondido_at']);
        });
    }
};
