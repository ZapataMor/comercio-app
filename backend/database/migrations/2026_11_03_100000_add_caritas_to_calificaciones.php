<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El cliente califica al domiciliario con caritas de 1 a 5 en amabilidad,
 * rapidez y estado del producto (ver Reputacion::ASPECTOS_DOMICILIARIO).
 * Se guardan como {"amabilidad": 5, "rapidez": 4, "estado_producto": 5}.
 * Las calificaciones viejas (solo "todo bien / hubo un problema") quedan en null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calificaciones', function (Blueprint $table) {
            $table->json('domiciliario_caritas')->nullable()->after('domiciliario_ok');
        });
    }

    public function down(): void
    {
        Schema::table('calificaciones', function (Blueprint $table) {
            $table->dropColumn('domiciliario_caritas');
        });
    }
};
