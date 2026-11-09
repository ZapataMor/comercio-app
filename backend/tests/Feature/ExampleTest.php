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

test('la antigua configuracion no permite entrar a clientes ni domiciliarios', function (string $rol) {
    config(['vitrina.web_pruebas' => true]);
    $usuario = User::factory()->create(['username' => 'cuenta', 'password' => 'password123']);
    $usuario->assignRole($rol);

    $this->post('/login', ['username' => 'cuenta', 'password' => 'password123', 'remember' => true])
        ->assertSessionHasErrors('username');
    $this->assertGuest();
})->with(['usuario', 'domiciliario']);

test('las sesiones existentes no conservan acceso a la web retirada', function () {
    config(['vitrina.web_pruebas' => true]);
    $cliente = User::factory()->create();
    $cliente->assignRole('usuario');

    $this->actingAs($cliente)->get('/')->assertRedirect('/admin');
    $this->get('/admin')->assertForbidden();
    $this->get('/pruebas')->assertNotFound();
    $this->getJson('/pruebas/api/sesion')->assertNotFound();
    $this->postJson('/pruebas/api/pedidos', [])->assertNotFound();
    $this->postJson('/pruebas/api/negocios', [])->assertNotFound();
});

test('el registro publico ya no esta disponible aunque siga activa la variable antigua', function () {
    config(['vitrina.web_pruebas' => true]);
    $this->get('/login')->assertOk()->assertSee('Panel del administrador')->assertDontSee('Crear cuenta');
    $this->get('/registro')->assertNotFound();
    $this->post('/registro', ['username' => 'nuevo', 'password' => 'password123', 'password_confirmation' => 'password123'])
        ->assertNotFound();
    $this->assertDatabaseMissing('users', ['username' => 'nuevo']);
});

test('el administrador entra por usuario y conserva su panel y gestion de cuentas', function () {
    $admin = User::factory()->create(['username' => 'admin', 'password' => 'password123']);
    $admin->assignRole('administrador');
    $this->post('/login', ['username' => 'admin', 'password' => 'password123'])->assertRedirect('/admin');
    $this->get('/admin')->assertOk()->assertDontSee('Probar app web')->assertDontSee('Abrir administración completa');
    $this->get('/admin/usuarios')->assertOk();
    $this->get('/admin/negocios')->assertOk();
    $this->post('/admin/usuarios', ['username' => 'cuenta.nueva', 'password' => 'password123', 'rol' => 'usuario'])
        ->assertRedirect();
    expect(User::where('username', 'cuenta.nueva')->sole()->hasRole('usuario'))->toBeTrue();
});
