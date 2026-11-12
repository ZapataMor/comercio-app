<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            // Identifica el intento de compra: si la app reintenta porque se
            // perdió la respuesta, se devuelve el mismo pedido en vez de otro.
            $table->string('clave_intento', 64)->nullable();
            $table->unique(['user_id', 'clave_intento']);

            // Cierre manual de un pedido atascado: qué admin lo cerró y por qué.
            $table->foreignId('cerrado_por_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nota_admin')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cerrado_por_admin_id');
            // MySQL usa el índice único para la llave foránea de user_id y no
            // deja borrarlo si la columna se queda sin otro índice.
            $table->index('user_id');
            $table->dropUnique(['user_id', 'clave_intento']);
            $table->dropColumn(['clave_intento', 'nota_admin']);
        });
    }
};
