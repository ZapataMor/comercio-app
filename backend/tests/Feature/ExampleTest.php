<?php

use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

test('el sitio público se ve sin iniciar sesión', function () {
    $this->get('/')->assertOk()->assertSee('Descargar en Google Play');
    $this->get('/como-funciona')->assertOk()->assertSee('Domiciliarios');
    $this->get('/planes')->assertOk()->assertSee('Elegir plan mensual');
    $this->get('/cuenta/entrar')->assertRedirect('/login');
    $this->get('/login')->assertOk()->assertSee('Iniciar sesión')->assertSee('Código QR')->assertSee('WhatsApp')->assertSee('Google');
    $this->get('/')->assertSee('href="'.route('login').'"', false);
    $this->get('/preguntas-frecuentes')->assertOk()->assertSee('¿Vitrina cobra comisión por pedido?');
    $this->get('/contacto')->assertOk()->assertSee('Plazos de respuesta');
});

test('las páginas legales son públicas y están enlazadas en el pie', function () {
    $this->get('/terminos')->assertOk()->assertSee('no crea una relación laboral')->assertSee('Ley 1480 de 2011');
    $this->get('/condiciones-de-membresia')->assertOk()->assertSee('5 días hábiles')->assertSee('no es automática');
    $this->get('/aviso-de-privacidad')->assertOk()->assertSee('Decreto 1377 de 2013');
    $this->get('/cookies')->assertOk()->assertSee('XSRF-TOKEN');

    $pie = $this->get('/')->assertOk();
    foreach (['/terminos', '/condiciones-de-membresia', '/privacidad', '/aviso-de-privacidad', '/cookies', '/cancelaciones', '/eliminar-cuenta', '/contacto'] as $ruta) {
        $pie->assertSee(url($ruta), false);
    }
});

test('el documento del responsable aparece solo si está configurado', function () {
    config(['vitrina.documento' => '']);
    $this->get('/terminos')->assertOk()->assertDontSee('Identificación:');

    config(['vitrina.documento' => 'C.C. 1.234.567.890']);
    $this->get('/privacidad')->assertOk()->assertSee('C.C. 1.234.567.890');
    $this->get('/contacto')->assertOk()->assertSee('C.C. 1.234.567.890');
});

test('robots, sitemap y security.txt', function () {
    $this->get('/robots.txt')->assertOk()->assertSee('Disallow: /admin')->assertSee('Sitemap: '.url('/sitemap.xml'));
    $this->get('/sitemap.xml')->assertOk()->assertHeader('Content-Type', 'application/xml; charset=UTF-8')
        ->assertSee(url('/terminos'), false)->assertDontSee('/admin', false);
    $this->get('/.well-known/security.txt')->assertOk()
        ->assertSee('Contact: mailto:'.config('vitrina.correo_contacto'))->assertSee('Expires: ');
});

test('una página que no existe muestra el error con el diseño del sitio', function () {
    $this->get('/no-existe-esta-pagina')->assertNotFound()->assertSee('No encontramos esta página')->assertSee('Ir al inicio');
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

    $this->actingAs($cliente)->get('/admin')->assertForbidden();
    $this->get('/pruebas')->assertNotFound();
    $this->getJson('/pruebas/api/sesion')->assertNotFound();
    $this->postJson('/pruebas/api/pedidos', [])->assertNotFound();
    $this->postJson('/pruebas/api/negocios', [])->assertNotFound();
});

test('el registro publico ya no esta disponible aunque siga activa la variable antigua', function () {
    config(['vitrina.web_pruebas' => true]);
    $this->get('/login')->assertOk()->assertSee('Iniciar sesión')->assertSee('Código QR')->assertSee('Administrador de Vitrina con usuario y contraseña')->assertDontSee('Crear cuenta');
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
    // Cliente o domiciliario: con celular y clave de 4 números, para entrar a la app.
    $this->post('/admin/usuarios', ['name' => 'Cuenta Nueva', 'telefono' => '3109998877', 'pin' => '1234', 'rol' => 'domiciliario'])
        ->assertSessionHasErrors('pin');
    $this->post('/admin/usuarios', ['name' => 'Cuenta Nueva', 'telefono' => '3109998877', 'pin' => '2468', 'rol' => 'domiciliario'])
        ->assertRedirect();
    $nueva = User::where('telefono', '3109998877')->sole();
    expect($nueva->hasRole('domiciliario'))->toBeTrue()
        ->and($nueva->telefono_verificado_at)->not->toBeNull()
        ->and(\Illuminate\Support\Facades\Hash::check('2468', $nueva->pin))->toBeTrue();
    // Administrador: con usuario y contraseña, para este panel.
    $this->post('/admin/usuarios', ['username' => 'otro.admin', 'password' => 'password123', 'rol' => 'administrador'])
        ->assertRedirect();
    expect(User::where('username', 'otro.admin')->sole()->hasRole('administrador'))->toBeTrue();
});
