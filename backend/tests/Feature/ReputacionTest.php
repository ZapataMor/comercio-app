<?php

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Models\User;
use App\Support\Reputacion;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

function repUsuario(string $rol = 'usuario'): User
{
    $user = User::factory()->create();
    $user->assignRole($rol);

    return $user;
}

function repNegocio(int $tiempo = 20): Negocio
{
    return repUsuario()->negocio()->create([
        'nombre' => 'La Espiga',
        'activo' => true,
        'tiempo_preparacion' => $tiempo,
    ]);
}

/** Pedido en el estado dado, con todo lo que tendría a esa altura del flujo. */
function repPedido(Negocio $negocio, User $cliente, string $estado = 'entregado', ?User $domiciliario = null, array $extra = []): Pedido
{
    return $negocio->pedidos()->create(array_merge([
        'user_id' => $cliente->id,
        'domiciliario_id' => $domiciliario?->id,
        'estado' => $estado,
        'metodo_pago' => 'efectivo',
        'total' => 12000,
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
        'minutos_preparacion' => $negocio->tiempo_preparacion,
        'recogido_at' => in_array($estado, ['recogido', 'en_camino', 'entregado'], true) ? now() : null,
        'entregado_at' => $estado === 'entregado' ? now() : null,
    ], $extra));
}

function puntaje(Negocio|User $sujeto): int
{
    $sujeto->refresh();

    return $sujeto instanceof Negocio ? $sujeto->reputacion : $sujeto->reputacion_domiciliario;
}

// ===========================================================================
// Calificación del cliente al terminar el pedido
// ===========================================================================

test('si el cliente queda conforme, suben el negocio y el domiciliario', function () {
    $cliente = repUsuario();
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $pedido = repPedido($negocio, $cliente, 'entregado', $domi);
    Sanctum::actingAs($cliente);

    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertOk()
        ->assertJsonPath('puede_calificar', true)
        ->assertJsonPath('opciones_problemas.domiciliario.1.clave', 'no_llego');

    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
        'negocio_ok' => true,
        'domiciliario_ok' => true,
    ])->assertCreated();

    expect(puntaje($negocio))->toBe(82)
        ->and(puntaje($domi))->toBe(82);

    // Una sola vez por pedido.
    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
        'negocio_ok' => true,
        'domiciliario_ok' => true,
    ])->assertStatus(409);

    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertJsonPath('puede_calificar', false)
        ->assertJsonPath('calificacion.negocio_ok', true);
});

test('los problemas que reporta el cliente bajan a quien corresponde', function () {
    $cliente = repUsuario();
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $pedido = repPedido($negocio, $cliente, 'entregado', $domi);
    Sanctum::actingAs($cliente);

    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
        'negocio_ok' => false,
        'negocio_problemas' => ['producto_equivocado', 'pedido_incompleto'],
        'domiciliario_ok' => false,
        'domiciliario_problemas' => ['llego_tarde'],
        'comentario' => 'Pedí pan y llegó arepa, y tarde.',
    ])->assertCreated();

    expect(puntaje($negocio))->toBe(64) // 80 - 8 - 8
        ->and(puntaje($domi))->toBe(75); // 80 - 5

    $this->assertDatabaseHas('reputacion_eventos', [
        'tipo' => 'negocio',
        'sujeto_id' => $negocio->id,
        'motivo' => 'producto_equivocado',
        'origen' => 'cliente',
        'comentario' => 'Pedí pan y llegó arepa, y tarde.',
    ]);
});

test('si dice que algo falló, tiene que decir qué', function () {
    $cliente = repUsuario();
    $pedido = repPedido(repNegocio(), $cliente, 'entregado', repUsuario('domiciliario'));
    Sanctum::actingAs($cliente);

    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
        'negocio_ok' => false,
        'domiciliario_ok' => true,
    ])->assertStatus(422)->assertJsonValidationErrors('negocio_problemas');

    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
        'negocio_ok' => true,
        'domiciliario_ok' => false,
        'domiciliario_problemas' => ['se_comio_las_papas'],
    ])->assertStatus(422)->assertJsonValidationErrors('domiciliario_problemas.0');
});

