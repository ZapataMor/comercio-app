<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Primero los roles, para poder asignarlos a los usuarios.
        $this->call(RoleSeeder::class);

        // Usuarios de prueba (uno por rol, contraseña conocida) para desarrollo.
        $this->call(DemoUsersSeeder::class);

        // Catálogo realista: 60+ negocios con categorías y productos.
        $this->call(CatalogoDemoSeeder::class);
    }
}
