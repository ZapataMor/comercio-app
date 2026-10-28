<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DemoUsersSeeder extends Seeder
{
    /**
     * Crea usuarios de prueba (uno por rol + un dueño de negocio), todos con la MISMA contraseña
     * conocida ("password123") para poder probar el login y ver la "vista"
     * de cada tipo de usuario.
     *
     * Pensado SOLO para desarrollo. No usar en producción.
     */
    public function run(): void
    {
        $usuarios = [
            ['administrador', 'Admin Demo', 'admin@demo.co'],
            // Cliente que además administra "El Rincón Paisa" (ver CatalogoDemoSeeder).
            ['usuario', 'Comerciante Demo', 'comerciante@demo.co'],
            ['domiciliario', 'Domiciliario Demo', 'domiciliario@demo.co'],
            ['usuario', 'Cliente Demo', 'cliente@demo.co'],
        ];

        foreach ($usuarios as [$rol, $nombre, $email]) {
            // updateOrCreate => se puede correr el seeder varias veces sin duplicar.
            $user = User::updateOrCreate(
                ['email' => $email],
                ['name' => $nombre, 'password' => 'password123'], // se hashea solo (cast 'hashed')
            );

            $user->syncRoles([$rol]);
        }
    }
}
