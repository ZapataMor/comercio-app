<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    /**
     * Crea los 4 roles base de la app.
     *
     * Se usa el guard 'web' (el guard por defecto del modelo User),
     * porque Sanctum resuelve al usuario sobre ese mismo guard y así
     * $user->hasRole('comerciante') funciona sin configuración extra.
     */
    public function run(): void
    {
        // Limpia la caché de permisos/roles antes de sembrar.
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $roles = ['administrador', 'comerciante', 'usuario', 'domiciliario'];

        foreach ($roles as $role) {
            Role::firstOrCreate([
                'name' => $role,
                'guard_name' => 'web',
            ]);
        }
    }
}
