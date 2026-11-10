<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Punto de entrega en el mapa.
 *
 * - `cliente_direcciones.lat/lng`: dónde queda la dirección. El cliente lo
 *   fija moviendo el mapa; es opcional (la dirección escrita sigue mandando).
 * - `pedidos.entrega_lat/lng`: copia del punto al momento de pedir, para que
 *   editar o borrar la dirección después no cambie un pedido en curso. Con él
 *   se calcula en cuánto llega el domiciliario.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cliente_direcciones', function (Blueprint $table) {
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
        });
        Schema::table('pedidos', function (Blueprint $table) {
            $table->decimal('entrega_lat', 10, 7)->nullable();
            $table->decimal('entrega_lng', 10, 7)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('cliente_direcciones', fn (Blueprint $table) => $table->dropColumn(['lat', 'lng']));
        Schema::table('pedidos', fn (Blueprint $table) => $table->dropColumn(['entrega_lat', 'entrega_lng']));
    }
};
