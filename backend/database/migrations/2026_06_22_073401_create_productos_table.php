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
        Schema::create('productos', function (Blueprint $table) {
            $table->id();
            // A qué negocio pertenece. Si se borra el negocio, se borran sus productos.
            $table->foreignId('negocio_id')->constrained()->cascadeOnDelete();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            // decimal(10,2): hasta 99.999.999,99. NUNCA usar float para dinero.
            $table->decimal('precio', 10, 2);
            // El comerciante puede ocultar un producto sin borrarlo.
            $table->boolean('disponible')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};
