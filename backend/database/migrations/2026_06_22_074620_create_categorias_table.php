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
        Schema::create('categorias', function (Blueprint $table) {
            $table->id();
            // Cada comerciante define sus propias categorías (Bebidas, Comidas...).
            $table->foreignId('negocio_id')->constrained()->cascadeOnDelete();
            $table->string('nombre');
            $table->timestamps();

            // No permitir dos categorías con el mismo nombre en el mismo negocio.
            $table->unique(['negocio_id', 'nombre']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('categorias');
    }
};
