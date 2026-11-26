<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que se fabrica llega al catálogo (Producción y materiales).
 *
 * - productos.existencias: unidades listas para vender. NULL = el negocio no
 *   lleva la cuenta de ese producto (como hasta ahora).
 * - producciones.destino: qué se hizo con lo fabricado:
 *     catalogo = se sumó a las existencias del producto,
 *     espera   = quedó en «En espera» para completar sus datos y publicarlo,
 *     pedido   = era de un pedido o encargo: no va al catálogo.
 * - productos_en_espera: lo fabricado que espera sus datos puntuales (medidas,
 *   color, foto, precio) antes de entrar al catálogo como producto nuevo o
 *   sumarse a uno que ya existe.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->decimal('existencias', 12, 3)->nullable();
        });

        Schema::table('producciones', function (Blueprint $table) {
            $table->string('destino', 10)->nullable();
        });

        Schema::create('productos_en_espera', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            // El producto del catálogo del que se partió (su receta y su sección).
            $table->foreignId('producto_id')->nullable()->constrained('productos')->nullOnDelete();
            $table->foreignId('produccion_id')->nullable()->constrained('producciones')->nullOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('cantidad', 12, 3);
            $table->string('nombre', 255);
            $table->text('descripcion')->nullable();
            $table->unsignedInteger('precio')->nullable();
            // [{"nombre": "Ancho", "valor": "90 cm"}, ...]
            $table->text('especificaciones')->nullable();
            $table->string('imagen')->nullable();
            // en_espera | publicado | descartado
            $table->string('estado', 12)->default('en_espera');
            // El producto del catálogo donde quedó al publicarlo.
            $table->foreignId('publicado_en')->nullable()->constrained('productos')->nullOnDelete();
            $table->timestamp('publicado_at')->nullable();
            $table->timestamps();

            $table->index(['negocio_id', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('productos_en_espera');
        Schema::table('producciones', fn (Blueprint $table) => $table->dropColumn('destino'));
        Schema::table('productos', fn (Blueprint $table) => $table->dropColumn('existencias'));
    }
};
