<?php

use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('usuario', 'web');
    Role::findOrCreate('domiciliario', 'web');
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
    $this->dueno = User::factory()->create();
    $this->dueno->assignRole('usuario');
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $this->domi = User::factory()->create(['reputacion_domiciliario' => 69]);
    $this->domi->assignRole('domiciliario');
    $base = ['user_id' => User::factory()->create()->id, 'metodo_pago' => 'efectivo',
        'subtotal' => 10000, 'costo_domicilio' => 4000, 'total' => 14000,
        'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567'];
    $this->deuda = $this->negocio->pedidos()->create([...$base, 'estado' => 'entregado',
        'domiciliario_id' => $this->domi->id, 'recogido_at' => now()->subDays(10), 'entregado_at' => now()->subDays(10)]);
    $this->nuevo = $this->negocio->pedidos()->create([...$base, 'estado' => 'listo']);
    Sanctum::actingAs($this->domi);
});

test('69 puntos bloquean nuevas entregas por deuda incluso antigua', function () {
    $this->getJson('/api/domiciliario/disponibles')->assertOk()->assertJsonPath('bloqueado_por_efectivo', true)->assertJsonCount(0, 'pedidos');
    $this->getJson('/api/domiciliario/entregas')->assertOk()->assertJsonPath('pedidos.0.efectivo_pendiente', true);
    $this->putJson("/api/domiciliario/pedidos/{$this->nuevo->id}/tomar", ['minutos_recogida' => 5])->assertStatus(409);
    $this->putJson("/api/domiciliario/pedidos/{$this->deuda->id}/ocupado")->assertForbidden();
});

test('desde 70 puntos permite seguir y avisar solo al negocio una vez', function (int $puntos) {
    $this->domi->forceFill(['reputacion_domiciliario' => $puntos])->save();
    $this->putJson("/api/domiciliario/pedidos/{$this->nuevo->id}/tomar", ['minutos_recogida' => 5])->assertOk();
    Notification::fake();
    $this->putJson("/api/domiciliario/pedidos/{$this->deuda->id}/ocupado")->assertOk();
    Notification::assertSentTo($this->dueno, EstadoPedidoActualizado::class);
    Notification::assertNotSentTo($this->deuda->cliente, EstadoPedidoActualizado::class);
    $this->putJson("/api/domiciliario/pedidos/{$this->deuda->id}/ocupado")->assertStatus(409);
    expect($this->deuda->fresh()->dinero_estado)->toBeNull();
})->with([70, 100]);

test('liquidar una deuda reportada desbloquea al domiciliario', function () {
    $this->deuda->update(['dinero_estado' => 'incompleto']);
    Sanctum::actingAs($this->dueno);
    $this->putJson("/api/negocios/{$this->negocio->id}/pedidos/{$this->deuda->id}/dinero", ['estado' => 'recibido'])->assertOk();
    Sanctum::actingAs($this->domi->fresh());
    $this->getJson('/api/domiciliario/entregas')->assertJsonCount(0, 'pedidos');
    $this->putJson("/api/domiciliario/pedidos/{$this->nuevo->id}/tomar", ['minutos_recogida' => 5])->assertOk();
});

test('no permite avisar por otro domiciliario ni sin deuda', function () {
    $this->domi->forceFill(['reputacion_domiciliario' => 70])->save();
    $this->deuda->update(['domiciliario_id' => User::factory()->create()->id]);
    $this->putJson("/api/domiciliario/pedidos/{$this->deuda->id}/ocupado")->assertNotFound();
    $this->deuda->update(['domiciliario_id' => $this->domi->id, 'dinero_estado' => 'recibido']);
    $this->putJson("/api/domiciliario/pedidos/{$this->deuda->id}/ocupado")->assertStatus(409);
    $this->putJson("/api/domiciliario/pedidos/{$this->nuevo->id}/tomar", ['minutos_recogida' => 5])->assertOk();
});
