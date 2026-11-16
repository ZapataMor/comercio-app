<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Comida: de los ingredientes (`atributos`), los que el cliente no puede
        // quitar (la carne de la hamburguesa), y los extras que pide aparte, cada
        // uno con su precio por porción: [{"nombre": "Queso", "precio": 2000}].
        Schema::table('productos', function (Blueprint $table) {
            $table->json('ingredientes_fijos')->nullable()->after('colores');
            $table->json('extras')->nullable()->after('ingredientes_fijos');
        });
    }

    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->dropColumn(['ingredientes_fijos', 'extras']);
        });
    }
};
