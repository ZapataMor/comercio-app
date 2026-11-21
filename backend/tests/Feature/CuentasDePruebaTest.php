<?php

use App\Models\Negocio;
use App\Models\User;
use App\Support\Telefono\EnviadorCodigos;
use App\Support\Telefono\EnviadorLog;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    $this->app->instance(EnviadorCodigos::class, new EnviadorLog);
});

test('borra a los clientes y deja a comerciantes y domiciliarios con celular y la misma clave', function () {
    $dueno = User::factory()->create(['email' => 'dueno@demo.co', 'password' => 'password123']);
    $dueno->assignRole('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $otroDueno = User::factory()->create();
    $otroDueno->assignRole('usuario');
    $otroDueno->negocio()->create(['nombre' => 'Otra', 'activo' => true]);
    $domi = User::factory()->create(['email' => 'domi@demo.co']);
    $domi->syncRoles(['usuario', 'domiciliario']);
    $admin = User::factory()->create(['email' => 'admin@demo.co', 'password' => 'clave-admin']);
    $admin->assignRole('administrador');
    $cliente = User::factory()->create();
    $cliente->assignRole('usuario');
    $pedido = $negocio->pedidos()->create([
        'user_id' => $cliente->id, 'domiciliario_id' => $domi->id, 'estado' => 'entregado', 'metodo_pago' => 'efectivo',
        'total' => 1000, 'direccion_entrega' => 'Calle 1 #2-3', 'telefono_contacto' => '3001112233',
    ]);
    $dueno->createToken('api');

    $this->artisan('vitrina:cuentas-de-prueba', ['--force' => true])->assertSuccessful();

    expect(User::find($cliente->id))->toBeNull()
        ->and(\App\Models\Pedido::find($pedido->id))->toBeNull()
        ->and(User::count())->toBe(4);

    $dueno->refresh();
    $otroDueno->refresh();
    $domi->refresh();
    expect([$dueno->telefono, $otroDueno->telefono, $domi->telefono])->toBe(['3000000000', '3000000001', '3000000002'])
        ->and($dueno->telefono_verificado_at)->not->toBeNull()
        ->and(Hash::check('1920', $dueno->pin))->toBeTrue()
        ->and(Hash::check('1920', $domi->pin))->toBeTrue()
        ->and($dueno->email)->toBeNull()
        ->and($dueno->password)->toBeNull()
        ->and($dueno->tokens()->count())->toBe(0)
        ->and($domi->hasRole('domiciliario'))->toBeTrue();

    // El administrador sigue igual, para el panel web.
    $admin->refresh();
    expect($admin->email)->toBe('admin@demo.co')->and(Hash::check('clave-admin', $admin->password))->toBeTrue();

    // Entran con el celular y la clave (en un teléfono nuevo, con el código).
    $codigo = $this->postJson('/api/login', ['telefono' => '3000000000', 'pin' => '1920'])
        ->assertOk()->assertJsonPath('requiere_codigo', true)->json('codigo_prueba');
    $this->postJson('/api/login/codigo', ['telefono' => '3000000000', 'pin' => '1920', 'codigo' => $codigo])
        ->assertOk()->assertJsonPath('user.id', $dueno->id);
});

test('sin --force pregunta antes de borrar', function () {
    $cliente = User::factory()->create();

    $this->artisan('vitrina:cuentas-de-prueba')
        ->expectsConfirmation('¿Seguir? Esto no se puede deshacer.', 'no')
        ->assertFailed();
    expect(User::find($cliente->id))->not->toBeNull();
});
