<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Códigos de los pedidos:
 *  - `codigo`: identifica el pedido ante las personas (reemplaza al "#123",
 *    que dejaba ver cuántos pedidos hay). Aleatorio, único y para siempre.
 *  - `codigo_confirmacion`: reemplaza a `codigo_recogida` y `codigo_entrega`.
 *    Un pedido nunca tiene los dos vivos a la vez (el de recogida se usa antes
 *    de que nazca el de entrega), así que basta una columna: el índice único
 *    hace imposible que dos códigos vigentes coincidan, sean del tipo que sean.
 *    Se vacía al terminar, y entonces el código puede volver a salir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('codigo', 8)->nullable()->after('id');
            $table->string('codigo_confirmacion', 4)->nullable();
        });

        $alfabeto = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
        $codigos = [];
        $vigentes = [];

        DB::table('pedidos')->orderBy('id')->get()->each(function ($pedido) use ($alfabeto, &$codigos, &$vigentes) {
            do {
                $codigo = '';
                for ($i = 0; $i < 8; $i++) {
                    $codigo .= $alfabeto[random_int(0, 29)];
                }
            } while (isset($codigos[$codigo]));
            $codigos[$codigo] = true;

            $vigente = match ($pedido->estado) {
                'tomado' => $pedido->codigo_recogida,
                'recogido', 'en_camino' => $pedido->codigo_entrega,
                default => false,
            };

            // Los pedidos en curso conservan el suyo, salvo que ya estuviera repetido.
            if ($vigente !== false) {
                while ($vigente === null || isset($vigentes[$vigente])) {
                    $vigente = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
                }
                $vigentes[$vigente] = true;
            }

            DB::table('pedidos')->where('id', $pedido->id)->update([
                'codigo' => $codigo,
                'codigo_confirmacion' => $vigente === false ? null : $vigente,
            ]);
        });

        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('codigo', 8)->nullable(false)->change();
            $table->unique('codigo');
            $table->unique('codigo_confirmacion');
            $table->dropColumn(['codigo_recogida', 'codigo_entrega']);
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('codigo_recogida', 4)->nullable();
            $table->string('codigo_entrega', 4)->nullable();
        });

        DB::table('pedidos')->where('estado', 'tomado')->update(['codigo_recogida' => DB::raw('codigo_confirmacion')]);
        DB::table('pedidos')->whereIn('estado', ['recogido', 'en_camino'])->update(['codigo_entrega' => DB::raw('codigo_confirmacion')]);

        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropUnique(['codigo']);
            $table->dropUnique(['codigo_confirmacion']);
            $table->dropColumn(['codigo', 'codigo_confirmacion']);
        });
    }
};
