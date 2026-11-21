<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pago por transferencia verificado por el negocio:
 *  - cuentas donde el negocio recibe (Nequi, llave, banco, QR...);
 *  - en el pedido, en qué va el pago: por_pagar → informado (el cliente dice
 *    que pagó, con comprobante opcional) → confirmado (el negocio revisó que
 *    le llegó), o no_llego si el negocio no lo encuentra.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('negocio_cuentas_pago', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            // llave | nequi | daviplata | bancolombia | banco | qr
            $table->string('tipo', 20);
            // Solo para tipo «banco»: cuál.
            $table->string('banco', 60)->nullable();
            // Número de celular, de cuenta o la llave.
            $table->string('numero', 60)->nullable();
            // ahorros | corriente (cuentas de banco).
            $table->string('tipo_cuenta', 20)->nullable();
            // A nombre de quién: el cliente lo compara con lo que le muestra su banco.
            $table->string('titular', 100);
            // Imagen del código QR (disco public).
            $table->string('qr')->nullable();
            $table->unsignedTinyInteger('orden')->default(0);
            $table->timestamps();
        });

        Schema::table('pedidos', function (Blueprint $table) {
            // Solo transferencia: por_pagar | informado | confirmado | no_llego.
            $table->string('pago_estado', 20)->nullable();
            // Copia de la cuenta que eligió el cliente (si el negocio la borra, queda aquí).
            $table->json('pago_cuenta')->nullable();
            // Foto del comprobante (disco local, privada).
            $table->string('pago_comprobante')->nullable();
            $table->timestamp('pago_informado_at')->nullable();
            $table->timestamp('pago_confirmado_at')->nullable();
            $table->foreignId('pago_confirmado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('pago_no_llego_at')->nullable();
        });

        // Pedidos por transferencia de antes: los que ya salieron se dan por
        // pagados; los que aún no, quedan esperando el pago.
        DB::table('pedidos')->where('metodo_pago', 'transferencia')->whereIn('estado', ['pendiente', 'aceptado'])
            ->update(['pago_estado' => 'por_pagar']);
        DB::table('pedidos')->where('metodo_pago', 'transferencia')->whereNotIn('estado', ['pendiente', 'aceptado', 'cancelado'])
            ->update(['pago_estado' => 'confirmado']);
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pago_confirmado_por');
            $table->dropColumn(['pago_estado', 'pago_cuenta', 'pago_comprobante', 'pago_informado_at', 'pago_confirmado_at', 'pago_no_llego_at']);
        });
        Schema::dropIfExists('negocio_cuentas_pago');
    }
};
