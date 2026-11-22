<?php

use App\Models\CuentaPago;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\PedidoReporte;
use App\Models\Producto;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use App\Support\CancelarPedido;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Pago por transferencia verificado por el negocio: el cliente ve las
// cuentas al ser aceptado, avisa que pagó, el negocio confirma que le llegó
// y solo entonces se prepara y el domiciliario no cobra nada.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
    Storage::fake('public');
    Storage::fake('local');
});

function ptPersona(string $rol = 'usuario'): User
{
    $user = User::factory()->conClave()->create(['telefono' => '3001234567', 'password' => 'ClaveSegura1']);
    $user->syncRoles(User::rolesDelTipo($rol));

    return $user;
}

/** @return array{0: User, 1: Negocio, 2: Producto} */
function ptNegocio(bool $conCuenta = true): array
{
    $dueno = ptPersona();
    $horario = collect(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'])
        ->mapWithKeys(fn ($d) => [$d => ['abre' => '00:00', 'cierra' => '23:59']])->all();
    $negocio = $dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true, 'horario' => $horario]);
    $producto = $negocio->productos()->create([
        'nombre' => 'Arepa', 'precio' => 3000, 'tipo_venta' => 'cantidad', 'unidad_medida' => 'unidad', 'disponible' => true,
    ]);
    if ($conCuenta) {
        $negocio->cuentasPago()->create(['tipo' => 'nequi', 'numero' => '3001112233', 'titular' => 'Tienda SAS']);
    }

    return [$dueno, $negocio, $producto];
}

/** Pedido por transferencia creado desde la app, como lo haría el cliente. */
function ptPedir($test, User $cliente, Negocio $negocio, Producto $producto): Pedido
{
    Sanctum::actingAs($cliente);
    $id = $test->postJson('/api/pedidos', [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 2]],
        'metodo_pago' => 'transferencia',
        ...direccionPedidoPrueba($cliente),
        'telefono_contacto' => '3001234567',
    ])->assertCreated()->json('id');

    return Pedido::findOrFail($id);
}

test('solo se puede elegir transferencia si el negocio tiene dónde recibirla', function () {
    [, $sinCuenta, $producto] = ptNegocio(false);
    $cliente = ptPersona();
    Sanctum::actingAs($cliente);

    $this->getJson("/api/negocios/{$sinCuenta->id}/estado")->assertJsonPath('acepta_transferencia', false);
    $this->postJson('/api/pedidos', [
        'negocio_id' => $sinCuenta->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 1]],
        'metodo_pago' => 'transferencia',
        ...direccionPedidoPrueba($cliente),
        'telefono_contacto' => '3001234567',
    ])->assertUnprocessable()->assertJsonValidationErrors('metodo_pago');

    [, $negocio, $otro] = ptNegocio();
    $this->getJson("/api/negocios/{$negocio->id}/estado")->assertJsonPath('acepta_transferencia', true);
    expect(ptPedir($this, $cliente, $negocio, $otro)->pago_estado)->toBe('por_pagar');
});

