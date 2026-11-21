<?php

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\ReembolsoSolicitado;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Devolución de una transferencia: solicitada → devuelta → recibida (o no
// recibida, y vuelve al negocio), o rechazada si el negocio nunca la recibió.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
    Storage::fake('local');
});

function rePersona(): User
{
    $user = User::factory()->create(['telefono' => '3001234567', 'password' => 'ClaveSegura1']);
    $user->syncRoles(User::rolesDelTipo('usuario'));

    return $user;
}

/** @return array{0: User, 1: Negocio, 2: User, 3: Pedido} dueño, negocio, cliente y pedido por transferencia */
function rePedido(string $estado = 'aceptado', ?string $pago = 'confirmado'): array
{
    $dueno = rePersona();
    $negocio = $dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $cliente = rePersona();
    $pedido = Pedido::create([
        'negocio_id' => $negocio->id, 'user_id' => $cliente->id, 'estado' => $estado, 'metodo_pago' => 'transferencia',
        'pago_estado' => $pago, 'pago_confirmado_at' => $pago === 'confirmado' ? now() : null,
        'subtotal' => 10000, 'costo_domicilio' => 4000, 'total' => 14000, 'aceptado_at' => now(),
        'direccion_entrega' => 'Calle 1 #10-20', 'telefono_contacto' => '3005556677',
    ]);

    return [$dueno, $negocio, $cliente, $pedido];
}

test('al cancelar con el pago confirmado, la devolución se abre sola y el negocio la marca devuelta', function () {
    [$dueno, $negocio, $cliente, $pedido] = rePedido();

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/cancelar", ['motivo' => 'Se agotó un producto'])->assertOk();
    expect($pedido->fresh()->reembolso_estado)->toBe('solicitado');
    Notification::assertSentTo($dueno, ReembolsoSolicitado::class);

    // Confirmó el pago: no puede decir que no le llegó.
    $this->postJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", ['estado' => 'rechazado', 'motivo' => 'No me llegó nada'])
        ->assertConflict();
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('reembolso.estado', 'solicitado')
        ->assertJsonPath('reembolso.monto_sugerido', 14000)
        ->assertJsonPath('reembolso.puede_rechazar', false);

    // El cliente dice a dónde.
    Sanctum::actingAs($cliente);
    $this->postJson("/api/pedidos/{$pedido->id}/reembolso", ['cuenta' => 'Nequi   3005556677'])->assertOk();
    expect($pedido->fresh()->reembolso_cuenta)->toBe('Nequi 3005556677');

    Sanctum::actingAs($dueno);
    $this->postJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", ['estado' => 'devuelto', 'monto' => 20000])
        ->assertJsonValidationErrors('monto');
    $this->post("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", [
        'estado' => 'devuelto', 'monto' => 14000, 'comprobante' => UploadedFile::fake()->image('devolucion.jpg'),
    ], ['Accept' => 'application/json'])->assertOk();
    $pedido->refresh();
    expect($pedido)->reembolso_estado->toBe('devuelto')->reembolso_devuelto_por->toBe($dueno->id);
    Storage::disk('local')->assertExists($pedido->reembolso_comprobante);
    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class);

    // Ya devuelto, el cliente no cambia la cuenta y el comprobante es privado.
    Sanctum::actingAs($cliente);
    $this->postJson("/api/pedidos/{$pedido->id}/reembolso", ['cuenta' => 'Daviplata 3001112233'])->assertConflict();
    $this->get("/api/pedidos/{$pedido->id}/reembolso/comprobante")->assertOk();
    Sanctum::actingAs(rePersona());
    $this->get("/api/pedidos/{$pedido->id}/reembolso/comprobante")->assertForbidden();

    // No le llega: vuelve al negocio, que la marca devuelta otra vez.
    Sanctum::actingAs($cliente);
    $this->putJson("/api/pedidos/{$pedido->id}/reembolso/respuesta", ['recibido' => false])->assertOk();
    expect($pedido->fresh()->reembolso_estado)->toBe('no_recibido');
    Sanctum::actingAs($dueno);
    $this->getJson('/api/negocios/mios/reembolsos')->assertJsonPath('total', 1)->assertJsonPath('solicitudes.0.estado', 'no_recibido');
    $this->postJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", ['estado' => 'devuelto', 'monto' => 14000])->assertOk();

    Sanctum::actingAs($cliente);
    $this->putJson("/api/pedidos/{$pedido->id}/reembolso/respuesta", ['recibido' => true])->assertOk();
    $this->putJson("/api/pedidos/{$pedido->id}/reembolso/respuesta", ['recibido' => true])->assertConflict();
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('reembolso.estado', 'recibido');

    Sanctum::actingAs($dueno);
    $this->getJson('/api/negocios/mios/reembolsos')->assertJsonPath('total', 0)->assertJsonPath('solicitudes.0.estado', 'recibido');
});

test('sin pago confirmado el cliente la pide con su cuenta y el negocio puede decir que nunca le llegó', function () {
    [$dueno, $negocio, $cliente, $pedido] = rePedido('aceptado', 'informado');

    Sanctum::actingAs($cliente);
    $this->postJson("/api/pedidos/{$pedido->id}/cancelar")->assertOk();
    // No se abre sola: el negocio no confirmó haber recibido el dinero.
    expect($pedido->fresh()->reembolso_estado)->toBeNull();
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('reembolso.puede_solicitar', true);

    $this->postJson("/api/pedidos/{$pedido->id}/reembolso")->assertJsonValidationErrors('cuenta');
    $this->postJson("/api/pedidos/{$pedido->id}/reembolso", ['cuenta' => 'Nequi 3005556677'])->assertOk();
    Notification::assertSentTo($dueno, ReembolsoSolicitado::class);

    Sanctum::actingAs($dueno);
    $this->postJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", ['estado' => 'rechazado'])
        ->assertJsonValidationErrors('motivo');
    $this->postJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", ['estado' => 'rechazado', 'motivo' => 'No aparece en Nequi'])
        ->assertOk();
    expect($pedido->fresh())->reembolso_estado->toBe('rechazado')->reembolso_motivo->toBe('No aparece en Nequi');

    // Ya respondida: no se puede devolver ni volver a pedir.
    $this->postJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", ['estado' => 'devuelto', 'monto' => 14000])->assertConflict();
    Sanctum::actingAs($cliente);
    $this->postJson("/api/pedidos/{$pedido->id}/reembolso", ['cuenta' => 'Nequi 3005556677'])->assertConflict();
});

test('si el cliente no apareció, se sugiere devolver la mitad de los productos', function () {
    [$dueno, $negocio, , $pedido] = rePedido('devolviendo');
    $pedido->update(['cancelado_por' => null]);

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/devolucion")->assertOk();
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('reembolso.estado', 'solicitado')
        ->assertJsonPath('reembolso.regla_mitad', true)
        ->assertJsonPath('reembolso.monto_sugerido', 5000);
});

test('solo el cliente del pedido y el equipo del negocio tocan la devolución', function () {
    [, $negocio, , $pedido] = rePedido('cancelado');
    $otro = rePersona();

    Sanctum::actingAs($otro);
    $this->postJson("/api/pedidos/{$pedido->id}/reembolso", ['cuenta' => 'Nequi 3005556677'])->assertNotFound();
    $this->putJson("/api/pedidos/{$pedido->id}/reembolso/respuesta", ['recibido' => true])->assertNotFound();
    $this->postJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/reembolso", ['estado' => 'devuelto', 'monto' => 1000])->assertForbidden();
});
