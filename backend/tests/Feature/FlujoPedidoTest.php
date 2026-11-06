<?php

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\NuevoPedidoParaComercio;
use App\Notifications\PedidoCancelado;
use App\Notifications\PedidoDisponibleParaDomiciliario;
use App\Notifications\PedidoYaAtendido;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Flujo del pedido: el negocio acepta (o vence a los 5 minutos), puede cancelar
// con consecuencias, el domiciliario puede soltarlo antes de recogerlo y la
// recogida y la entrega se confirman con código.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
});

function flujoUsuario(string $rol = 'usuario', array $datos = []): User
{
    $user = User::factory()->create($datos);
    $user->assignRole($rol);

    return $user;
}

function flujoNegocio(): Negocio
{
    return flujoUsuario()->negocio()->create(['nombre' => 'Tienda', 'activo' => true, 'tiempo_preparacion' => 20]);
}

function flujoPedido(Negocio $negocio, string $estado = 'pendiente', array $extra = []): Pedido
{
    return $negocio->pedidos()->create(array_merge([
        'user_id' => flujoUsuario()->id,
        'estado' => $estado,
        'metodo_pago' => 'efectivo',
        'subtotal' => 10000,
        'costo_domicilio' => 4000,
        'total' => 14000,
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
        'minutos_preparacion' => 20,
        'codigo_entrega' => '1234',
    ], $extra));
}

function flujoRutaPedido(Pedido $pedido, string $accion): string
{
    return "/api/negocios/{$pedido->negocio_id}/pedidos/{$pedido->id}/{$accion}";
}

// ---------------------------------------------------------------------------
// Si el negocio no responde en 5 minutos, el pedido se cancela solo
// ---------------------------------------------------------------------------

test('un pedido sin respuesta se cancela a los 5 minutos y se le avisa al cliente y al equipo', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio);

    $this->travel(4)->minutes();
    $this->artisan('pedidos:vencer')->assertSuccessful();
    expect($pedido->fresh()->estado)->toBe('pendiente');

    $this->travel(61)->seconds();
    $this->artisan('pedidos:vencer')->assertSuccessful();

    expect($pedido->fresh())
        ->estado->toBe('cancelado')
        ->cancelado_por->toBe('sistema');

    $avisoCliente = null;
    Notification::assertSentTo($pedido->cliente, PedidoCancelado::class, function (PedidoCancelado $n) use (&$avisoCliente, $pedido) {
        $avisoCliente = $n->toFcm($pedido->cliente)->notification;

        return true;
    });
    expect($avisoCliente->title)->toBe('Tu pedido no fue recibido')
        ->and($avisoCliente->body)->toContain('Tienda no recibió tu pedido');

    Notification::assertSentTo($negocio->user, PedidoCancelado::class);
});

test('vencer un pedido todavía no le baja la confiabilidad al negocio', function () {
    $negocio = flujoNegocio();
    flujoPedido($negocio);

    $this->travel(6)->minutes();
    $this->artisan('pedidos:vencer')->assertSuccessful();

    expect(ReputacionEvento::count())->toBe(0);
});

test('un pedido aceptado no vence', function () {
    $pedido = flujoPedido(flujoNegocio(), 'aceptado', ['aceptado_at' => now()]);

    $this->travel(30)->minutes();
    $this->artisan('pedidos:vencer')->assertSuccessful();

    expect($pedido->fresh()->estado)->toBe('aceptado');
});

test('un pedido vencido ya no se puede aceptar', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio);

    $this->travel(6)->minutes();
    $this->artisan('pedidos:vencer')->assertSuccessful();

    Sanctum::actingAs($negocio->user);
    $this->putJson(flujoRutaPedido($pedido, 'aceptar'))->assertStatus(409);
});

// ---------------------------------------------------------------------------
// Aceptar el pedido
// ---------------------------------------------------------------------------

test('aceptar deja el pedido en preparación, avisa al cliente y calla la alarma del equipo', function () {
    $negocio = flujoNegocio();
    $trabajador = flujoUsuario();
    $negocio->miembros()->attach($trabajador->id, ['rol' => Negocio::ROL_TRABAJADOR, 'activo' => true]);
    $pedido = flujoPedido($negocio);

    Sanctum::actingAs($trabajador);
    $this->putJson(flujoRutaPedido($pedido, 'aceptar'))->assertOk();

    expect($pedido->fresh())
        ->estado->toBe('aceptado')
        ->estadoLabel()->toBe('En preparación')
        ->aceptado_at->not->toBeNull();

    Notification::assertSentTo($pedido->cliente, EstadoPedidoActualizado::class);
    Notification::assertSentTo($negocio->user, PedidoYaAtendido::class);
    Notification::assertSentTo($trabajador, PedidoYaAtendido::class);
});

