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
        Schema::create('pedidos', function (Blueprint $table) {
            $table->id();
            // Negocio al que se le pide y cliente que pide.
            $table->foreignId('negocio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Domiciliario que tomó el pedido (null hasta que alguien lo tome).
            $table->foreignId('domiciliario_id')->nullable()->constrained('users')->nullOnDelete();

            // Estado del pedido (ver App\Models\Pedido::ESTADOS).
            $table->string('estado')->default('pendiente');
            // Forma de pago elegida por el cliente.
            $table->string('metodo_pago'); // efectivo | transferencia

            $table->decimal('total', 10, 2);

            // Datos de entrega (copia al momento del pedido; el mapa será después).
            $table->string('direccion_entrega');
            $table->string('telefono_contacto', 30)->nullable();

            // Minutos que el domiciliario estima para pasar a recoger.
            $table->unsignedInteger('minutos_recogida')->nullable();

            $table->timestamps();

            $table->index(['negocio_id', 'estado']);
            $table->index(['estado', 'domiciliario_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pedidos');
    }
};
