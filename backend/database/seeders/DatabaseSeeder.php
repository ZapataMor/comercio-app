<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Sin WithoutModelEvents: los hooks de los modelos generan el código
        // público de cada usuario y la membresía del dueño de cada negocio.

        // Primero los roles, para poder asignarlos a los usuarios.
        $this->call(RoleSeeder::class);

        // Catálogo oficial de barrios de Maicao (para el selector de la app).
        $this->call(BarriosSeeder::class);

        // Usuarios de prueba (uno por rol, contraseña conocida) para desarrollo.
        $this->call(DemoUsersSeeder::class);

        // Catálogo realista: 60+ negocios con categorías y productos.
        $this->call(CatalogoDemoSeeder::class);
    }
}
