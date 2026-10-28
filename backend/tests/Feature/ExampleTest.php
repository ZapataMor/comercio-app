<?php

use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

test('la raíz redirige a quien no ha iniciado sesión', function () {
    // '/' manda al panel del admin; sin sesión, ese flujo termina en /login.
    $this->get('/')->assertRedirect();
});

test('la web solo deja entrar a administradores', function () {
    $cliente = User::factory()->create(['password' => 'password123']);
    $cliente->assignRole('usuario');

    $this->post('/login', ['email' => $cliente->email, 'password' => 'password123'])
        ->assertSessionHasErrors('email');
    $this->assertGuest();

    $admin = User::factory()->create(['password' => 'password123']);
    $admin->assignRole('administrador');

    $this->post('/login', ['email' => $admin->email, 'password' => 'password123'])
        ->assertRedirect(route('admin.panel'));
    $this->assertAuthenticatedAs($admin);
});

test('la web de clientes ya no existe', function () {
    $this->get('/explorar')->assertNotFound();
    $this->get('/panel')->assertNotFound();
});
