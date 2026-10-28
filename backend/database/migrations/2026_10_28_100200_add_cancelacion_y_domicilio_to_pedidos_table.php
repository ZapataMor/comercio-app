<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pedidos: cancelación y costo del domicilio.
 *
 * - Estado 'cancelado' (la columna `estado` es texto, no hace falta tocarla):
 *   quién canceló (cliente | negocio | admin), por qué y cuándo.
 * - `subtotal` (productos) + `costo_domicilio` = `total` (lo que paga el
 *   cliente). Los pedidos viejos quedan con subtotal = total y domicilio 0.
 * - Tabla `ajustes` (clave → valor) para valores que el admin cambia sin
 *   tocar código; empieza con la tarifa de domicilio.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->decimal('subtotal', 10, 2)->default(0)->after('metodo_pago');
            $table->decimal('costo_domicilio', 10, 2)->default(0)->after('subtotal');
            $table->string('cancelado_por', 20)->nullable();
            $table->string('motivo_cancelacion')->nullable();
            $table->timestamp('cancelado_at')->nullable();
        });

        DB::table('pedidos')->update(['subtotal' => DB::raw('total')]);

        Schema::create('ajustes', function (Blueprint $table) {
            $table->string('clave', 60)->primary();
            $table->text('valor')->nullable();
            $table->timestamps();
        });

        DB::table('ajustes')->insert([
            'clave' => 'tarifa_domicilio',
            'valor' => '4000',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('ajustes');

        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropColumn(['subtotal', 'costo_domicilio', 'cancelado_por', 'motivo_cancelacion', 'cancelado_at']);
        });
    }
};