test('solo se califica un pedido propio, entregado y reciente', function () {
    $cliente = repUsuario();
    $negocio = repNegocio();
    $enCamino = repPedido($negocio, $cliente, 'en_camino', repUsuario('domiciliario'));
    $ajeno = repPedido($negocio, repUsuario(), 'entregado');
    $viejo = repPedido($negocio, $cliente, 'entregado', null, ['entregado_at' => now()->subDays(5)]);
    Sanctum::actingAs($cliente);

    $this->postJson("/api/pedidos/{$enCamino->id}/calificacion", ['negocio_ok' => true, 'domiciliario_ok' => true])
        ->assertStatus(409);
    $this->postJson("/api/pedidos/{$ajeno->id}/calificacion", ['negocio_ok' => true])
        ->assertStatus(404);
    $this->postJson("/api/pedidos/{$viejo->id}/calificacion", ['negocio_ok' => true])
        ->assertStatus(409);
});

test('una demora justificada con una novedad queda anotada pero no resta', function () {
    $cliente = repUsuario();
    $domi = repUsuario('domiciliario');
    $pedido = repPedido(repNegocio(), $cliente, 'entregado', $domi, ['novedad' => 'Aguacero fuerte']);
    Sanctum::actingAs($cliente);

    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
        'negocio_ok' => true,
        'domiciliario_ok' => false,
        'domiciliario_problemas' => ['llego_tarde'],
    ])->assertCreated();

    expect(puntaje($domi))->toBe(80);
    $this->assertDatabaseHas('reputacion_eventos', [
        'sujeto_id' => $domi->id,
        'motivo' => 'llego_tarde',
        'puntos' => 0,
        'comentario' => 'Justificó: Aguacero fuerte',
    ]);
});

// ===========================================================================
// Veto del domiciliario
// ===========================================================================

test('dos pedidos que nunca llegaron vetan al domiciliario', function () {
    $domi = repUsuario('domiciliario');
    $negocio = repNegocio();

    foreach ([repUsuario(), repUsuario()] as $cliente) {
        $pedido = repPedido($negocio, $cliente, 'entregado', $domi);
        Sanctum::actingAs($cliente);
        $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
            'negocio_ok' => true,
            'domiciliario_ok' => false,
            'domiciliario_problemas' => ['no_llego'],
        ])->assertCreated();
    }

    $domi->refresh();
    expect($domi->domiciliarioVetado())->toBeTrue()
        ->and($domi->reputacion_domiciliario)->toBe(10); // 80 - 35 - 35

    // Vetado: no ve disponibles ni puede tomar pedidos.
    $listo = repPedido($negocio, repUsuario(), 'listo');
    Sanctum::actingAs($domi);
    $this->getJson('/api/domiciliario/disponibles')
        ->assertOk()
        ->assertJsonPath('vetado', true)
        ->assertJsonCount(0, 'pedidos');
    $this->putJson("/api/domiciliario/pedidos/{$listo->id}/tomar", ['minutos_recogida' => 10])
        ->assertStatus(403);
    $this->getJson('/api/domiciliario/reputacion')
        ->assertOk()
        ->assertJsonPath('reputacion.nivel', 'vetado');
});

test('una sola falta grave baja mucho pero no veta todavía', function () {
    $domi = repUsuario('domiciliario');
    $cliente = repUsuario();
    $pedido = repPedido(repNegocio(), $cliente, 'entregado', $domi);
    Sanctum::actingAs($cliente);

    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", [
        'negocio_ok' => true,
        'domiciliario_ok' => false,
        'domiciliario_problemas' => ['no_llego'],
    ])->assertCreated();

    $domi->refresh();
    expect($domi->domiciliarioVetado())->toBeFalse()
        ->and(Reputacion::resumen('domiciliario', $domi)['nivel'])->toBe('riesgo');
});

// ===========================================================================
// El negocio confirma el dinero (efectivo)
// ===========================================================================

test('el negocio confirma si el domiciliario le entregó el dinero, una sola vez', function () {
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $pedido = repPedido($negocio, repUsuario(), 'entregado', $domi);
    Sanctum::actingAs($negocio->user);

    $this->getJson("/api/negocios/{$negocio->id}/pedidos")
        ->assertJsonPath('pedidos.0.puede_confirmar_dinero', true);

    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/dinero", ['estado' => 'no_recibido'])
        ->assertOk();

    expect(puntaje($domi))->toBe(45);
    $this->assertDatabaseHas('reputacion_eventos', [
        'sujeto_id' => $domi->id,
        'motivo' => 'dinero_no_entregado',
        'grave' => true,
        'origen' => 'negocio',
    ]);

    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/dinero", ['estado' => 'recibido'])
        ->assertStatus(409);
});

