<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Devolución de una transferencia de un pedido cancelado, con estados:
 * solicitado → devuelto (el negocio, con monto y comprobante opcional) →
 * recibido (el cliente confirma) o no_recibido (vuelve al negocio); o
 * rechazado si el negocio nunca recibió el pago.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('reembolso_estado', 20)->nullable();
            // A dónde quiere el cliente que le devuelvan (texto libre: «Nequi 300…»).
            $table->string('reembolso_cuenta', 150)->nullable();
            $table->decimal('reembolso_monto', 12, 2)->nullable();
            // Foto del comprobante de la devolución (disco local, privada).
            $table->string('reembolso_comprobante')->nullable();
            $table->timestamp('reembolso_devuelto_at')->nullable();
            $table->foreignId('reembolso_devuelto_por')->nullable()->constrained('users')->nullOnDelete();
            // Por qué el negocio la rechazó.
            $table->string('reembolso_motivo', 255)->nullable();
            $table->timestamp('reembolso_rechazado_at')->nullable();
            // Cuándo respondió el cliente (recibido o no_recibido).
            $table->timestamp('reembolso_respondido_at')->nullable();
        });

        // Las solicitudes de antes quedan como solicitadas.
        DB::table('pedidos')->whereNotNull('reembolso_solicitado_at')->update(['reembolso_estado' => 'solicitado']);
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reembolso_devuelto_por');
            $table->dropColumn([
                'reembolso_estado', 'reembolso_cuenta', 'reembolso_monto', 'reembolso_comprobante',
                'reembolso_devuelto_at', 'reembolso_motivo', 'reembolso_rechazado_at', 'reembolso_respondido_at',
            ]);
        });
    }
};
