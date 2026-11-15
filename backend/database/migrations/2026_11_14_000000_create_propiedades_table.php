<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Propiedades: casas en venta, casas en alquiler y patios para eventos que
 * publica cualquier persona (no un negocio). Salen en la sección
 * «Propiedades» del cliente y en su propio mapa, así que el pin es obligatorio.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('propiedades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // venta | alquiler | eventos
            $table->string('tipo', 20)->index();
            $table->string('titulo', 120);
            $table->text('descripcion');
            // Pesos: precio de venta, canon mensual o valor por evento.
            $table->unsignedBigInteger('precio');
            $table->boolean('negociable')->default(false);
            $table->string('direccion', 191);
            $table->string('barrio', 100);
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            // Casas.
            $table->unsignedTinyInteger('habitaciones')->nullable();
            $table->unsignedTinyInteger('banos')->nullable();
            $table->unsignedSmallInteger('area_m2')->nullable();
            $table->unsignedTinyInteger('estrato')->nullable();
            // Patios: cuántas personas caben.
            $table->unsignedSmallInteger('capacidad')->nullable();
            $table->json('caracteristicas')->nullable();
            // Requisitos del arriendo, horario y reglas del patio...
            $table->text('condiciones')->nullable();
            $table->string('contacto_nombre', 100);
            $table->string('contacto_telefono', 10);
            $table->json('galeria')->nullable();
            // Oculta: ya se vendió, se alquiló o el dueño la pausó.
            $table->boolean('disponible')->default(true);
            $table->text('busqueda')->nullable();
            $table->timestamps();

            $table->index(['disponible', 'tipo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('propiedades');
    }
};
