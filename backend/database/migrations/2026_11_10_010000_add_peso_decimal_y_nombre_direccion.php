<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido_items', function (Blueprint $table) {
            $table->decimal('cantidad', 8, 3)->change();
            $table->string('unidad_medida', 20)->default('unidad');
        });
        Schema::table('cliente_direcciones', function (Blueprint $table) {
            $table->string('nombre', 80)->nullable();
        });
    }

    public function down(): void
    {
        // Conservar las cantidades decimales existentes al revertir.
        Schema::table('pedido_items', fn (Blueprint $table) => $table->dropColumn('unidad_medida'));
        Schema::table('cliente_direcciones', fn (Blueprint $table) => $table->dropColumn('nombre'));
    }
};
