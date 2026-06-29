<?php

use App\Models\DeviceToken;
use App\Models\Negocio;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\NuevoPedidoParaComercio;
use App\Notifications\PedidoDisponibleParaDomiciliario;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Antes de cada test: crear los 4 roles (la BD se reinicia en cada test).
beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

/** Crea un usuario con un rol dado. */
function usuarioCon(string $rol): User
{
    $user = User::factory()->create();
    $user->assignRole($rol);

    return $user;
}

/** Crea un negocio abierto con su comerciante dueño. */
function negocioAbierto(): Negocio
{
    return usuarioCon('comerciante')->negocio()->create([
        'nombre' => 'Negocio Test',
        'activo' => true,
    ]);
}

/** Crea un pedido en el estado pedido, para el negocio y cliente dados. */
function pedidoEnEstado(Negocio $negocio, User $cliente, string $estado, ?User $domiciliario = null): App\Models\Pedido
{
    return $negocio->pedidos()->create([
        'user_id' => $cliente->id,
        'domiciliario_id' => $domiciliario?->id,
        'estado' => $estado,
        'metodo_pago' => 'efectivo',
        'total' => 5000,
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
    ]);
}

// ===========================================================================
// Registro de tokens de dispositivo
// ===========================================================================

test('registrar un device token requiere autenticación', function () {
    $this->postJson('/api/device-tokens', ['token' => 'abc'])->assertStatus(401);
});

test('un usuario registra su device token', function () {
    $user = usuarioCon('usuario');
    Sanctum::actingAs($user);

    $this->postJson('/api/device-tokens', ['token' => 'token-fcm-123'])
        ->assertOk();

    $this->assertDatabaseHas('device_tokens', [
        'user_id' => $user->id,
        'token' => 'token-fcm-123',
        'plataforma' => 'android',
    ]);
});

test('registrar el mismo token dos veces no lo duplica', function () {
    $user = usuarioCon('usuario');
    Sanctum::actingAs($user);

    $this->postJson('/api/device-tokens', ['token' => 'token-repetido'])->assertOk();
    $this->postJson('/api/device-tokens', ['token' => 'token-repetido'])->assertOk();

    expect(DeviceToken::where('token', 'token-repetido')->count())->toBe(1);
});

test('un token existente se reasigna al usuario que vuelve a iniciar sesión', function () {
    // El aparato lo usó antes el usuario A.
    $a = usuarioCon('usuario');
    $a->deviceTokens()->create(['token' => 'aparato-compartido']);

    // Ahora inicia sesión el usuario B en el mismo aparato.
    $b = usuarioCon('usuario');
    Sanctum::actingAs($b);
    $this->postJson('/api/device-tokens', ['token' => 'aparato-compartido'])->assertOk();

    // El token queda apuntando a B, y sigue habiendo uno solo.
    expect(DeviceToken::where('token', 'aparato-compartido')->count())->toBe(1);
    $this->assertDatabaseHas('device_tokens', [
        'token' => 'aparato-compartido',
        'user_id' => $b->id,
    ]);
});

test('dar de baja un token lo elimina', function () {
    $user = usuarioCon('usuario');
    $user->deviceTokens()->create(['token' => 'a-borrar']);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/device-tokens', ['token' => 'a-borrar'])->assertOk();

    $this->assertDatabaseMissing('device_tokens', ['token' => 'a-borrar']);
});

test('un usuario no puede dar de baja el token de otro', function () {
    $otro = usuarioCon('usuario');
    $otro->deviceTokens()->create(['token' => 'ajeno']);

    Sanctum::actingAs(usuarioCon('usuario'));
    $this->deleteJson('/api/device-tokens', ['token' => 'ajeno'])->assertOk();

    // El token del otro sigue intacto.
    $this->assertDatabaseHas('device_tokens', ['token' => 'ajeno', 'user_id' => $otro->id]);
});

test('las notificaciones fcm usan canal android de alta prioridad', function () {
    $negocio = negocioAbierto();
    $cliente = usuarioCon('usuario');
    $pedido = pedidoEnEstado($negocio, $cliente, 'en_camino');

    $mensajes = [
        (new NuevoPedidoParaComercio($pedido))->toFcm($negocio->user)->toArray(),
        (new PedidoDisponibleParaDomiciliario($pedido))->toFcm(usuarioCon('domiciliario'))->toArray(),
        (new EstadoPedidoActualizado($pedido))->toFcm($cliente)->toArray(),
    ];

    foreach ($mensajes as $mensaje) {
        expect($mensaje['android']['priority'])->toBe('high')
            ->and($mensaje['android']['notification']['channel_id'])->toBe('pedidos')
            ->and($mensaje['android']['notification']['notification_priority'])->toBe('PRIORITY_HIGH')
            ->and($mensaje['android']['notification']['default_sound'])->toBeTrue()
            ->and($mensaje['android']['notification']['default_vibrate_timings'])->toBeTrue();
    }
});

