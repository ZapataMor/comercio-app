<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nivel de confiabilidad de negocios y domiciliarios (ver App\Support\Reputacion).
 *
 * - `reputacion_eventos`: historial de lo que sube o baja el puntaje (cada
 *   evento dice por qué, cuántos puntos y de qué pedido). El puntaje se
 *   recalcula siempre desde aquí, así un admin puede anular un evento injusto.
 * - `calificaciones`: lo que contestó el cliente al terminar cada pedido.
 * - Puntaje cacheado + veto en `negocios` y `users` (para filtrar rápido).
 * - Marcas de tiempo por estado en `pedidos` para medir si alguien se pasó
 *   del tiempo que prometió, más la novedad del domiciliario (justificación
 *   de una demora) y la confirmación del dinero en pedidos en efectivo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            // Tiempo promedio de preparación que promete el negocio (minutos).
            $table->unsignedSmallInteger('tiempo_preparacion')->default(20)->after('activo');
            $table->unsignedTinyInteger('reputacion')->default(80)->after('tiempo_preparacion');
            $table->unsignedInteger('reputacion_pedidos')->default(0)->after('reputacion');
            $table->timestamp('vetado_at')->nullable()->after('reputacion_pedidos');
            $table->string('motivo_veto')->nullable()->after('vetado_at');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('reputacion_domiciliario')->default(80);
            $table->unsignedInteger('reputacion_domiciliario_pedidos')->default(0);
            $table->timestamp('domiciliario_vetado_at')->nullable();
            $table->string('domiciliario_motivo_veto')->nullable();
        });

        Schema::table('pedidos', function (Blueprint $table) {
            // Copia del tiempo de preparación del negocio al momento del pedido.
            $table->unsignedSmallInteger('minutos_preparacion')->nullable()->after('minutos_recogida');
            $table->timestamp('listo_at')->nullable();
            $table->timestamp('tomado_at')->nullable();
            $table->timestamp('recogido_at')->nullable();
            $table->timestamp('en_camino_at')->nullable();
            $table->timestamp('entregado_at')->nullable();
            // Justificación del domiciliario (lluvia, tráfico...) para una demora.
            $table->string('novedad')->nullable();
            $table->timestamp('novedad_at')->nullable();
            // Solo efectivo: ¿el domiciliario le entregó el dinero al negocio?
            $table->string('dinero_estado')->nullable(); // recibido | incompleto | no_recibido
            $table->timestamp('dinero_confirmado_at')->nullable();
        });

        Schema::create('calificaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('negocio_ok');
            $table->json('negocio_problemas')->nullable();
            // Null si el pedido no tuvo domiciliario.
            $table->boolean('domiciliario_ok')->nullable();
            $table->json('domiciliario_problemas')->nullable();
            $table->text('comentario')->nullable();
            $table->timestamps();
        });

        Schema::create('reputacion_eventos', function (Blueprint $table) {
            $table->id();
            // A quién afecta: un negocio o un domiciliario (users.id).
            $table->string('tipo', 20); // negocio | domiciliario
            $table->unsignedBigInteger('sujeto_id');
            $table->foreignId('pedido_id')->nullable()->constrained()->nullOnDelete();
            $table->string('motivo', 40);
            $table->smallInteger('puntos');
            // Falta grave (robo, no entregar el dinero): dos seguidas vetan.
            $table->boolean('grave')->default(false);
            $table->string('origen', 20); // sistema | cliente | negocio | admin
            $table->string('comentario')->nullable();
            $table->timestamp('anulado_at')->nullable();
            $table->foreignId('anulado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tipo', 'sujeto_id']);
            // Un mismo motivo no cuenta dos veces para el mismo pedido.
            $table->unique(['tipo', 'sujeto_id', 'pedido_id', 'motivo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reputacion_eventos');
        Schema::dropIfExists('calificaciones');

        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropColumn([
                'minutos_preparacion', 'listo_at', 'tomado_at', 'recogido_at', 'en_camino_at',
                'entregado_at', 'novedad', 'novedad_at', 'dinero_estado', 'dinero_confirmado_at',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'reputacion_domiciliario', 'reputacion_domiciliario_pedidos',
                'domiciliario_vetado_at', 'domiciliario_motivo_veto',
            ]);
        });

        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn(['tiempo_preparacion', 'reputacion', 'reputacion_pedidos', 'vetado_at', 'motivo_veto']);
        });
    }
};
