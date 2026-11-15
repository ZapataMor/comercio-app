<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El cliente ya no responde "¿el negocio cumplió?" al calificar: solo califica
 * al domiciliario con caritas. A la tienda la valora con su reseña.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calificaciones', function (Blueprint $table) {
            $table->boolean('negocio_ok')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('calificaciones', function (Blueprint $table) {
            $table->boolean('negocio_ok')->nullable(false)->change();
        });
    }
};