// ===========================================================================
// Disparo de notificaciones en el flujo de pedidos
// ===========================================================================

test('crear un pedido notifica al comercio', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $producto = $negocio->productos()->create([
        'nombre' => 'Empanada', 'precio' => 2500, 'disponible' => true,
    ]);

    $cliente = usuarioCon('usuario');
    Sanctum::actingAs($cliente);

    $this->postJson('/api/pedidos', [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 2]],
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
    ])->assertStatus(201);

    Notification::assertSentTo($negocio->user, NuevoPedidoParaComercio::class);
});

test('crear un pedido desde la web notifica al comercio', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $producto = $negocio->productos()->create([
        'nombre' => 'Arroz', 'precio' => 3000, 'disponible' => true,
    ]);

    $cliente = usuarioCon('usuario');
    $cliente->carritoItems()->create([
        'producto_id' => $producto->id,
        'cantidad' => 1,
    ]);

    $this->actingAs($cliente)
        ->post('/carrito/confirmar', [
            'metodo_pago' => 'efectivo',
            'direccion_entrega' => 'Calle 20',
            'telefono_contacto' => '3156126318',
        ])
        ->assertRedirect();

    Notification::assertSentTo($negocio->user, NuevoPedidoParaComercio::class);
});

test('marcar un pedido listo notifica a los domiciliarios y al cliente', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $cliente = usuarioCon('usuario');
    $domiciliario = usuarioCon('domiciliario');
    $pedido = pedidoEnEstado($negocio, $cliente, 'pendiente');

    Sanctum::actingAs($negocio->user);
    $this->putJson("/api/comerciante/pedidos/{$pedido->id}/listo")->assertOk();

    Notification::assertSentTo($domiciliario, PedidoDisponibleParaDomiciliario::class);
    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class);
});

test('marcar un pedido listo desde la web notifica a los domiciliarios y al cliente', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $cliente = usuarioCon('usuario');
    $domiciliario = usuarioCon('domiciliario');
    $pedido = pedidoEnEstado($negocio, $cliente, 'pendiente');

    $this->actingAs($negocio->user)
        ->put("/panel/pedidos/{$pedido->id}/listo")
        ->assertRedirect();

    Notification::assertSentTo($domiciliario, PedidoDisponibleParaDomiciliario::class);
    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class);
});

test('tomar un pedido notifica al cliente', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $cliente = usuarioCon('usuario');
    $domiciliario = usuarioCon('domiciliario');
    $pedido = pedidoEnEstado($negocio, $cliente, 'listo');

    Sanctum::actingAs($domiciliario);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/tomar", ['minutos_recogida' => 15])
        ->assertOk();

    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class);
});

test('tomar un pedido desde la web notifica al cliente', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $cliente = usuarioCon('usuario');
    $domiciliario = usuarioCon('domiciliario');
    $pedido = pedidoEnEstado($negocio, $cliente, 'listo');

    $this->actingAs($domiciliario)
        ->put("/domiciliario/pedidos/{$pedido->id}/tomar", ['minutos_recogida' => 15])
        ->assertRedirect();

    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class);
});

test('avanzar el pedido a entregado notifica al cliente', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $cliente = usuarioCon('usuario');
    $domiciliario = usuarioCon('domiciliario');
    // Pedido ya en camino, tomado por este domiciliario.
    $pedido = pedidoEnEstado($negocio, $cliente, 'en_camino', $domiciliario);

    Sanctum::actingAs($domiciliario);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/entregado")->assertOk();

    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class,
        fn (EstadoPedidoActualizado $n) => $n->pedido->estado === 'entregado');
});

test('avanzar el pedido a entregado desde la web notifica al cliente', function () {
    Notification::fake();

    $negocio = negocioAbierto();
    $cliente = usuarioCon('usuario');
    $domiciliario = usuarioCon('domiciliario');
    $pedido = pedidoEnEstado($negocio, $cliente, 'en_camino', $domiciliario);

    $this->actingAs($domiciliario)
        ->put("/domiciliario/pedidos/{$pedido->id}/entregado")
        ->assertRedirect();

    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class,
        fn (EstadoPedidoActualizado $n) => $n->pedido->estado === 'entregado');
});
