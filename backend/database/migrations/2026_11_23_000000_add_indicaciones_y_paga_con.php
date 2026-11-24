<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que el cliente quiere que sepa el domiciliario:
 *  - indicaciones: cómo llegar a su casa ("frente a la tienda La 14, casa
 *    azul de rejas blancas"). Van en la dirección guardada y se copian al pedido.
 *  - paga_con: con qué billete paga en efectivo (null = el valor exacto). El
 *    domiciliario sabe cuánto cambio llevar.
 *
 * Además, los barrios vuelven a guardarse con espacios: la app cambiaba los
 * espacios por guiones ("Santa-Isabel"). Los que ya quedaron así se arreglan,
 * y las sugerencias repetidas que eso creó en el catálogo se quitan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cliente_direcciones', function (Blueprint $table) {
            $table->string('indicaciones', 255)->nullable()->after('barrio');
        });
        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('entrega_indicaciones', 255)->nullable()->after('direccion_entrega');
            $table->decimal('paga_con', 12, 2)->nullable()->after('metodo_pago');
        });

        foreach (['users', 'cliente_direcciones', 'negocios'] as $tabla) {
            DB::table($tabla)->where('barrio', 'like', '%-%')->update(['barrio' => DB::raw("REPLACE(barrio, '-', ' ')")]);
        }

        // Sugerencias con guiones: si ya existe el barrio con espacios, sobran.
        DB::table('barrios')->where('nombre', 'like', '%-%')->orderBy('id')->get()->each(function ($barrio) {
            $nombre = str_replace('-', ' ', $barrio->nombre);
            $existe = DB::table('barrios')
                ->where('id', '!=', $barrio->id)
                ->whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])
                ->exists();
            $existe
                ? DB::table('barrios')->where('id', $barrio->id)->delete()
                : DB::table('barrios')->where('id', $barrio->id)->update(['nombre' => $nombre]);
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropColumn(['entrega_indicaciones', 'paga_con']);
        });
        Schema::table('cliente_direcciones', function (Blueprint $table) {
            $table->dropColumn('indicaciones');
        });
    }
};
