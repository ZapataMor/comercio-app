<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            // CÓMO se selecciona la cantidad del producto:
            //   cantidad -> número entero (1, 2, 3 unidades)
            //   peso     -> kilos (decimal); el precio es por kg
            //   volumen  -> litros (decimal); el precio es por litro
            //   longitud -> metros (decimal); el precio es por metro
            $table->string('tipo_venta')->default('cantidad')->after('precio');

            // Etiqueta legible de a qué se refiere el precio:
            // 'unidad', 'porción', 'combo', 'paquete', 'docena', 'kg', 'libra',
            // 'litro', 'ml', 'metro'... (el precio se entiende "por unidad_medida").
            $table->string('unidad_medida', 20)->default('unidad')->after('tipo_venta');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->dropColumn(['tipo_venta', 'unidad_medida']);
        });
    }
};
