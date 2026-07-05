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
function clienteCatalogo(): User
{
    $user = User::factory()->create();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);

    return $user;
}

/** Crea `$cantidad` negocios, cada uno con su comerciante dueño. */
function crearNegocios(int $cantidad, bool $activo = true): void
{
    User::factory($cantidad)->create()->each(
        fn ($u, $i) => $u->negocio()->create([
            'nombre' => sprintf('Negocio %03d', $i),
            'activo' => $activo,
        ])
    );
}

test('el listado de negocios exige autenticación', function () {
    $this->getJson('/api/negocios')->assertStatus(401);
});

test('el listado incluye todos los negocios, abiertos y cerrados', function () {
    clienteCatalogo();

    $dueno = User::factory()->create();
    $dueno->negocio()->create(['nombre' => 'Abierto SA', 'activo' => true, 'categoria' => 'Restaurante']);

    $otroDueno = User::factory()->create();
    $otroDueno->negocio()->create(['nombre' => 'Cerrado SA', 'activo' => false]);

    $resp = $this->getJson('/api/negocios')->assertOk();

    $negocios = collect($resp->json('negocios'));
    expect($negocios)->toHaveCount(2);

    // Los abiertos van primero y cada negocio dice si está abierto.
    expect($negocios->pluck('nombre')->all())->toBe(['Abierto SA', 'Cerrado SA']);
    expect($negocios->firstWhere('nombre', 'Abierto SA')['abierto'])->toBeTrue();
    expect($negocios->firstWhere('nombre', 'Abierto SA')['categoria'])->toBe('Restaurante');
    expect($negocios->firstWhere('nombre', 'Cerrado SA')['abierto'])->toBeFalse();
});

test('el listado se pagina de 50 en 50', function () {
    clienteCatalogo();

    crearNegocios(55);

    $pagina1 = $this->getJson('/api/negocios')->assertOk();
    expect($pagina1->json('negocios'))->toHaveCount(50);
    expect($pagina1->json('meta'))->toBe([
        'pagina' => 1,
        'ultima_pagina' => 2,
        'total' => 55,
    ]);

    $pagina2 = $this->getJson('/api/negocios?page=2')->assertOk();
    expect($pagina2->json('negocios'))->toHaveCount(5);
    expect($pagina2->json('meta.pagina'))->toBe(2);

    // Ningún negocio se repite entre páginas: entre ambas están los 55.
    $ids = collect($pagina1->json('negocios'))
        ->merge($pagina2->json('negocios'))
        ->pluck('id');
    expect($ids->unique())->toHaveCount(55);
});