test('el flujo completo: aceptar, pagar, revisar y confirmar antes de preparar', function () {
    [$dueno, $negocio, $producto] = ptNegocio();
    $cliente = ptPersona();
    $pedido = ptPedir($this, $cliente, $negocio, $producto);
    $cuenta = $negocio->cuentasPago()->first();

    // Sin aceptar: todavía no ve cuentas ni puede avisar que pagó.
    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertJsonPath('pago.estado', 'por_pagar')
        ->assertJsonPath('pago.cuentas', [])
        ->assertJsonPath('pago.puede_informar', false)
        ->assertJsonPath('estados.1', 'pago')
        ->assertJsonPath('estado_index', 0);
    $this->postJson("/api/pedidos/{$pedido->id}/pago", ['cuenta_id' => $cuenta->id])->assertConflict();

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/aceptar")->assertOk();
    // El aviso no dice «ya lo están preparando»: le pide pagar.
    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class,
        fn ($n) => str_contains($n->texto[1] ?? '', 'por transferencia'));
    // No se prepara ni se ofrece a domiciliarios sin el pago confirmado.
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/listo")->assertConflict();
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('estado_label', 'Esperando el pago')
        ->assertJsonPath('pago.puede_confirmar', true);

    Sanctum::actingAs($cliente);
    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertJsonPath('pago.cuentas.0.nombre', 'Nequi')
        ->assertJsonPath('pago.cuentas.0.numero', '3001112233')
        ->assertJsonPath('pago.puede_informar', true)
        ->assertJsonPath('estado_index', 1);

    $this->post("/api/pedidos/{$pedido->id}/pago", [
        'cuenta_id' => $cuenta->id,
        'comprobante' => UploadedFile::fake()->image('comprobante.jpg'),
    ], ['Accept' => 'application/json'])->assertOk();
    $pedido->refresh();
    expect($pedido->pago_estado)->toBe('informado')
        ->and($pedido->pago_cuenta['titular'])->toBe('Tienda SAS');
    Storage::disk('local')->assertExists($pedido->pago_comprobante);
    Notification::assertSentTo($dueno, EstadoPedidoActualizado::class);
    // Ya avisó: no lo repite ni ve las cuentas.
    $this->postJson("/api/pedidos/{$pedido->id}/pago", ['cuenta_id' => $cuenta->id])->assertConflict();
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('pago.cuentas', []);

    // El comprobante es privado: el cliente y el equipo del negocio.
    $this->get("/api/pedidos/{$pedido->id}/comprobante")->assertOk();
    Sanctum::actingAs($dueno);
    $this->get("/api/pedidos/{$pedido->id}/comprobante")->assertOk();
    Sanctum::actingAs(ptPersona());
    $this->get("/api/pedidos/{$pedido->id}/comprobante")->assertForbidden();

    // No lo encuentra: el cliente revisa y vuelve a avisar.
    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/pago", ['estado' => 'no_llego'])->assertOk();
    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class);
    Sanctum::actingAs($cliente);
    $this->postJson("/api/pedidos/{$pedido->id}/pago", ['cuenta_id' => $cuenta->id])->assertOk();

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/pago", ['estado' => 'confirmado'])->assertOk();
    expect($pedido->fresh())->pago_estado->toBe('confirmado')->pago_confirmado_por->toBe($dueno->id);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/pago", ['estado' => 'confirmado'])->assertConflict();
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/listo")->assertOk();

    Sanctum::actingAs($cliente);
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('estado_index', 3)->assertJsonPath('estado_label', 'Listo para recoger');
});

test('el domiciliario no cobra nada y sabe que el negocio le entrega el domicilio', function () {
    [, $negocio, $producto] = ptNegocio();
    $pedido = ptPedir($this, ptPersona(), $negocio, $producto);
    $domiciliario = ptPersona('domiciliario');
    $pedido->update([
        'estado' => 'tomado', 'domiciliario_id' => $domiciliario->id, 'tomado_at' => now(),
        'pago_estado' => 'confirmado', 'codigo_confirmacion' => '1234',
    ]);

    Sanctum::actingAs($domiciliario);
    $this->getJson('/api/domiciliario/entregas')
        ->assertJsonPath('pedidos.0.cobrar', 0)
        ->assertJsonPath('pedidos.0.domicilio_lo_entrega_negocio', true);
});

test('antes de salir el domiciliario dice si el negocio le dio el domicilio', function () {
    [$dueno, $negocio, $producto] = ptNegocio();
    $pedido = ptPedir($this, ptPersona(), $negocio, $producto);
    $domiciliario = ptPersona('domiciliario');
    $pedido->update([
        'estado' => 'recogido', 'domiciliario_id' => $domiciliario->id, 'tomado_at' => now(), 'recogido_at' => now(),
        'pago_estado' => 'confirmado', 'costo_domicilio' => 5000,
    ]);

    Sanctum::actingAs($domiciliario);
    $this->getJson('/api/domiciliario/entregas')->assertJsonPath('pedidos.0.pide_confirmar_domicilio', true);
    // Sin responder no sale.
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/en-camino")->assertUnprocessable()->assertJsonValidationErrors('domicilio_recibido');
    expect($pedido->fresh()->estado)->toBe('recogido');

    // No se lo dieron: sale igual, el negocio queda debiéndolo y se entera.
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/en-camino", ['domicilio_recibido' => false])->assertOk();
    expect($pedido->fresh())->estado->toBe('en_camino')->domicilio_recibido->toBeFalse();
    expect(PedidoReporte::where('pedido_id', $pedido->id)->where('tipo', 'domicilio_no_entregado')->whereNull('resuelto_at')->exists())->toBeTrue();
    Notification::assertSentTo($dueno, EstadoPedidoActualizado::class);
    Sanctum::actingAs($dueno);
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")->assertJsonPath('debe_domicilio', true);

    // Entregado, sigue en sus entregas hasta que el negocio le paga.
    $pedido->update(['estado' => 'entregado', 'entregado_at' => now()]);
    Sanctum::actingAs($domiciliario);
    $this->getJson('/api/domiciliario/entregas')->assertJsonPath('pedidos.0.negocio_debe_domicilio', true);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/domicilio-recibido")->assertOk();
    expect($pedido->fresh()->domicilio_recibido)->toBeTrue();
    expect(PedidoReporte::where('pedido_id', $pedido->id)->where('tipo', 'domicilio_no_entregado')->first()->resuelto_at)->not->toBeNull();
    $this->getJson('/api/domiciliario/entregas')->assertJsonCount(0, 'pedidos');
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/domicilio-recibido")->assertConflict();
});

