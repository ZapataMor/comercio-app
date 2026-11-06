<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Nuevo flujo del pedido:
 *  - El negocio ACEPTA cada pedido: estado 'aceptado' (la columna `estado` es
 *    texto, no hace falta tocarla) y `aceptado_at`.
 *  - La recogida y la entrega se confirman con un código de 4 dígitos. El de
 *    recogida nace al tomar el pedido; el de entrega, al crearlo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->timestamp('aceptado_at')->nullable();
            $table->string('codigo_recogida', 4)->nullable();
            $table->string('codigo_entrega', 4)->nullable();
        });

        // Los pedidos que ya van en curso también necesitan sus códigos.
        $codigo = fn () => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        DB::table('pedidos')
            ->whereIn('estado', ['pendiente', 'listo', 'tomado', 'recogido', 'en_camino'])
            ->orderBy('id')
            ->each(function ($pedido) use ($codigo) {
                DB::table('pedidos')->where('id', $pedido->id)->update([
                    'codigo_entrega' => $codigo(),
                    'codigo_recogida' => $pedido->estado === 'tomado' ? $codigo() : null,
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropColumn(['aceptado_at', 'codigo_recogida', 'codigo_entrega']);
        });
    }
};
