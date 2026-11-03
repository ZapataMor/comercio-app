<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * El domiciliario pasa a ser un cliente que además reparte: los que ya
 * existían (creados por un admin solo con 'domiciliario') reciben también
 * el rol 'usuario', y con él Explorar, el carrito y sus pedidos.
 */
return new class extends Migration
{
    public function up(): void
    {
        $domiciliario = DB::table('roles')->where('name', 'domiciliario')->where('guard_name', 'web')->first();
        $usuario = DB::table('roles')->where('name', 'usuario')->where('guard_name', 'web')->first();

        if (! $domiciliario || ! $usuario) {
            return;
        }

        $asignaciones = DB::table('model_has_roles')->where('role_id', $domiciliario->id)->get();
        foreach ($asignaciones as $a) {
            DB::table('model_has_roles')->insertOrIgnore([
                'role_id' => $usuario->id,
                'model_type' => $a->model_type,
                'model_id' => $a->model_id,
            ]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // No se quita: ya no se distingue quién era cliente antes.
    }
};