test('dos personas no pueden aceptar el mismo pedido y un extraño no puede aceptarlo', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio);

    Sanctum::actingAs(flujoUsuario());
    $this->putJson(flujoRutaPedido($pedido, 'aceptar'))->assertForbidden();

    Sanctum::actingAs($negocio->user);
    $this->putJson(flujoRutaPedido($pedido, 'aceptar'))->assertOk();
    $this->putJson(flujoRutaPedido($pedido, 'aceptar'))->assertStatus(409);
});

test('un pedido sin aceptar no se puede marcar listo', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio);

    Sanctum::actingAs($negocio->user);
    $this->putJson(flujoRutaPedido($pedido, 'listo'))->assertStatus(409);

    expect($pedido->fresh()->estado)->toBe('pendiente');
});

test('el tiempo de preparación se cuenta desde que el negocio acepta', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio);

    // Tardó 4 minutos en aceptar y 20 en prepararlo: cumplió lo prometido.
    $this->travel(4)->minutes();
    Sanctum::actingAs($negocio->user);
    $this->putJson(flujoRutaPedido($pedido, 'aceptar'))->assertOk();
    $this->travel(20)->minutes();
    $this->putJson(flujoRutaPedido($pedido, 'listo'))->assertOk();

    expect(ReputacionEvento::pluck('motivo')->all())->toBe(['preparacion_a_tiempo']);
});

test('por-aceptar lista lo que espera en todos mis negocios, con lo que le queda', function () {
    $negocio = flujoNegocio();
    $otroNegocio = $negocio->user->negocio()->create(['nombre' => 'Sucursal', 'activo' => true]);
    $ajeno = flujoNegocio();

    $primero = flujoPedido($negocio);
    $segundo = flujoPedido($otroNegocio);
    flujoPedido($negocio, 'aceptado');
    flujoPedido($ajeno);

    $this->travel(1)->minutes();

    Sanctum::actingAs($negocio->user);
    $pedidos = $this->getJson('/api/negocios/mios/por-aceptar')->assertOk()->json('pedidos');

    expect(collect($pedidos)->pluck('id')->sort()->values()->all())->toBe([$primero->id, $segundo->id])
        ->and($pedidos[0]['segundos'])->toBeGreaterThan(230)->toBeLessThanOrEqual(240);
});

test('el aviso de pedido nuevo es un mensaje de datos para que la app haga sonar la alarma', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio);

    $mensaje = (new NuevoPedidoParaComercio($pedido))->toFcm($negocio->user);

    expect($mensaje->notification)->toBeNull()
        ->and($mensaje->custom['android']['priority'])->toBe('high')
        ->and($mensaje->data)->toMatchArray(['tipo' => 'nuevo_pedido', 'pedido_id' => (string) $pedido->id])
        ->and((int) $mensaje->data['segundos'])->toBeGreaterThan(290)->toBeLessThanOrEqual(300);
});

// ---------------------------------------------------------------------------
// Cancelar después de aceptar
// ---------------------------------------------------------------------------

test('cancelar en los primeros 5 minutos después de aceptar no tiene consecuencias', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio, 'aceptado', ['aceptado_at' => now()]);

    $this->travel(4)->minutes();
    Sanctum::actingAs($negocio->user);

    $this->getJson(flujoRutaPedido($pedido, ''))->assertJsonPath('cancelar_penaliza', false);
    $this->putJson(flujoRutaPedido($pedido, 'cancelar'), ['motivo' => 'Se agotó un producto'])->assertOk();

    expect($pedido->fresh()->estado)->toBe('cancelado')
        ->and(ReputacionEvento::count())->toBe(0);
    Notification::assertSentTo($pedido->cliente, PedidoCancelado::class);
});

test('cancelar después de 5 minutos de aceptado le baja la confiabilidad al negocio', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio, 'aceptado', ['aceptado_at' => now()]);

    $this->travel(6)->minutes();
    Sanctum::actingAs($negocio->user);

    $this->getJson(flujoRutaPedido($pedido, ''))->assertJsonPath('cancelar_penaliza', true);
    $this->putJson(flujoRutaPedido($pedido, 'cancelar'))->assertOk();

    expect(ReputacionEvento::where('tipo', 'negocio')->pluck('motivo')->all())->toBe(['cancelo_tras_aceptar'])
        ->and($negocio->fresh()->reputacion)->toBe(72);
});

test('rechazar sin aceptar o cancelar un pedido listo que nadie toma no tiene consecuencias', function () {
    $negocio = flujoNegocio();
    $sinAceptar = flujoPedido($negocio);
    $listo = flujoPedido($negocio, 'listo', ['aceptado_at' => now()]);

    $this->travel(4)->minutes();
    Sanctum::actingAs($negocio->user);
    $this->putJson(flujoRutaPedido($sinAceptar, 'cancelar'))->assertOk();

    $this->travel(20)->minutes();
    $this->putJson(flujoRutaPedido($listo, 'cancelar'))->assertOk();

    expect(ReputacionEvento::count())->toBe(0);
    Notification::assertSentTo($negocio->user, PedidoYaAtendido::class);
});