test('los pedidos viejos (o de antes de esta función) no piden confirmar dinero', function () {
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $viejo = repPedido($negocio, repUsuario(), 'entregado', $domi, ['recogido_at' => now()->subDays(4)]);
    $legado = repPedido($negocio, repUsuario(), 'entregado', $domi, ['recogido_at' => null]);
    Sanctum::actingAs($negocio->user);

    $this->getJson("/api/negocios/{$negocio->id}/pedidos")
        ->assertJsonPath('pedidos.0.puede_confirmar_dinero', false)
        ->assertJsonPath('pedidos.1.puede_confirmar_dinero', false);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$viejo->id}/dinero", ['estado' => 'no_recibido'])
        ->assertStatus(409);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$legado->id}/dinero", ['estado' => 'no_recibido'])
        ->assertStatus(409);
});

test('no hay dinero que confirmar en pedidos por transferencia o de otro negocio', function () {
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $transferencia = repPedido($negocio, repUsuario(), 'entregado', $domi, ['metodo_pago' => 'transferencia']);

    Sanctum::actingAs($negocio->user);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$transferencia->id}/dinero", ['estado' => 'recibido'])
        ->assertStatus(409);

    Sanctum::actingAs(repUsuario());
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$transferencia->id}/dinero", ['estado' => 'recibido'])
        ->assertStatus(403);
});

// ===========================================================================
// Tiempos prometidos
// ===========================================================================

test('el pedido guarda el tiempo de preparación que prometía el negocio', function () {
    $negocio = repNegocio(35);
    $producto = $negocio->productos()->create(['nombre' => 'Pan', 'precio' => 1000]);
    Sanctum::actingAs(repUsuario());

    $id = $this->postJson('/api/pedidos', [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 2]],
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 1',
        'telefono_contacto' => '3000000000',
    ])->assertCreated()->json('id');

    expect(Pedido::find($id)->minutos_preparacion)->toBe(35);
});

test('el negocio que se pasa de su tiempo de preparación baja; el puntual sube', function () {
    $negocio = repNegocio(20);
    $tarde = repPedido($negocio, repUsuario(), 'pendiente');
    $puntual = repPedido($negocio, repUsuario(), 'pendiente');
    Sanctum::actingAs($negocio->user);

    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$puntual->id}/listo")->assertOk();
    expect(puntaje($negocio))->toBe(81);

    // 40 min para algo prometido en 20 (margen de 5): tarde.
    $this->travel(40)->minutes();
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$tarde->id}/listo")->assertOk();

    expect(puntaje($negocio))->toBe(78);
    expect($tarde->fresh()->listo_at)->not->toBeNull();
});

test('el domiciliario que recoge después de lo que prometió baja, salvo novedad', function () {
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $sinExcusa = repPedido($negocio, repUsuario(), 'listo');
    $conExcusa = repPedido($negocio, repUsuario(), 'listo');
    Sanctum::actingAs($domi);

    $this->putJson("/api/domiciliario/pedidos/{$sinExcusa->id}/tomar", ['minutos_recogida' => 10])->assertOk();
    $this->putJson("/api/domiciliario/pedidos/{$conExcusa->id}/tomar", ['minutos_recogida' => 10])->assertOk();
    $this->putJson("/api/domiciliario/pedidos/{$conExcusa->id}/novedad", ['novedad' => 'Se pinchó la llanta'])
        ->assertOk();

    $this->travel(30)->minutes();
    $this->putJson("/api/domiciliario/pedidos/{$sinExcusa->id}/recogido")->assertOk();
    $this->putJson("/api/domiciliario/pedidos/{$conExcusa->id}/recogido")->assertOk();

    expect(puntaje($domi))->toBe(77); // solo cuenta el que no avisó
    expect($sinExcusa->fresh()->recogido_at)->not->toBeNull();

    // El cliente ve la novedad en el seguimiento.
    Sanctum::actingAs($conExcusa->cliente);
    $this->getJson("/api/pedidos/{$conExcusa->id}")->assertJsonPath('novedad', 'Se pinchó la llanta');
});

