<?php

use App\Models\Negocio;
use App\Models\Servicio;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Database\Seeders\ServiciosDemoSeeder;

it('crea veinte negocios de servicios con ocho mixtos sin duplicar ni sobrescribir ediciones', function () {
    $this->seed(RoleSeeder::class);
    $this->seed(ServiciosDemoSeeder::class);
    expect(Servicio::count())->toBe(20);
    expect(Negocio::whereHas('servicios')->count())->toBe(20);
    expect(Negocio::whereHas('servicios')->whereHas('productos')->count())->toBe(8);
    expect(Negocio::whereHas('servicios')->whereDoesntHave('productos')->count())->toBe(12);
    $dueno = User::where('email', 'comerciante@demo.co')->firstOrFail();
    expect($dueno->negociosActivos()->count())->toBe(20);
    $servicio = Servicio::firstOrFail();
    $servicio->update(['descripcion' => 'Editado por el usuario', 'disponible' => false]);
    $this->seed(ServiciosDemoSeeder::class);
    expect(Servicio::count())->toBe(20);
    expect(Negocio::count())->toBe(20);
    expect($servicio->fresh()->descripcion)->toBe('Editado por el usuario');
    expect($servicio->fresh()->disponible)->toBeFalse();
});
