<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
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
        'acepta_terminos' => true,
        'verificacion' => verificacionTelefono('3001234567'),
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
        'acepta_terminos' => true,
        'verificacion' => verificacionTelefono('3001234567'),
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
        'acepta_terminos' => true,
        'verificacion' => verificacionTelefono('3001234567'),
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

    $this->postJson('/api/cliente/direcciones', [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24,
        'direccion' => 'Carrera 5 # 6-7',
        'barrio' => 'Norte',
    ])->assertCreated()
        ->assertJsonPath('direccion.es_principal', false);

    $resp = $this->getJson('/api/cliente/direcciones')->assertOk();
    expect($resp->json('direcciones'))->toHaveCount(2);
    expect($resp->json('direcciones.0.es_principal'))->toBeTrue();
});

test('el cliente edita su direccion y su nombre opcional y sincroniza el perfil', function () {
    $user = User::factory()->create();
    $user->assignRole('usuario');
    $direccion = $user->clienteDirecciones()->create([
        'direccion' => 'Calle anterior', 'barrio' => 'Centro', 'es_principal' => true,
    ]);
    Sanctum::actingAs($user);
    $this->putJson("/api/cliente/direcciones/{$direccion->id}", [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24,
        'direccion' => 'Calle 20 Carrera 2-este #10-20', 'barrio' => 'Centro', 'nombre' => 'Mi-casa',
    ])->assertOk()->assertJsonPath('direccion.nombre', 'Mi-casa');
    $this->getJson('/api/cliente/direcciones')->assertOk()->assertJsonPath('direcciones.0.nombre', 'Mi-casa');
    expect($user->fresh()->direccion)->toBe('Calle 20 Carrera 2-este #10-20');
    $this->putJson("/api/cliente/direcciones/{$direccion->id}", [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24,
        'direccion' => 'Calle 20 Carrera 2-este #10-20', 'barrio' => 'Centro', 'nombre' => null,
    ])->assertOk()->assertJsonPath('direccion.nombre', null);
});

test('no se puede consultar ni editar la direccion de otro cliente', function () {
    $otro = User::factory()->create();
    $direccion = $otro->clienteDirecciones()->create(['direccion' => 'Privada', 'barrio' => 'Centro', 'nombre' => 'Mi-casa']);
    $user = User::factory()->create();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);
    $this->getJson('/api/cliente/direcciones')->assertOk()->assertJsonCount(0, 'direcciones');
    $this->putJson("/api/cliente/direcciones/{$direccion->id}", [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24,
        'direccion' => 'Otra', 'barrio' => 'Centro', 'nombre' => 'Trabajo',
    ])->assertNotFound();
    expect($direccion->fresh()->nombre)->toBe('Mi-casa');
});

test('el nombre es opcional al crear y no permite textos demasiado largos', function () {
    $user = User::factory()->create();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);
    $this->postJson('/api/cliente/direcciones', [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24, 'direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro'])
        ->assertCreated()->assertJsonPath('direccion.nombre', null);
    $this->postJson('/api/cliente/direcciones', [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24, 'direccion' => 'Calle 2 #10-20', 'barrio' => 'Centro', 'nombre' => str_repeat('a', 81)])
        ->assertUnprocessable()->assertJsonValidationErrors('nombre');
});

test('cambiar principal mantiene una sola por usuario y conserva el punto', function () {
    $user = User::factory()->create();
    $user->assignRole('usuario');
    $primera = $user->clienteDirecciones()->create(['direccion' => 'Calle 1', 'barrio' => 'Centro', 'es_principal' => true]);
    $segunda = $user->clienteDirecciones()->create(['direccion' => 'Calle 2', 'barrio' => 'Norte', 'lat' => 4.6, 'lng' => -74.1]);
    $otro = User::factory()->create();
    $ajena = $otro->clienteDirecciones()->create(['direccion' => 'Calle 3', 'barrio' => 'Sur', 'es_principal' => true]);
    Sanctum::actingAs($user);

    foreach ([$segunda, $segunda, $primera, $segunda] as $elegida) {
        $this->putJson("/api/cliente/direcciones/{$elegida->id}/principal")
            ->assertOk()->assertJsonPath('direcciones.0.id', $elegida->id);
        expect($user->clienteDirecciones()->where('es_principal', true)->count())->toBe(1);
    }
    expect($user->fresh()->direccion)->toBe('Calle 2');
    expect((float) $segunda->fresh()->lat)->toBe(4.6);
    expect($ajena->fresh()->es_principal)->toBeTrue();
    $this->putJson("/api/cliente/direcciones/{$ajena->id}/principal")->assertNotFound();
    $this->deleteJson("/api/cliente/direcciones/{$ajena->id}")->assertNotFound();
    expect($ajena->fresh())->not->toBeNull();
});

test('borrar direcciones reasigna la principal y permite vaciar y volver a crear', function () {
    $user = User::factory()->create();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);
    $ids = [];
    foreach ([1, 2, 3] as $numero) {
        $ids[] = $this->postJson('/api/cliente/direcciones', [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24, 'direccion' => "Calle $numero #10-20", 'barrio' => 'Centro'])
            ->assertCreated()->assertJsonPath('direccion.es_principal', $numero === 1)->json('direccion.id');
    }
    $this->deleteJson("/api/cliente/direcciones/{$ids[2]}")->assertOk()->assertJsonCount(2, 'direcciones')
        ->assertJsonPath('direcciones.0.id', $ids[0]);
    $this->deleteJson("/api/cliente/direcciones/{$ids[0]}")->assertOk()
        ->assertJsonPath('direcciones.0.id', $ids[1])->assertJsonPath('direcciones.0.es_principal', true);
    expect($user->fresh()->direccion)->toBe('Calle 2 #10-20');
    $this->deleteJson("/api/cliente/direcciones/{$ids[1]}")->assertOk()->assertJsonCount(0, 'direcciones');
    expect($user->fresh()->direccion)->toBeNull();
    expect($user->fresh()->barrio)->toBeNull();
    $this->postJson('/api/cliente/direcciones', [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24, 'direccion' => 'Calle 4 #10-20', 'barrio' => 'Norte'])
        ->assertCreated()->assertJsonPath('direccion.es_principal', true);
    expect($user->fresh()->direccion)->toBe('Calle 4 #10-20');
});
