<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Inventario del panel web (módulo «inventario» de Vitrina Gestión).
 *
 * - inventario_articulos: cualquier cosa que el negocio guarde: materia
 *   prima, insumos, productos terminados, herramientas… Cada uno se cuenta
 *   en su unidad (unidades, kilos, metros, láminas…) y lleva características
 *   libres: [{"nombre": "Calibre", "valor": "18"}, {"nombre": "Color", ...}],
 *   para que sirva a cualquier tipo de negocio.
 * - inventario_movimientos: entradas, salidas y ajustes (conteo); la
 *   existencia del artículo solo cambia por aquí y cada fila guarda el saldo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventario_articulos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            // materia_prima | insumo | producto | herramienta | otro (App\Models\InventarioArticulo::TIPOS)
            $table->string('tipo', 20)->default('materia_prima');
            $table->string('nombre', 150);
            $table->string('categoria', 80)->nullable();
            $table->string('referencia', 60)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('imagen')->nullable();
            // unidad | kg | m | lamina… (App\Models\InventarioArticulo::UNIDADES)
            $table->string('unidad', 20)->default('unidad');
            $table->decimal('cantidad', 14, 3)->default(0);
            $table->decimal('minimo', 14, 3)->nullable();
            $table->unsignedBigInteger('costo')->nullable();
            $table->string('proveedor', 120)->nullable();
            // Texto y no json: así la búsqueda no distingue mayúsculas en MySQL.
            $table->text('caracteristicas')->nullable();
            $table->timestamps();

            $table->index(['negocio_id', 'tipo']);
            $table->index(['negocio_id', 'categoria']);
        });

        Schema::create('inventario_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('articulo_id')->constrained('inventario_articulos')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // entrada | salida | ajuste
            $table->string('tipo', 10);
            // Lo que entró o salió; en un ajuste, la existencia contada.
            $table->decimal('cantidad', 14, 3);
            $table->decimal('saldo', 14, 3);
            $table->string('nota', 255)->nullable();
            $table->timestamps();

            $table->index(['articulo_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventario_movimientos');
        Schema::dropIfExists('inventario_articulos');
    }
};
