<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Barrio de Maicao donde queda el negocio (texto, como el del cliente). Si
 * no está en el catálogo de barrios queda como sugerencia para el
 * administrador (Barrio::registrarSiEsNuevo). Los negocios de antes quedan
 * en null hasta que el propietario lo ponga.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->string('barrio', 100)->nullable()->after('direccion');
        });
    }

    public function down(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn('barrio');
        });
    }
};