test('si se lo dieron, sale sin reporte; en efectivo no se pregunta', function () {
    [, $negocio, $producto] = ptNegocio();
    $pedido = ptPedir($this, ptPersona(), $negocio, $producto);
    $domiciliario = ptPersona('domiciliario');
    $pedido->update([
        'estado' => 'recogido', 'domiciliario_id' => $domiciliario->id, 'recogido_at' => now(),
        'pago_estado' => 'confirmado', 'costo_domicilio' => 5000,
    ]);
    Sanctum::actingAs($domiciliario);
    $this->putJson("/api/domiciliario/pedidos/{$pedido->id}/en-camino", ['domicilio_recibido' => true])->assertOk();
    expect($pedido->fresh()->domicilio_recibido)->toBeTrue();
    expect(PedidoReporte::where('pedido_id', $pedido->id)->count())->toBe(0);

    $efectivo = $pedido->replicate()->fill(['metodo_pago' => 'efectivo', 'estado' => 'recogido', 'domicilio_recibido' => null, 'pago_estado' => null]);
    $efectivo->codigo = null;
    $efectivo->save();
    $this->putJson("/api/domiciliario/pedidos/{$efectivo->id}/en-camino")->assertOk();
    expect($efectivo->fresh()->domicilio_recibido)->toBeNull();
});

test('el negocio cancela sin perder confiabilidad si el cliente no paga', function () {
    [$dueno, $negocio, $producto] = ptNegocio();
    $pedido = ptPedir($this, ptPersona(), $negocio, $producto);
    $pedido->update(['estado' => 'aceptado', 'aceptado_at' => now()->subHour()]);

    expect(CancelarPedido::penaliza($pedido->fresh()))->toBeFalse();
    Sanctum::actingAs($dueno);
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('cancelar_penaliza', false)
        ->assertJsonPath('motivos_cancelacion.0', CancelarPedido::MOTIVO_SIN_PAGO);

    // Con el pago confirmado, el reloj de la cancelación libre corre desde ahí.
    $pedido->update(['pago_estado' => 'confirmado', 'pago_confirmado_at' => now()]);
    expect(CancelarPedido::penaliza($pedido->fresh()))->toBeFalse();
    $pedido->update(['pago_confirmado_at' => now()->subMinutes(10)]);
    expect(CancelarPedido::penaliza($pedido->fresh()))->toBeTrue();
});

test('con el pago avisado no se puede informar un faltante que cambie el total', function () {
    [$dueno, $negocio, $producto] = ptNegocio();
    $pedido = ptPedir($this, ptPersona(), $negocio, $producto);
    $pedido->update(['estado' => 'aceptado', 'aceptado_at' => now(), 'pago_estado' => 'informado']);

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/faltante", ['motivo' => 'Se acabó la arepa'])->assertConflict();
    $pedido->update(['pago_estado' => 'por_pagar']);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/faltante", ['motivo' => 'Se acabó la arepa'])->assertOk();
    // Con un faltante por resolver, el cliente no paga todavía.
    expect($pedido->fresh()->puedeInformarPago())->toBeFalse();
});

