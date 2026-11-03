<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mapa de Vitrina.
 *
 * - `negocios.lat/lng`: dónde queda el negocio. El propietario lo fija
 *   arrastrando un pin; sin coordenadas el negocio no sale en el mapa.
 * - `users.ubicacion_*`: la ÚLTIMA posición que reportó un domiciliario
 *   mientras está en turno o lleva una entrega. Se borra al salir de turno.
 *   Solo la ven el cliente del pedido (mientras se lo llevan), el negocio
 *   (mientras viene a recoger) y el administrador. No es un historial.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->decimal('ubicacion_lat', 10, 7)->nullable();
            $table->decimal('ubicacion_lng', 10, 7)->nullable();
            $table->timestamp('ubicacion_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn(['lat', 'lng']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['ubicacion_lat', 'ubicacion_lng', 'ubicacion_at']);
        });
    }
};
