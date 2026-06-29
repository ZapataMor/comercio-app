<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega la columna `imagen` (ruta relativa del archivo guardado en storage,
 * ej. "productos/abc.jpg") a negocios y productos. Nullable: la imagen es opcional.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->string('imagen')->nullable()->after('telefono');
        });

        Schema::table('productos', function (Blueprint $table) {
            $table->string('imagen')->nullable()->after('descripcion');
        });
    }

    public function down(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn('imagen');
        });

        Schema::table('productos', function (Blueprint $table) {
            $table->dropColumn('imagen');
        });
    }
};
