<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Antes de cada test: crear los 4 roles (la BD se reinicia en cada test).
beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

/** Cliente autenticado vía Sanctum. */
function clienteAutenticado(): User
{
    $user = User::factory()->create();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);

    return $user;
}

test('la búsqueda de productos exige autenticación', function () {
    $this->getJson('/api/productos?buscar=arroz')->assertStatus(401);
});

test('sin texto la búsqueda de productos devuelve lista vacía', function () {
    clienteAutenticado();

    $this->getJson('/api/productos')
        ->assertOk()
        ->assertExactJson(['productos' => []]);
});

test('la búsqueda devuelve productos disponibles con su negocio, por relevancia', function () {
    clienteAutenticado();

    $dueno = User::factory()->create();
    $negocio = $dueno->negocio()->create(['nombre' => 'Donde Pepe', 'activo' => true]);
    $negocio->productos()->createMany([
        ['nombre' => 'Arroz con pollo', 'precio' => 12000],      // contiene
        ['nombre' => 'Arroz', 'precio' => 3000],                 // exacto
        ['nombre' => 'Arroz chino', 'precio' => 9000],           // empieza por
        ['nombre' => 'Pollo asado', 'precio' => 15000],          // no coincide
    ]);

    $resp = $this->getJson('/api/productos?buscar=Arroz')->assertOk();

    $nombres = collect($resp->json('productos'))->pluck('nombre')->all();

    // Orden por cercanía: exacto, empieza por, contiene. "Pollo asado" no entra.
    expect($nombres)->toBe(['Arroz', 'Arroz chino', 'Arroz con pollo']);

    // Cada producto trae el negocio que lo vende.
    expect($resp->json('productos.0.negocio.nombre'))->toBe('Donde Pepe');
});

test('la búsqueda ignora productos no disponibles y negocios cerrados', function () {
    clienteAutenticado();

    $dueno = User::factory()->create();
    $abierto = $dueno->negocio()->create(['nombre' => 'Abierto', 'activo' => true]);
    $abierto->productos()->create(['nombre' => 'Pan dulce', 'precio' => 1000, 'disponible' => false]);

    $otroDueno = User::factory()->create();
    $cerrado = $otroDueno->negocio()->create(['nombre' => 'Cerrado', 'activo' => false]);
    $cerrado->productos()->create(['nombre' => 'Pan salado', 'precio' => 1000]);

    $this->getJson('/api/productos?buscar=Pan')
        ->assertOk()
        ->assertJsonCount(0, 'productos');
});
