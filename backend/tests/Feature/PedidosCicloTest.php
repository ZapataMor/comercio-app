<?php

use App\Models\Ajuste;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\User;
use App\Notifications\PedidoCancelado;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Ciclo completo del pedido: domicilio, cancelaciones, historial del negocio
// y contacto entre las partes.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    // Simula Firebase configurado para que Push::enviar despache (fake).
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
});

function conRol(string $rol): User
{
    $user = User::factory()->create(['telefono' => '3001234567']);
    $user->assignRole($rol);

    return $user;
}

/** @return array{0: User, 1: Negocio, 2: App\Models\Producto} */
function negocioConProducto(): array
{
    $dueno = conRol('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true, 'telefono' => '3015556677']);
    $producto = $negocio->productos()->create([
        'nombre' => 'Arepa', 'precio' => 3000, 'tipo_venta' => 'cantidad', 'unidad_medida' => 'unidad', 'disponible' => true,
    ]);

    return [$dueno, $negocio, $producto];
}

function pedirComo(User $cliente, Negocio $negocio, $producto, int $cantidad = 2)
{
    Sanctum::actingAs($cliente);

    return test()->postJson('/api/pedidos', [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => $cantidad]],
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 5',
        'telefono_contacto' => '3001234567',
    ]);
}

// ---------------------------------------------------------------------------
// Costo de domicilio
// ---------------------------------------------------------------------------

test('el pedido suma la tarifa de domicilio vigente al total', function () {
    [, $negocio, $producto] = negocioConProducto();
    Ajuste::guardar(Ajuste::TARIFA_DOMICILIO, 5000);

    $id = pedirComo(conRol('usuario'), $negocio, $producto, 2)->assertCreated()->json('id');

    $pedido = Pedido::find($id);
    expect((float) $pedido->subtotal)->toBe(6000.0)
        ->and((float) $pedido->costo_domicilio)->toBe(5000.0)
        ->and((float) $pedido->total)->toBe(11000.0);
});

test('cambiar la tarifa no afecta los pedidos ya hechos', function () {
    [, $negocio, $producto] = negocioConProducto();
    Ajuste::guardar(Ajuste::TARIFA_DOMICILIO, 3000);
    $id = pedirComo(conRol('usuario'), $negocio, $producto)->json('id');

    Ajuste::guardar(Ajuste::TARIFA_DOMICILIO, 9000);

    expect((float) Pedido::find($id)->costo_domicilio)->toBe(3000.0);
});

test('la app lee la tarifa y solo el admin la cambia', function () {
    Sanctum::actingAs(conRol('usuario'));
    $this->getJson('/api/ajustes')->assertOk()->assertJsonPath('tarifa_domicilio', 4000);
    $this->putJson('/api/admin/ajustes', ['tarifa_domicilio' => 6000])->assertForbidden();

    Sanctum::actingAs(conRol('administrador'));
    $this->putJson('/api/admin/ajustes', ['tarifa_domicilio' => 6000])->assertOk();
    expect(Ajuste::tarifaDomicilio())->toBe(6000);
});

test('el seguimiento muestra subtotal, domicilio y teléfonos', function () {
    [, $negocio, $producto] = negocioConProducto();
    $cliente = conRol('usuario');
    $id = pedirComo($cliente, $negocio, $producto)->json('id');

    $this->getJson("/api/pedidos/{$id}")
        ->assertOk()
        ->assertJsonPath('subtotal', 6000)
        ->assertJsonPath('costo_domicilio', 4000)
        ->assertJsonPath('total', 10000)
        ->assertJsonPath('negocio_telefono', '3015556677')
        ->assertJsonPath('puede_cancelar', true);
});

// ---------------------------------------------------------------------------
// Cancelaciones
// ---------------------------------------------------------------------------

test('el cliente cancela un pedido pendiente y se avisa al negocio', function () {
    [$dueno, $negocio, $producto] = negocioConProducto();
    $cliente = conRol('usuario');
    $id = pedirComo($cliente, $negocio, $producto)->json('id');

    $this->postJson("/api/pedidos/{$id}/cancelar", ['motivo' => 'Me equivoqué'])->assertOk();

    $pedido = Pedido::find($id);
    expect($pedido->estado)->toBe('cancelado')
        ->and($pedido->cancelado_por)->toBe('cliente')
        ->and($pedido->motivo_cancelacion)->toBe('Me equivoqué');
    Notification::assertSentTo($dueno, PedidoCancelado::class);
});

test('el cliente no puede cancelar cuando el negocio ya lo tiene listo', function () {
    [, $negocio, $producto] = negocioConProducto();
    $cliente = conRol('usuario');
    $id = pedirComo($cliente, $negocio, $producto)->json('id');
    Pedido::whereKey($id)->update(['estado' => 'listo']);

    $this->postJson("/api/pedidos/{$id}/cancelar")->assertStatus(409);
    expect(Pedido::find($id)->estado)->toBe('listo');
});

test('nadie cancela el pedido de otro cliente', function () {
    [, $negocio, $producto] = negocioConProducto();
    $id = pedirComo(conRol('usuario'), $negocio, $producto)->json('id');

    Sanctum::actingAs(conRol('usuario'));
    $this->postJson("/api/pedidos/{$id}/cancelar")->assertNotFound();
});

test('el negocio rechaza un pedido pendiente con motivo y se avisa al cliente', function () {
    [$dueno, $negocio, $producto] = negocioConProducto();
    $cliente = conRol('usuario');
    $id = pedirComo($cliente, $negocio, $producto)->json('id');

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$id}/cancelar", ['motivo' => 'Se agotó un producto'])
        ->assertOk();

    expect(Pedido::find($id)->cancelado_por)->toBe('negocio');
    Notification::assertSentTo($cliente, PedidoCancelado::class);
});

