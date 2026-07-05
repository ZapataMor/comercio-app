<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

test('el cliente debe registrar direccion y barrio', function () {
    $this->postJson('/api/register', [
        'name' => 'Cliente',
        'email' => 'cliente@correo.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'role' => 'usuario',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['direccion', 'barrio']);
});

test('la direccion del registro queda como ubicacion principal', function () {
    $this->postJson('/api/register', [
        'name' => 'Cliente',
        'email' => 'cliente@correo.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'role' => 'usuario',
        'direccion' => 'Calle 10 # 20-30',
        'barrio' => 'Centro',
    ])->assertCreated()
        ->assertJsonPath('user.direccion', 'Calle 10 # 20-30')
        ->assertJsonPath('user.barrio', 'Centro');

    $this->assertDatabaseHas('users', [
        'email' => 'cliente@correo.com',
        'direccion' => 'Calle 10 # 20-30',
        'barrio' => 'Centro',
    ]);

    $this->assertDatabaseHas('cliente_direcciones', [
        'direccion' => 'Calle 10 # 20-30',
        'barrio' => 'Centro',
        'es_principal' => true,
    ]);
});

test('el cliente puede agregar otra ubicacion', function () {
    $user = User::factory()->create([
        'direccion' => 'Calle Principal',
        'barrio' => 'Centro',
    ]);
    $user->assignRole('usuario');
    $user->clienteDirecciones()->create([
        'direccion' => 'Calle Principal',
        'barrio' => 'Centro',
        'es_principal' => true,
    ]);
    Sanctum::actingAs($user);

    $this->postJson('/api/cliente/direcciones', [
        'direccion' => 'Carrera 5 # 6-7',
        'barrio' => 'Norte',
    ])->assertCreated()
        ->assertJsonPath('direccion.es_principal', false);

    $resp = $this->getJson('/api/cliente/direcciones')->assertOk();
    expect($resp->json('direcciones'))->toHaveCount(2);
    expect($resp->json('direcciones.0.es_principal'))->toBeTrue();
});