test('el cliente puede cancelar mientras se prepara, pero no cuando ya está listo', function () {
    $negocio = flujoNegocio();
    $preparando = flujoPedido($negocio, 'aceptado', ['aceptado_at' => now()]);
    $listo = flujoPedido($negocio, 'listo');

    Sanctum::actingAs($preparando->cliente);
    $this->getJson("/api/pedidos/{$preparando->id}")->assertJsonPath('puede_cancelar', true);
    $this->postJson("/api/pedidos/{$preparando->id}/cancelar")->assertOk();

    Sanctum::actingAs($listo->cliente);
    $this->postJson("/api/pedidos/{$listo->id}/cancelar")->assertStatus(409);

    expect(ReputacionEvento::count())->toBe(0);
});

// ---------------------------------------------------------------------------
// Soltar un pedido antes de recogerlo
// ---------------------------------------------------------------------------

test('el domiciliario puede soltar un pedido tomado y vuelve a estar disponible', function () {
    $negocio = flujoNegocio();
    $yo = flujoUsuario('domiciliario', ['en_turno' => true]);
    $otro = flujoUsuario('domiciliario', ['en_turno' => true]);
    $pedido = flujoPedido($negocio, 'listo');

    Sanctum::actingAs($yo);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/tomar", ['minutos_recogida' => 10])->assertOk();
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/soltar")->assertOk();

    expect($pedido->fresh())
        ->estado->toBe('listo')
        ->domiciliario_id->toBeNull()
        ->minutos_recogida->toBeNull()
        ->tomado_at->toBeNull()
        ->codigo_recogida->toBeNull();

    Notification::assertSentTo($otro, PedidoDisponibleParaDomiciliario::class);
    Notification::assertNotSentTo($yo, PedidoDisponibleParaDomiciliario::class);
    Notification::assertSentTo($pedido->cliente, EstadoPedidoActualizado::class,
        fn (EstadoPedidoActualizado $n) => $n->texto !== null);

    // Otro lo puede tomar y recibe un código nuevo.
    Sanctum::actingAs($otro);
    $this->getJson('/api/domiciliario/disponibles')->assertJsonPath('pedidos.0.id', $pedido->id);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/tomar", ['minutos_recogida' => 5])->assertOk();
    expect($pedido->fresh()->codigo_recogida)->toMatch('/^\d{4}$/');
});

test('después de recogido no se puede soltar, ni se puede soltar el pedido de otro', function () {
    $negocio = flujoNegocio();
    $yo = flujoUsuario('domiciliario');
    $recogido = flujoPedido($negocio, 'recogido', ['domiciliario_id' => $yo->id]);
    $deOtro = flujoPedido($negocio, 'tomado', ['domiciliario_id' => flujoUsuario('domiciliario')->id]);

    Sanctum::actingAs($yo);
    $this->putJson("/api/domiciliario/pedidos/{$recogido->id}/soltar")->assertStatus(409);
    $this->putJson("/api/domiciliario/pedidos/{$deOtro->id}/soltar")->assertStatus(409);

    expect($recogido->fresh()->domiciliario_id)->toBe($yo->id);
});

// ---------------------------------------------------------------------------
// Códigos de recogida y entrega
// ---------------------------------------------------------------------------

test('el domiciliario ve su código de recogida al tomar el pedido, y nadie más', function () {
    $negocio = flujoNegocio();
    $domi = flujoUsuario('domiciliario');
    $pedido = flujoPedido($negocio, 'listo');

    Sanctum::actingAs($domi);
    $this->getJson('/api/domiciliario/disponibles')->assertJsonPath('pedidos.0.codigo_recogida', null);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/tomar", ['minutos_recogida' => 10])->assertOk();

    $codigo = $this->getJson('/api/domiciliario/entregas')->json('pedidos.0.codigo_recogida');
    expect($codigo)->toMatch('/^\d{4}$/')->toBe($pedido->fresh()->codigo_recogida);

    Sanctum::actingAs($negocio->user);
    $this->getJson(flujoRutaPedido($pedido, ''))
        ->assertJsonMissingPath('codigo_recogida')
        ->assertJsonMissingPath('codigo_entrega');

    Sanctum::actingAs($pedido->cliente);
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonMissingPath('codigo_recogida');
});

