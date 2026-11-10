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

        // Los 30 negocios demo: perfil, pin en el mapa, horario, catálogo
        // (ingredientes, tallas, colores, usos...) y servicios con cita.
        $this->call(NegociosDemoSeeder::class);

        // Clientes de prueba con reseñas de tiendas y productos.
        $this->call(ResenasDemoSeeder::class);

        // Una receta preferida de cliente@demo.co para ver la recomendación.
        $this->call(RecetasDemoSeeder::class);
    }
}
