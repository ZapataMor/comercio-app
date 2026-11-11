<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            // 'cliente_no_encontrado' (21 letras) no cabía en los 20 de antes: en
            // MySQL, confirmar esa devolución fallaba con un error del servidor.
            $table->string('cancelado_por', 40)->nullable()->change();

            // Al eliminar un negocio, sus pedidos ya terminados se conservan para
            // el historial del cliente y del domiciliario, con el nombre que tenía.
            $table->string('negocio_nombre')->nullable();
            $table->dropForeign(['negocio_id']);
        });

        Schema::table('pedidos', function (Blueprint $table) {
            $table->unsignedBigInteger('negocio_id')->nullable()->change();
            $table->foreign('negocio_id')->references('id')->on('negocios')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropForeign(['negocio_id']);
        });

        // Los pedidos de negocios eliminados no pueden volver a ser obligatorios.
        \Illuminate\Support\Facades\DB::table('pedidos')->whereNull('negocio_id')->delete();

        Schema::table('pedidos', function (Blueprint $table) {
            $table->unsignedBigInteger('negocio_id')->nullable(false)->change();
            $table->foreign('negocio_id')->references('id')->on('negocios')->cascadeOnDelete();
            $table->dropColumn('negocio_nombre');
            $table->string('cancelado_por', 20)->nullable()->change();
        });
    }
};