test('no se puede avisar el pago en una cuenta de otro negocio', function () {
    [$dueno, $negocio, $producto] = ptNegocio();
    [, $otro] = ptNegocio();
    $cliente = ptPersona();
    $pedido = ptPedir($this, $cliente, $negocio, $producto);
    $pedido->update(['estado' => 'aceptado', 'aceptado_at' => now()]);

    $this->postJson("/api/pedidos/{$pedido->id}/pago", ['cuenta_id' => $otro->cuentasPago()->first()->id])->assertUnprocessable();
    expect($pedido->fresh()->pago_estado)->toBe('por_pagar');
});

test('el propietario maneja las cuentas; quien gestiona pedidos solo las ve', function () {
    [$dueno, $negocio] = ptNegocio(false);
    $trabajador = ptPersona();
    $negocio->miembros()->attach($trabajador->id, ['rol' => Negocio::ROL_TRABAJADOR, 'activo' => true, 'gestionar_pedidos' => true]);
    $base = "/api/negocios/{$negocio->id}/cuentas-pago";

    Sanctum::actingAs($dueno);
    // Crear, editar o borrar una cuenta pide la clave de 4 números.
    $this->postJson($base, ['tipo' => 'nequi', 'numero' => '3001112233', 'titular' => 'Ana Pérez'])->assertJsonValidationErrors('pin');
    $this->postJson($base, ['tipo' => 'nequi', 'numero' => '3001112233', 'titular' => 'Ana Pérez', 'pin' => '1357'])->assertJsonValidationErrors('pin');
    expect($negocio->cuentasPago()->count())->toBe(0);
    // Cada tipo pide lo suyo.
    $this->postJson($base, ['tipo' => 'nequi', 'titular' => 'Ana Pérez', 'pin' => '2468'])->assertJsonValidationErrors('numero');
    $this->postJson($base, ['tipo' => 'banco', 'numero' => '123456789', 'titular' => 'Ana Pérez', 'pin' => '2468'])
        ->assertJsonValidationErrors(['banco', 'tipo_cuenta']);
    $this->postJson($base, ['tipo' => 'qr', 'titular' => 'Ana Pérez', 'pin' => '2468'])->assertJsonValidationErrors('qr');

    $this->postJson($base, ['tipo' => 'bancolombia', 'numero' => '123 4567  8901', 'tipo_cuenta' => 'ahorros', 'titular' => 'Ana Pérez', 'pin' => '2468'])
        ->assertCreated()->assertJsonPath('cuenta.numero', '123 4567 8901');
    $qr = $this->post($base, ['tipo' => 'qr', 'titular' => 'Ana Pérez', 'qr' => UploadedFile::fake()->image('qr.png'), 'pin' => '2468'], ['Accept' => 'application/json'])
        ->assertCreated()->json('cuenta');
    expect($qr['qr'])->toStartWith('/storage/cuentas-pago/');

    $id = CuentaPago::where('tipo', 'bancolombia')->value('id');
    $this->postJson("{$base}/{$id}", ['tipo' => 'llave', 'numero' => '@tienda', 'titular' => 'Ana Pérez', 'pin' => '2468'])
        ->assertOk()->assertJsonPath('cuenta.tipo_cuenta', null)->assertJsonPath('cuenta.nombre', 'Llave');

    Sanctum::actingAs($trabajador);
    $this->getJson($base)->assertOk()->assertJsonCount(2, 'cuentas')->assertJsonPath('puede_editar', false);
    $this->postJson($base, ['tipo' => 'nequi', 'numero' => '3001112233', 'titular' => 'Yo'])->assertForbidden();
    $this->deleteJson("{$base}/{$id}")->assertForbidden();

    Sanctum::actingAs(ptPersona());
    $this->getJson($base)->assertForbidden();

    Sanctum::actingAs($dueno);
    $this->deleteJson("{$base}/{$id}")->assertJsonValidationErrors('pin');
    $this->deleteJson("{$base}/{$id}", ['pin' => '2468'])->assertOk();
    foreach (range(1, CuentaPago::MAXIMO - 1) as $i) {
        $this->postJson($base, ['tipo' => 'nequi', 'numero' => "300000000{$i}", 'titular' => 'Ana Pérez', 'pin' => '2468'])->assertCreated();
    }
    $this->postJson($base, ['tipo' => 'nequi', 'numero' => '3009999999', 'titular' => 'Ana Pérez', 'pin' => '2468'])->assertUnprocessable();
});
