<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->timestamp('llegada_at')->nullable();
            $table->timestamp('cliente_no_encontrado_at')->nullable();
            $table->timestamp('devuelto_at')->nullable();
            $table->foreignId('devolucion_confirmada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->text('faltante_motivo')->nullable();
            $table->timestamp('faltante_at')->nullable();
            $table->uuid('faltante_version')->nullable();
            $table->timestamp('ajustado_at')->nullable();
        });
        Schema::create('pedido_reportes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reportado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->string('objetivo', 20);
            $table->string('tipo', 40);
            $table->text('motivo');
            $table->timestamp('resuelto_at')->nullable();
            $table->foreignId('resuelto_por')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolucion')->nullable();
            $table->timestamps();
            $table->unique(['pedido_id', 'objetivo', 'tipo']);
            $table->index(['resuelto_at', 'created_at']);
        });
        Schema::create('carrito_reservas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained()->cascadeOnDelete();
            $table->decimal('precio', 10, 2);
            $table->timestamp('vence_at')->index();
            $table->unique(['user_id', 'producto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedido_reportes');
        Schema::dropIfExists('carrito_reservas');
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('devolucion_confirmada_por');
            $table->dropColumn(['llegada_at', 'cliente_no_encontrado_at', 'devuelto_at', 'faltante_motivo', 'faltante_at', 'faltante_version', 'ajustado_at']);
        });
    }
};
