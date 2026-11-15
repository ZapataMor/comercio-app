<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Cinco domiciliarios de prueba (usuarios domiciliario1 a domiciliario5,
 * contraseña 'password123'), para el VPS de pruebas:
 *
 *     php8.4 artisan db:seed --class=DomiciliariosPruebaSeeder --force
 *
 * Cada cuenta queda como cliente que además reparte (roles usuario +
 * domiciliario) y con teléfono, que es lo que pide hacerseDomiciliario().
 * Se puede correr varias veces sin duplicar.
 */
class DomiciliariosPruebaSeeder extends Seeder
{
    private const CONTRASENA = 'password123';

    public function run(): void
    {
        DB::transaction(function () {
            foreach (range(1, 5) as $numero) {
                $user = User::firstOrNew(['username' => "domiciliario{$numero}"]);
                $user->fill([
                    'name' => 'Domiciliario',
                    'apellidos' => (string) $numero,
                    'password' => self::CONTRASENA, // se hashea solo (cast 'hashed')
                ]);
                $user->forceFill([
                    'telefono' => $user->telefono ?? '300222330'.$numero,
                    'terminos_aceptados_at' => $user->terminos_aceptados_at ?? now(),
                ])->save();
                $user->syncRoles(User::rolesDelTipo('domiciliario'));
            }
        });
    }
}