test('solo se reportan novedades de entregas propias en curso', function () {
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $otro = repPedido($negocio, repUsuario(), 'recogido', repUsuario('domiciliario'));
    $entregado = repPedido($negocio, repUsuario(), 'entregado', $domi);
    Sanctum::actingAs($domi);

    $this->putJson("/api/domiciliario/pedidos/{$otro->id}/novedad", ['novedad' => 'x'])->assertStatus(409);
    $this->putJson("/api/domiciliario/pedidos/{$entregado->id}/novedad", ['novedad' => 'x'])->assertStatus(409);
});

// ===========================================================================
// Negocios vetados y vista del equipo
// ===========================================================================

test('un negocio vetado desaparece de Explorar y no recibe pedidos', function () {
    $negocio = repNegocio();
    $producto = $negocio->productos()->create(['nombre' => 'Pan', 'precio' => 1000]);
    $negocio->forceFill(['vetado_at' => now(), 'reputacion' => 20])->save();
    Sanctum::actingAs(repUsuario());

    $this->getJson('/api/negocios')->assertOk()->assertJsonCount(0, 'negocios');
    $this->getJson("/api/negocios/{$negocio->id}")->assertNotFound();
    $this->postJson('/api/pedidos', [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 1]],
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 1',
        'telefono_contacto' => '3000000000',
    ])->assertStatus(422);
});

test('Explorar muestra el nivel y el tiempo de preparación de cada negocio', function () {
    repNegocio(25);
    Sanctum::actingAs(repUsuario());

    $this->getJson('/api/negocios')
        ->assertOk()
        ->assertJsonPath('negocios.0.tiempo_preparacion', 25)
        ->assertJsonPath('negocios.0.reputacion.puntaje', 80)
        ->assertJsonPath('negocios.0.reputacion.nivel', 'nuevo');
});

test('el equipo del negocio ve su reputación; un extraño no', function () {
    $negocio = repNegocio();
    Sanctum::actingAs($negocio->user);
    $this->getJson("/api/negocios/{$negocio->id}/reputacion")
        ->assertOk()
        ->assertJsonPath('reputacion.puntaje', 80)
        ->assertJsonPath('tiempo_preparacion', 20);

    Sanctum::actingAs(repUsuario());
    $this->getJson("/api/negocios/{$negocio->id}/reputacion")->assertStatus(403);
});

test('el propietario cambia el tiempo de preparación de su negocio', function () {
    $negocio = repNegocio();
    Sanctum::actingAs($negocio->user);

    $this->putJson("/api/negocios/{$negocio->id}", ['tiempo_preparacion' => 45])
        ->assertOk()
        ->assertJsonPath('negocio.tiempo_preparacion', 45);
    $this->putJson("/api/negocios/{$negocio->id}", ['tiempo_preparacion' => 1])
        ->assertStatus(422);
});

// ===========================================================================
// Puntaje
// ===========================================================================

test('el puntaje no pasa de 100 aunque haya muchos pedidos buenos', function () {
    $negocio = repNegocio();
    foreach (range(1, 15) as $i) {
        $pedido = repPedido($negocio, repUsuario());
        Reputacion::registrar(Reputacion::NEGOCIO, $negocio, 'cliente_conforme', $pedido);
    }

    expect(puntaje($negocio))->toBe(100)
        ->and(Reputacion::resumen('negocio', $negocio)['nivel'])->toBe('excelente');
});

test('el mismo motivo no cuenta dos veces para el mismo pedido', function () {
    $negocio = repNegocio();
    $pedido = repPedido($negocio, repUsuario());

    Reputacion::registrar(Reputacion::NEGOCIO, $negocio, 'pedido_incompleto', $pedido);
    Reputacion::registrar(Reputacion::NEGOCIO, $negocio, 'pedido_incompleto', $pedido);

    expect(puntaje($negocio))->toBe(72);
});

// ===========================================================================
// Admin
// ===========================================================================

