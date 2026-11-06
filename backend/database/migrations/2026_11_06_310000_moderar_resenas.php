<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Moderación de las reseñas públicas:
 *
 * - `resenas.oculta_at`: el admin la ocultó; no se muestra ni cuenta en el promedio.
 * - `resenas.respuesta`: lo que contestó el propietario, una sola vez.
 * - `resena_reportes`: quién reportó qué, uno por persona y reseña. `resuelto_at`
 *   marca los que el admin ya atendió, al ocultar o al descartarlos.
 * - `resena_moderaciones`: historial de lo que hizo el admin y por qué.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resenas', function (Blueprint $table) {
            $table->timestamp('oculta_at')->nullable();
            $table->text('respuesta')->nullable();
            $table->timestamp('respondida_at')->nullable();
        });

        Schema::create('resena_reportes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resena_id')->constrained('resenas')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('motivo', 20);
            $table->timestamp('resuelto_at')->nullable();
            $table->timestamps();

            $table->unique(['resena_id', 'user_id']);
        });

        Schema::create('resena_moderaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resena_id')->constrained('resenas')->cascadeOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('accion', 20);
            $table->string('motivo', 200)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resena_moderaciones');
        Schema::dropIfExists('resena_reportes');

        Schema::table('resenas', function (Blueprint $table) {
            $table->dropColumn(['oculta_at', 'respuesta', 'respondida_at']);
        });
    }
};
