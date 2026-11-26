<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Producción y materiales (módulo «produccion»): une el catálogo con el
 * inventario.
 *
 * - producto_materiales: lo que gasta UNA unidad del producto (en la unidad
 *   en que se vende: 1 portón, 1 kg de queso…), en la unidad del artículo:
 *   10 varillas de soldadura, 1 lámina, 0,2 kg de carne…
 * - productos.materiales_al: cuándo se descuentan:
 *     fabricar = al registrar que se hizo (talleres: se fabrica y se guarda),
 *     pedido   = cada vez que un pedido de Vitrina queda listo (restaurantes).
 * - producciones: cada vez que se hizo un producto, a mano o por un pedido;
 *   faltantes guarda lo que no había y no se pudo descontar.
 * - inventario_movimientos.produccion_id: las salidas que causó.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->string('materiales_al', 10)->default('fabricar');
        });

        Schema::create('producto_materiales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('articulo_id')->constrained('inventario_articulos')->cascadeOnDelete();
            $table->decimal('cantidad', 14, 3);
            $table->timestamps();

            $table->unique(['producto_id', 'articulo_id']);
        });

        Schema::create('producciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->foreignId('producto_id')->nullable()->constrained('productos')->nullOnDelete();
            // El nombre al momento de hacerlo, por si el producto cambia o se borra.
            $table->string('nombre', 255);
            $table->decimal('cantidad', 14, 3);
            // manual | pedido
            $table->string('origen', 10)->default('manual');
            $table->foreignId('pedido_id')->nullable()->constrained('pedidos')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nota', 255)->nullable();
            // [{"articulo_id": 3, "nombre": "Lámina lisa", "falto": 2, "unidad": "lamina"}]
            $table->text('faltantes')->nullable();
            $table->unsignedBigInteger('costo')->nullable();
            $table->timestamp('anulada_at')->nullable();
            $table->foreignId('anulada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['negocio_id', 'created_at']);
            $table->index('pedido_id');
        });

        Schema::table('inventario_movimientos', function (Blueprint $table) {
            $table->foreignId('produccion_id')->nullable()->constrained('producciones')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventario_movimientos', fn (Blueprint $table) => $table->dropConstrainedForeignId('produccion_id'));
        Schema::dropIfExists('producciones');
        Schema::dropIfExists('producto_materiales');
        Schema::table('productos', fn (Blueprint $table) => $table->dropColumn('materiales_al'));
    }
};