test('el admin ve a los vetados primero y puede darles una segunda oportunidad', function () {
    $bueno = repUsuario('domiciliario');
    $malo = repUsuario('domiciliario');
    $negocio = repNegocio();
    foreach (range(1, 2) as $i) {
        Reputacion::registrar(Reputacion::DOMICILIARIO, $malo, 'no_llego', repPedido($negocio, repUsuario(), 'entregado', $malo));
    }
    expect($malo->fresh()->domiciliarioVetado())->toBeTrue();

    Sanctum::actingAs(repUsuario('administrador'));
    $this->getJson('/api/admin/reputacion?tipo=domiciliario')
        ->assertOk()
        ->assertJsonPath('sujetos.0.id', $malo->id)
        ->assertJsonPath('vetados', 1);

    $this->putJson("/api/admin/reputacion/domiciliario/{$malo->id}/levantar-veto")
        ->assertOk()
        ->assertJsonPath('reputacion.vetado', false)
        ->assertJsonPath('reputacion.puntaje', 50);

    // Las faltas graves de antes ya no cuentan: una nueva falta leve no lo veta.
    Reputacion::registrar(Reputacion::DOMICILIARIO, $malo->fresh(), 'llego_tarde', repPedido($negocio, repUsuario(), 'entregado', $malo));
    expect($malo->fresh()->domiciliarioVetado())->toBeFalse();

    // Un domiciliario sin veto no tiene nada que levantar.
    $this->putJson("/api/admin/reputacion/domiciliario/{$bueno->id}/levantar-veto")->assertStatus(409);
});

test('el admin anula un evento injusto y el puntaje se recalcula', function () {
    $negocio = repNegocio();
    $domi = repUsuario('domiciliario');
    $falso = Reputacion::registrar(Reputacion::DOMICILIARIO, $domi, 'no_llego', repPedido($negocio, repUsuario(), 'entregado', $domi));
    Reputacion::registrar(Reputacion::DOMICILIARIO, $domi, 'dinero_no_entregado', repPedido($negocio, repUsuario(), 'entregado', $domi));
    expect($domi->fresh()->domiciliarioVetado())->toBeTrue();

    Sanctum::actingAs(repUsuario('administrador'));
    $this->putJson("/api/admin/reputacion/eventos/{$falso->id}/anular")
        ->assertOk()
        ->assertJsonPath('reputacion.puntaje', 45)
        ->assertJsonPath('reputacion.vetado', false);

    $this->getJson("/api/admin/reputacion/domiciliario/{$domi->id}")
        ->assertOk()
        ->assertJsonPath('eventos.1.anulado', true);

    expect(ReputacionEvento::find($falso->id)->anulado_at)->not->toBeNull();
});

test('el admin suspende a mano y solo se quita con una segunda oportunidad', function () {
    $negocio = repNegocio();
    Sanctum::actingAs(repUsuario('administrador'));

    $this->putJson("/api/admin/reputacion/negocio/{$negocio->id}/suspender", ['motivo' => 'Vende productos vencidos'])
        ->assertOk()
        ->assertJsonPath('reputacion.vetado', true)
        ->assertJsonPath('reputacion.puntaje', 80)
        ->assertJsonPath('reputacion.motivo_veto', 'Suspendido por un administrador: Vende productos vencidos');
    $this->putJson("/api/admin/reputacion/negocio/{$negocio->id}/suspender", ['motivo' => 'otra vez'])
        ->assertStatus(409);

    // Anular OTRO evento (un reclamo cualquiera) no quita la suspensión manual.
    $queja = Reputacion::registrar(Reputacion::NEGOCIO, $negocio->fresh(), 'mala_atencion', repPedido($negocio, repUsuario()));
    $this->putJson("/api/admin/reputacion/eventos/{$queja->id}/anular")
        ->assertOk()
        ->assertJsonPath('reputacion.vetado', true);

    $this->putJson("/api/admin/reputacion/negocio/{$negocio->id}/levantar-veto")
        ->assertOk()
        ->assertJsonPath('reputacion.vetado', false)
        ->assertJsonPath('reputacion.puntaje', 80);
});

test('solo el admin entra a la zona de reputación', function () {
    Sanctum::actingAs(repUsuario('domiciliario'));
    $this->getJson('/api/admin/reputacion')->assertStatus(403);
});