test('el negocio confirma la recogida con el código del domiciliario', function () {
    $negocio = flujoNegocio();
    $domi = flujoUsuario('domiciliario');
    $pedido = flujoPedido($negocio, 'tomado', [
        'domiciliario_id' => $domi->id, 'codigo_recogida' => '4821', 'tomado_at' => now(), 'minutos_recogida' => 10,
    ]);

    Sanctum::actingAs($negocio->user);
    $this->putJson(flujoRutaPedido($pedido, 'recogido'))->assertJsonValidationErrors('codigo');
    $this->putJson(flujoRutaPedido($pedido, 'recogido'), ['codigo' => '0000'])->assertJsonValidationErrors('codigo');
    expect($pedido->fresh()->estado)->toBe('tomado');

    $this->putJson(flujoRutaPedido($pedido, 'recogido'), ['codigo' => '4821'])->assertOk();

    expect($pedido->fresh())
        ->estado->toBe('recogido')
        ->recogido_at->not->toBeNull();
    Notification::assertSentTo($pedido->cliente, EstadoPedidoActualizado::class);
});

test('el domiciliario ya no puede marcarse recogido por su cuenta', function () {
    $domi = flujoUsuario('domiciliario');
    $pedido = flujoPedido(flujoNegocio(), 'tomado', ['domiciliario_id' => $domi->id, 'codigo_recogida' => '4821']);

    Sanctum::actingAs($domi);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/recogido", ['codigo' => '4821'])->assertNotFound();

    expect($pedido->fresh()->estado)->toBe('tomado');
});

test('el código de un pedido no sirve en otro negocio', function () {
    $negocio = flujoNegocio();
    $pedido = flujoPedido($negocio, 'tomado', [
        'domiciliario_id' => flujoUsuario('domiciliario')->id, 'codigo_recogida' => '4821',
    ]);

    Sanctum::actingAs(flujoNegocio()->user);
    $this->putJson(flujoRutaPedido($pedido, 'recogido'), ['codigo' => '4821'])->assertForbidden();
});

test('el cliente ve su código de entrega solo mientras le llevan el pedido', function () {
    $pedido = flujoPedido(flujoNegocio(), 'aceptado');
    Sanctum::actingAs($pedido->cliente);

    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('codigo_entrega', null);

    $pedido->update(['estado' => 'en_camino']);
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('codigo_entrega', '1234');

    $pedido->update(['estado' => 'entregado']);
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('codigo_entrega', null);
});

test('el pedido se crea con su código de entrega y el domiciliario no puede verlo', function () {
    $negocio = flujoNegocio();
    $producto = $negocio->productos()->create([
        'nombre' => 'Arepa', 'precio' => 3000, 'tipo_venta' => 'cantidad', 'unidad_medida' => 'unidad', 'disponible' => true,
    ]);

    Sanctum::actingAs(flujoUsuario());
    $id = $this->postJson('/api/pedidos', [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 1]],
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 1',
        'telefono_contacto' => '3000000000',
    ])->assertCreated()->json('id');

    $pedido = Pedido::find($id);
    expect($pedido->codigo_entrega)->toMatch('/^\d{4}$/');

    $domi = flujoUsuario('domiciliario');
    $pedido->update(['estado' => 'en_camino', 'domiciliario_id' => $domi->id]);

    Sanctum::actingAs($domi);
    $this->getJson('/api/domiciliario/entregas')->assertJsonMissingPath('pedidos.0.codigo_entrega');
});

test('la entrega se confirma con el código del cliente y queda la hora exacta', function () {
    $domi = flujoUsuario('domiciliario');
    $pedido = flujoPedido(flujoNegocio(), 'en_camino', ['domiciliario_id' => $domi->id]);

    Sanctum::actingAs($domi);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/entregado")->assertJsonValidationErrors('codigo');
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/entregado", ['codigo' => '9999'])->assertJsonValidationErrors('codigo');
    expect($pedido->fresh()->estado)->toBe('en_camino');

    $this->travel(3)->minutes();
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/entregado", ['codigo' => '1234'])->assertOk();

    expect($pedido->fresh())
        ->estado->toBe('entregado')
        ->entregado_at->toDateTimeString()->toBe(now()->toDateTimeString());
});

test('el aviso de en camino le recuerda al cliente su código de entrega', function () {
    $pedido = flujoPedido(flujoNegocio(), 'en_camino');

    $aviso = (new EstadoPedidoActualizado($pedido))->toFcm($pedido->cliente)->notification;

    expect($aviso->body)->toContain('1234');
});

test('los intentos con un código están limitados', function () {
    $domi = flujoUsuario('domiciliario');
    $pedido = flujoPedido(flujoNegocio(), 'en_camino', ['domiciliario_id' => $domi->id]);

    Sanctum::actingAs($domi);
    foreach (range(1, 6) as $intento) {
        $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/entregado", ['codigo' => '0000'])->assertStatus(422);
    }

    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/entregado", ['codigo' => '1234'])
        ->assertStatus(429)
        ->assertJsonPath('message', 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.');
});
