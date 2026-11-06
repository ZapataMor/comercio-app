<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reseñas públicas del cliente: estrellas de 1 a 5 y un comentario, sobre la
 * tienda o sobre cada producto que compró. Van aparte de `calificaciones`,
 * que es privada y mide si el negocio y el domiciliario cumplieron.
 *
 * - `objeto` ("tienda" o "producto:12") existe para el índice único: con
 *   `producto_id` null, la base de datos dejaría repetir la reseña de la tienda.
 * - Promedio y total se guardan en `negocios` y `productos` para mostrarlos en
 *   los listados sin consultar cada fila (los mantiene Support\Resenas).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resenas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('negocio_id')->constrained()->cascadeOnDelete();
            // Null = reseña de la tienda.
            $table->foreignId('producto_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('objeto', 30);
            $table->unsignedTinyInteger('estrellas');
            $table->text('comentario')->nullable();
            $table->timestamps();

            $table->unique(['pedido_id', 'objeto']);
            $table->index(['negocio_id', 'producto_id', 'created_at']);
        });

        foreach (['negocios', 'productos'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->decimal('resenas_promedio', 2, 1)->nullable();
                $table->unsignedInteger('resenas_total')->default(0);
            });
        }
    }

    public function down(): void
    {
        foreach (['negocios', 'productos'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->dropColumn(['resenas_promedio', 'resenas_total']);
            });
        }

        Schema::dropIfExists('resenas');
    }
};
