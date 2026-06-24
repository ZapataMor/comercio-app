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
        Schema::create('pedido_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained()->cascadeOnDelete();
            // Referencia al producto (puede quedar null si el producto se borra).
            $table->foreignId('producto_id')->nullable()->constrained()->nullOnDelete();
            // COPIA de los datos al momento del pedido (no se altera si cambia el catálogo).
            $table->string('nombre');
            $table->decimal('precio', 10, 2);
            $table->unsignedInteger('cantidad');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pedido_items');
    }
};
