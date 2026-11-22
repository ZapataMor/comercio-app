<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Visitas a la tienda: una fila cada vez que un cliente entra a ver un
 * negocio. De aquí salen las visitas y las personas distintas que ve el
 * administrador del negocio en «Mi tienda».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('negocio_visitas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            // Si se borra la cuenta, la visita sigue contando (sin la persona).
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['negocio_id', 'created_at']);
            $table->index(['negocio_id', 'user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('negocio_visitas');
    }
};
