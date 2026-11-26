<?php

use App\Models\Pedido;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->dueno = User::factory()->create();
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $this->cliente = User::factory()->create();
    Role::findOrCreate('domiciliario', 'web');
    $this->domi = User::factory()->create(['en_turno' => true]);
    $this->domi->assignRole('domiciliario');
});

function crearPedidoParaEstado($test, string $estado): Pedido
{
    return $test->negocio->pedidos()->create([
        'user_id' => $test->cliente->id, 'domiciliario_id' => $test->domi->id,
        'estado' => $estado, 'metodo_pago' => 'efectivo', 'total' => 1000,
        'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567',
    ]);
}

test('no permite cerrar ni desactivar un comercio con pedidos que aún lo necesitan', function (string $estado) {
    $pedido = crearPedidoParaEstado($this, $estado);
    Sanctum::actingAs($this->dueno);
    $ruta = '/api/negocios/'.$this->negocio->id;
    // El mensaje dice cuál pedido es.
    $this->putJson($ruta, ['activo' => false])->assertConflict()
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'cerrar la tienda') && str_contains($m, $pedido->fresh()->codigo));
    $this->putJson($ruta.'/desactivacion', ['desactivado' => true])->assertConflict();
    expect($this->negocio->fresh()->activo)->toBeTrue();
    expect($this->negocio->fresh()->desactivado_at)->toBeNull();
    $this->putJson($ruta, ['activo' => true])->assertOk();
})->with(Pedido::NECESITAN_TIENDA);

test('la tienda puede cerrar mientras el domiciliario ya lleva el pedido, pero no desactivarse', function (string $estado) {
    $pedido = crearPedidoParaEstado($this, $estado);
    Sanctum::actingAs($this->dueno);
    $ruta = '/api/negocios/'.$this->negocio->id;
    $this->putJson($ruta, ['activo' => false])->assertOk();
    expect($this->negocio->fresh()->activo)->toBeFalse();
    $this->putJson($ruta.'/desactivacion', ['desactivado' => true])->assertConflict()
        ->assertJsonPath('message', fn ($m) => str_contains($m, $pedido->fresh()->codigo) && str_contains($m, 'lo entregue'));
})->with(['recogido', 'en_camino']);

test('con varios pedidos pendientes los nombra', function () {
    $a = crearPedidoParaEstado($this, 'pendiente');
    $b = crearPedidoParaEstado($this, 'listo');
    Sanctum::actingAs($this->dueno);
    $this->putJson('/api/negocios/'.$this->negocio->id, ['activo' => false])->assertConflict()
        ->assertJsonPath('message', fn ($m) => str_contains($m, '2 pedidos') && str_contains($m, $a->fresh()->codigo) && str_contains($m, $b->fresh()->codigo));
});

test('no permite salir de turno con entregas en proceso', function (string $estado) {
    crearPedidoParaEstado($this, $estado);
    Sanctum::actingAs($this->domi);
    $this->putJson('/api/domiciliario/turno', ['en_turno' => false])->assertConflict()
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'domicilios en proceso'));
    expect($this->domi->fresh()->en_turno)->toBeTrue();
    $this->putJson('/api/domiciliario/turno', ['en_turno' => true])->assertOk();
})->with(Pedido::EN_RUTA);

test('permite cerrar desactivar y salir de turno cuando el pedido termina', function (string $estado) {
    $pedido = crearPedidoParaEstado($this, 'tomado');
    Sanctum::actingAs($this->domi);
    $this->putJson('/api/domiciliario/turno', ['en_turno' => false])->assertConflict();
    $pedido->update(['estado' => $estado]);
    $this->putJson('/api/domiciliario/turno', ['en_turno' => false])->assertOk();
    expect($this->domi->fresh()->en_turno)->toBeFalse();
    Sanctum::actingAs($this->dueno);
    $ruta = '/api/negocios/'.$this->negocio->id;
    $this->putJson($ruta, ['activo' => false])->assertOk();
    $this->putJson($ruta.'/desactivacion', ['desactivado' => true])->assertOk();
    expect($this->negocio->fresh()->activo)->toBeFalse();
})->with(['cancelado', 'entregado']);
