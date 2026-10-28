<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\PermissionRegistrar;

/**
 * Modelo unificado: el rol global 'comerciante' desaparece. Quien lo tenía
 * pasa a 'usuario' (cliente); sus negocios siguen siendo suyos por la
 * membresía (negocio_user), que es lo que autoriza.
 *
 * También se borra la tabla del carrito de la web (la web de clientes ya no
 * existe; el carrito de la app vive en el teléfono).
 */
return new class extends Migration
{
    public function up(): void
    {
        $comerciante = DB::table('roles')->where('name', 'comerciante')->where('guard_name', 'web')->first();

        if ($comerciante) {
            $usuario = DB::table('roles')->where('name', 'usuario')->where('guard_name', 'web')->first();
            $usuarioId = $usuario?->id ?? DB::table('roles')->insertGetId([
                'name' => 'usuario',
                'guard_name' => 'web',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $asignaciones = DB::table('model_has_roles')->where('role_id', $comerciante->id)->get();
            foreach ($asignaciones as $a) {
                DB::table('model_has_roles')->insertOrIgnore([
                    'role_id' => $usuarioId,
                    'model_type' => $a->model_type,
                    'model_id' => $a->model_id,
                ]);
            }

            DB::table('model_has_roles')->where('role_id', $comerciante->id)->delete();
            DB::table('role_has_permissions')->where('role_id', $comerciante->id)->delete();
            DB::table('roles')->where('id', $comerciante->id)->delete();

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }

        Schema::dropIfExists('carrito_items');
    }

    public function down(): void
    {
        // El rol no se recrea: el modelo unificado no lo usa. La tabla del
        // carrito web tampoco vuelve (su código ya no existe).
    }
};