test('el negocio cancela un pedido listo que nadie tomó, pero no uno ya tomado', function () {
    [$dueno, $negocio, $producto] = negocioConProducto();
    $cliente = conRol('usuario');
    $listo = pedirComo($cliente, $negocio, $producto)->json('id');
    $tomado = pedirComo($cliente, $negocio, $producto)->json('id');
    Pedido::whereKey($listo)->update(['estado' => 'listo']);
    Pedido::whereKey($tomado)->update(['estado' => 'tomado', 'domiciliario_id' => conRol('domiciliario')->id]);

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$listo}/cancelar")->assertOk();
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$tomado}/cancelar")->assertStatus(409);
});

test('un pedido cancelado no aparece para los domiciliarios ni se puede tomar', function () {
    [$dueno, $negocio, $producto] = negocioConProducto();
    $id = pedirComo(conRol('usuario'), $negocio, $producto)->json('id');
    Pedido::whereKey($id)->update(['estado' => 'listo']);
    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$id}/cancelar")->assertOk();

    Sanctum::actingAs(conRol('domiciliario'));
    $this->getJson('/api/domiciliario/disponibles')->assertJsonCount(0, 'pedidos');
    $this->putJson("/api/domiciliario/pedidos/{$id}/tomar", ['minutos_recogida' => 10])->assertStatus(409);
});

// ---------------------------------------------------------------------------
// Historial del negocio
// ---------------------------------------------------------------------------

test('el negocio ve sus pedidos por grupo y el resumen de hoy', function () {
    [$dueno, $negocio, $producto] = negocioConProducto();
    $cliente = conRol('usuario');
    $pendiente = pedirComo($cliente, $negocio, $producto)->json('id');
    $entregado = pedirComo($cliente, $negocio, $producto, 3)->json('id');
    $cancelado = pedirComo($cliente, $negocio, $producto)->json('id');
    Pedido::whereKey($entregado)->update(['estado' => 'entregado']);
    Pedido::whereKey($cancelado)->update(['estado' => 'cancelado', 'cancelado_por' => 'cliente']);

    Sanctum::actingAs($dueno);
    $url = "/api/negocios/{$negocio->id}/pedidos";

    $this->getJson("{$url}?grupo=en_espera")->assertJsonCount(1, 'pedidos')->assertJsonPath('pedidos.0.id', $pendiente);
    $this->getJson("{$url}?grupo=entregados")->assertJsonCount(1, 'pedidos')->assertJsonPath('pedidos.0.id', $entregado);
    $this->getJson("{$url}?grupo=cancelados")->assertJsonCount(1, 'pedidos')->assertJsonPath('pedidos.0.cancelado_por', 'cliente');

    // Ventas = subtotal de lo entregado (el domicilio no es del negocio).
    $this->getJson("{$url}/resumen")
        ->assertOk()
        ->assertJsonPath('pedidos', 3)
        ->assertJsonPath('entregados', 1)
        ->assertJsonPath('cancelados', 1)
        ->assertJsonPath('ventas', 9000);

    $this->getJson("{$url}/{$entregado}")->assertOk()->assertJsonPath('id', $entregado);
});

test('quien no es del equipo no ve el historial ni el resumen', function () {
    [, $negocio] = negocioConProducto();
    Sanctum::actingAs(conRol('usuario'));

    $this->getJson("/api/negocios/{$negocio->id}/pedidos?grupo=entregados")->assertForbidden();
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/resumen")->assertForbidden();
});

// ---------------------------------------------------------------------------
// Ciclo completo
// ---------------------------------------------------------------------------

test('ciclo completo: pedir, listo, tomar, recoger, en camino y entregar', function () {
    [$dueno, $negocio, $producto] = negocioConProducto();
    $cliente = conRol('usuario');
    $domi = conRol('domiciliario');
    $id = pedirComo($cliente, $negocio, $producto)->json('id');

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$id}/listo")->assertOk();

    Sanctum::actingAs($domi);
    $this->getJson('/api/domiciliario/disponibles')
        ->assertJsonPath('pedidos.0.negocio.telefono', '3015556677')
        ->assertJsonPath('pedidos.0.costo_domicilio', 4000);
    $this->putJson("/api/domiciliario/pedidos/{$id}/tomar", ['minutos_recogida' => 10])->assertOk();
    $this->putJson("/api/domiciliario/pedidos/{$id}/recogido")->assertOk();
    $this->putJson("/api/domiciliario/pedidos/{$id}/en-camino")->assertOk();
    $this->putJson("/api/domiciliario/pedidos/{$id}/entregado")->assertOk();

    Sanctum::actingAs($cliente);
    $this->getJson("/api/pedidos/{$id}")
        ->assertJsonPath('estado', 'entregado')
        ->assertJsonPath('puede_cancelar', false);
});

// ---------------------------------------------------------------------------
// Negocios archivados (su único dueño eliminó la cuenta)
// ---------------------------------------------------------------------------

test('un negocio archivado no sale en el catálogo ni recibe pedidos', function () {
    [, $negocio, $producto] = negocioConProducto();
    $negocio->forceFill(['archivado_at' => now(), 'activo' => true])->save();
    $cliente = conRol('usuario');

    Sanctum::actingAs($cliente);
    $this->getJson('/api/negocios')->assertJsonCount(0, 'negocios');
    $this->getJson("/api/negocios/{$negocio->id}")->assertNotFound();
    pedirComo($cliente, $negocio, $producto)->assertStatus(422);
});
