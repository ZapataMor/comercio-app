<?php

use App\Models\Pedido;
use App\Models\User;
use App\Notifications\PedidoDisponibleParaDomiciliario;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Tipos de cuenta: toda cuenta nueva es Cliente; el cliente puede tener
// negocios y hacerse domiciliario sin dejar de ser cliente.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
});

function cuentaDeTipo(string $tipo, array $datos = []): User
{
    $user = User::factory()->create($datos + ['telefono' => '3001234567']);
    $user->syncRoles(User::rolesDelTipo($tipo));

    return $user;
}

/** Pedido de $cliente listo para recoger en un negocio nuevo. */
function pedidoListoDe(User $cliente): Pedido
{
    $dueno = cuentaDeTipo('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);

    return $negocio->pedidos()->create([
        'user_id' => $cliente->id,
        'estado' => 'listo',
        'listo_at' => now(),
        'subtotal' => 3000,
        'total' => 3000,
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 5',
        'telefono_contacto' => '3001234567',
    ]);
}

test('una cuenta nueva se crea como cliente', function () {
    $this->postJson('/api/register', [
        'name' => 'Ana',
        'apellidos' => 'Pérez',
        'email' => 'ana@correo.com',
        'password' => 'secreta123',
        'password_confirmation' => 'secreta123',
        'direccion' => 'Calle 1 # 2-3',
        'barrio' => 'Centro',
        'telefono' => '3001234567',
        'acepta_terminos' => true,
    ])
        ->assertCreated()
        ->assertJsonPath('user.roles', ['usuario']);
});

test('un cliente se hace domiciliario y sigue siendo cliente', function () {
    $cliente = cuentaDeTipo('usuario');
    Sanctum::actingAs($cliente);

    $this->postJson('/api/perfil/domiciliario')
        ->assertOk()
        ->assertJsonPath('user.roles', ['usuario', 'domiciliario']);

    expect($cliente->fresh()->hasAllRoles(['usuario', 'domiciliario']))->toBeTrue();
    $this->getJson('/api/domiciliario/disponibles')->assertOk();
    $this->getJson('/api/cliente/direcciones')->assertOk();
});

test('hacerse domiciliario pide un teléfono', function () {
    $cliente = cuentaDeTipo('usuario', ['telefono' => null]);
    Sanctum::actingAs($cliente);

    $this->postJson('/api/perfil/domiciliario')->assertStatus(422);

    expect($cliente->fresh()->hasRole('domiciliario'))->toBeFalse();
});

test('un administrador no se hace domiciliario desde la app', function () {
    Sanctum::actingAs(cuentaDeTipo('administrador'));

    $this->postJson('/api/perfil/domiciliario')->assertForbidden();
});

test('el domiciliario deja de serlo y queda como cliente, fuera de turno', function () {
    $domiciliario = cuentaDeTipo('domiciliario', ['en_turno' => true]);
    Sanctum::actingAs($domiciliario);

    $this->deleteJson('/api/perfil/domiciliario')
        ->assertOk()
        ->assertJsonPath('user.roles', ['usuario'])
        ->assertJsonPath('user.en_turno', false);

    $this->getJson('/api/domiciliario/disponibles')->assertForbidden();
    $this->getJson('/api/cliente/direcciones')->assertOk();
});

test('no se deja de ser domiciliario con una entrega en curso', function () {
    $domiciliario = cuentaDeTipo('domiciliario');
    pedidoListoDe(cuentaDeTipo('usuario'))->update(['estado' => 'tomado', 'domiciliario_id' => $domiciliario->id]);
    Sanctum::actingAs($domiciliario);

    $this->deleteJson('/api/perfil/domiciliario')->assertStatus(409);

    expect($domiciliario->fresh()->hasRole('domiciliario'))->toBeTrue();
});

test('el domiciliario no ve, no toma ni recibe el aviso de su propio pedido', function () {
    $domiciliario = cuentaDeTipo('domiciliario', ['en_turno' => true]);
    $otro = cuentaDeTipo('domiciliario', ['en_turno' => true]);
    $pedido = pedidoListoDe($domiciliario);
    Sanctum::actingAs($domiciliario);

    expect($this->getJson('/api/domiciliario/disponibles')->json('pedidos'))->toBeEmpty();
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/tomar", ['minutos_recogida' => 5])->assertStatus(409);

    // Al marcarlo listo, el aviso le llega a los demás, no a él.
    $pedido->update(['estado' => 'aceptado']);
    Sanctum::actingAs($pedido->negocio->user);
    $this->putJson("/api/negocios/{$pedido->negocio_id}/pedidos/{$pedido->id}/listo")->assertOk();

    Notification::assertSentTo($otro, PedidoDisponibleParaDomiciliario::class);
    Notification::assertNotSentTo($domiciliario, PedidoDisponibleParaDomiciliario::class);
});

test('el admin ve al domiciliario solo en su pestaña y lo puede volver cliente', function () {
    Sanctum::actingAs(cuentaDeTipo('administrador'));
    $cliente = cuentaDeTipo('usuario');
    $domiciliario = cuentaDeTipo('domiciliario');

    $r = $this->getJson('/api/admin/usuarios?rol=usuario')->assertOk();
    expect(collect($r->json('usuarios'))->pluck('id')->all())->toBe([$cliente->id])
        ->and($r->json('conteos'))->toMatchArray(['usuario' => 1, 'domiciliario' => 1]);

    $this->getJson('/api/admin/usuarios?rol=domiciliario')
        ->assertJsonPath('usuarios.0.id', $domiciliario->id)
        ->assertJsonPath('usuarios.0.rol', 'domiciliario');

    $this->putJson("/api/admin/usuarios/{$domiciliario->id}/rol", ['rol' => 'usuario'])->assertOk();
    expect($domiciliario->fresh()->getRoleNames()->all())->toBe(['usuario']);

    $this->putJson("/api/admin/usuarios/{$cliente->id}/rol", ['rol' => 'domiciliario'])->assertOk();
    expect($cliente->fresh()->hasAllRoles(['usuario', 'domiciliario']))->toBeTrue();
});
