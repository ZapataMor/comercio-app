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

test('no permite cerrar ni desactivar un comercio con pedidos en proceso', function (string $estado) {
    crearPedidoParaEstado($this, $estado);
    Sanctum::actingAs($this->dueno);
    $ruta = '/api/negocios/'.$this->negocio->id;
    $this->putJson($ruta, ['activo' => false])->assertConflict()
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'cancelarlos'));
    $this->putJson($ruta.'/desactivacion', ['desactivado' => true])->assertConflict();
    expect($this->negocio->fresh()->activo)->toBeTrue();
    expect($this->negocio->fresh()->desactivado_at)->toBeNull();
    $this->putJson($ruta, ['activo' => true])->assertOk();
})->with(Pedido::EN_CURSO);

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
