<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Login web con tres maneras de entrar (QR desde la app, celular + clave +
 * código por WhatsApp, Google + clave): cada sesión web guarda con cuál entró.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accesos_web', function (Blueprint $table) {
            // qr | whatsapp | google
            $table->string('metodo', 12)->default('qr')->after('estado');
        });
    }

    public function down(): void
    {
        Schema::table('accesos_web', fn (Blueprint $table) => $table->dropColumn('metodo'));
    }
};
