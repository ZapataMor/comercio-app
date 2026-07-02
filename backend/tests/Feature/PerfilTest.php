<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Antes de cada test: crear los 4 roles (la BD se reinicia en cada test).
beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

/** Crea un usuario autenticado con un rol dado. */
function usuarioPerfil(string $rol = 'usuario'): User
{
    $user = User::factory()->create(['password' => 'clave-original']);
    $user->assignRole($rol);
    Sanctum::actingAs($user);

    return $user;
}

test('sin token no se puede actualizar el perfil', function () {
    $this->putJson('/api/perfil', ['name' => 'X', 'email' => 'x@x.com'])
        ->assertStatus(401);
});

test('un usuario actualiza su nombre y email', function () {
    $user = usuarioPerfil();

    $this->putJson('/api/perfil', ['name' => 'Nuevo Nombre', 'email' => 'nuevo@correo.com'])
        ->assertOk()
        ->assertJsonPath('user.name', 'Nuevo Nombre')
        ->assertJsonPath('user.email', 'nuevo@correo.com');

    $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => 'nuevo@correo.com']);
});

test('el perfil conserva los roles del usuario', function () {
    usuarioPerfil('comerciante');

    $this->putJson('/api/perfil', ['name' => 'Comerciante', 'email' => 'c@c.com'])
        ->assertOk()
        ->assertJsonPath('user.roles.0', 'comerciante');
});

test('no se puede usar el email de otro usuario', function () {
    User::factory()->create(['email' => 'ocupado@correo.com']);
    usuarioPerfil();

    $this->putJson('/api/perfil', ['name' => 'Yo', 'email' => 'ocupado@correo.com'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('email');
});

test('puede mantener su propio email sin error de unicidad', function () {
    $user = usuarioPerfil();

    $this->putJson('/api/perfil', ['name' => 'Solo Nombre', 'email' => $user->email])
        ->assertOk()
        ->assertJsonPath('user.name', 'Solo Nombre');
});

test('cambia la contraseña con la contraseña actual correcta', function () {
    $user = usuarioPerfil();

    $this->putJson('/api/perfil', [
        'name' => $user->name,
        'email' => $user->email,
        'password' => 'clave-nueva-123',
        'password_confirmation' => 'clave-nueva-123',
        'password_actual' => 'clave-original',
    ])->assertOk();

    expect(Hash::check('clave-nueva-123', $user->fresh()->password))->toBeTrue();
});

test('rechaza el cambio de contraseña si la actual es incorrecta', function () {
    $user = usuarioPerfil();

    $this->putJson('/api/perfil', [
        'name' => $user->name,
        'email' => $user->email,
        'password' => 'clave-nueva-123',
        'password_confirmation' => 'clave-nueva-123',
        'password_actual' => 'no-es-esta',
    ])->assertStatus(422)
        ->assertJsonValidationErrors('password_actual');

    expect(Hash::check('clave-original', $user->fresh()->password))->toBeTrue();
});

test('rechaza contraseña nueva sin confirmación', function () {
    $user = usuarioPerfil();

    $this->putJson('/api/perfil', [
        'name' => $user->name,
        'email' => $user->email,
        'password' => 'clave-nueva-123',
        'password_actual' => 'clave-original',
    ])->assertStatus(422)
        ->assertJsonValidationErrors('password');
});
