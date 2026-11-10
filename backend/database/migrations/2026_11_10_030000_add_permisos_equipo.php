<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['negocio_user', 'invitaciones_trabajo'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                // Conserva el acceso operativo de las membresías e invitaciones anteriores.
                $table->boolean('modificar_inventario')->default(true);
                $table->boolean('gestionar_pedidos')->default(true);
                $table->boolean('cambiar_estado')->default(false);
                $table->boolean('administrador')->default(false);
            });
        }
    }

    public function down(): void
    {
        foreach (['negocio_user', 'invitaciones_trabajo'] as $tabla) {
            Schema::table($tabla, fn (Blueprint $table) => $table->dropColumn([
                'modificar_inventario', 'gestionar_pedidos', 'cambiar_estado', 'administrador',
            ]));
        }
    }
};
