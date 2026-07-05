<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Categoría (tipo) del negocio: restaurante, almacén de ropa, farmacia, etc.
 * Nullable para los negocios ya existentes; obligatoria al crear uno nuevo
 * (se valida en NegocioController).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->string('categoria', 100)->nullable()->after('descripcion');
        });
    }

    public function down(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn('categoria');
        });
    }
};
