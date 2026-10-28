<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Estado de la cuenta y privacidad (Ley 1581 de 2012 y requisito de Play Store):
 *
 * - `terminos_aceptados_at`: cuándo autorizó el tratamiento de sus datos al
 *   registrarse (prueba de la autorización previa).
 * - `suspendido_at` / `motivo_suspension`: un admin bloqueó la cuenta (no
 *   puede iniciar sesión y sus tokens dejan de servir).
 * - `eliminado_at`: la persona eliminó su cuenta; sus datos personales se
 *   anonimizaron y la fila queda solo para no romper el historial de pedidos.
 * - `negocios.archivado_at`: negocio que quedó sin dueño al eliminarse la
 *   cuenta de su único propietario; deja de verse en el catálogo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('terminos_aceptados_at')->nullable();
            $table->timestamp('suspendido_at')->nullable();
            $table->string('motivo_suspension')->nullable();
            $table->timestamp('eliminado_at')->nullable();
        });

        Schema::table('negocios', function (Blueprint $table) {
            $table->timestamp('archivado_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['terminos_aceptados_at', 'suspendido_at', 'motivo_suspension', 'eliminado_at']);
        });

        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn('archivado_at');
        });
    }
};
