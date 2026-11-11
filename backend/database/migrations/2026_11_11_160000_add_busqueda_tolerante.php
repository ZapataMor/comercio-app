<?php

use App\Support\Busqueda;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Columna `busqueda` (texto normalizado «como suena») en todo lo que el cliente
 * puede buscar. Ver App\Support\Busqueda.
 */
return new class extends Migration
{
    private const TABLAS = ['productos', 'servicios', 'negocios', 'categorias', 'tipos_negocio'];

    public function up(): void
    {
        foreach (self::TABLAS as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->text('busqueda')->nullable();
            });
        }

        Busqueda::reindexar();
    }

    public function down(): void
    {
        foreach (self::TABLAS as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->dropColumn('busqueda');
            });
        }
        Busqueda::olvidarVocabulario();
    }
};
