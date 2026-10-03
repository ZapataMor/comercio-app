<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

test('el cliente debe registrar direccion, barrio y telefono', function () {
    $this->postJson('/api/register', [
        'name' => 'Cliente',
        'apellidos' => 'Pérez',
        'email' => 'cliente@correo.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['direccion', 'barrio', 'telefono']);
});

test('el registro exige los apellidos en su propio campo', function () {
    $this->postJson('/api/register', [
        'name' => 'Cliente',
        'email' => 'cliente@correo.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'direccion' => 'Calle 10 # 20-30',
        'barrio' => 'Centro',
        'telefono' => '3001234567',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['apellidos']);
});

test('el registro guarda nombre y apellidos por separado', function () {
    $this->postJson('/api/register', [
        'name' => 'Ana María',
        'apellidos' => 'Pérez Gómez',
        'email' => 'ana@correo.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'direccion' => 'Calle 10 # 20-30',
        'barrio' => 'Centro',
        'telefono' => '3001234567',
    ])->assertCreated()
        ->assertJsonPath('user.name', 'Ana María')
        ->assertJsonPath('user.apellidos', 'Pérez Gómez');

    $user = User::where('email', 'ana@correo.com')->firstOrFail();
    expect($user->nombre_completo)->toBe('Ana María Pérez Gómez');
});

test('la direccion del registro queda como ubicacion principal', function () {
    $this->postJson('/api/register', [
        'name' => 'Cliente',
        'apellidos' => 'Pérez',
        'email' => 'cliente@correo.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'direccion' => 'Calle 10 # 20-30',
        'barrio' => 'Centro',
        'telefono' => '3001234567',
    ])->assertCreated()
        ->assertJsonPath('user.direccion', 'Calle 10 # 20-30')
        ->assertJsonPath('user.barrio', 'Centro')
        ->assertJsonPath('user.telefono', '3001234567');

    $this->assertDatabaseHas('users', [
        'email' => 'cliente@correo.com',
        'direccion' => 'Calle 10 # 20-30',
        'barrio' => 'Centro',
        'telefono' => '3001234567',
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
