<?php

use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Notification::fake();
    $this->dueno = User::factory()->create();
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Tienda']);
    $this->empleado = User::factory()->create();
    $this->permisos = array_fill_keys(Negocio::PERMISOS, false);
    $this->negocio->miembros()->attach($this->empleado->id, [
        'rol' => 'trabajador', 'activo' => true, ...$this->permisos,
    ]);
    $this->url = '/api/negocios/'.$this->negocio->id;
});

test('la invitacion guarda los permisos elegidos y los aplica al aceptar', function () {
    $invitado = User::factory()->create();
    $permisos = [...$this->permisos, 'modificar_inventario' => true, 'cambiar_estado' => true];
    Sanctum::actingAs($this->dueno);
    $this->postJson($this->url.'/invitar', ['codigo' => $invitado->codigo_publico, 'permisos' => $permisos])->assertCreated();
    expect($this->negocio->esMiembroActivo($invitado))->toBeFalse();
    $invitacion = InvitacionTrabajo::where('user_id', $invitado->id)->firstOrFail();
    Sanctum::actingAs($invitado);
    $this->putJson('/api/invitaciones/'.$invitacion->id.'/aceptar')->assertOk();
    expect($this->negocio->permisosPara($invitado))->toBe($permisos);
    $this->getJson('/api/negocios/mios')->assertJsonPath('negocios.0.permisos', $permisos);
    $this->putJson('/api/invitaciones/'.$invitacion->id.'/aceptar')->assertNotFound();
});

test('sin permisos puede ver ventas y equipo pero no catalogo ni flujo de pedidos', function () {
    Sanctum::actingAs($this->empleado);
    $this->getJson($this->url.'/pedidos/resumen')->assertOk()->assertJsonPath('ventas', 0);
    $this->getJson($this->url.'/miembros')->assertOk();
    $this->getJson('/api/negocios/mios/por-aceptar')->assertOk()->assertJsonCount(0, 'pedidos');
    foreach (['productos', 'categorias', 'pedidos', 'pedidos/1'] as $ruta) {
        $this->getJson($this->url.'/'.$ruta)->assertForbidden();
    }
    foreach (['productos', 'servicios', 'categorias'] as $ruta) {
        $this->postJson($this->url.'/'.$ruta, [])->assertForbidden();
        $this->putJson($this->url.'/'.$ruta.'/1', [])->assertForbidden();
        $this->deleteJson($this->url.'/'.$ruta.'/1')->assertForbidden();
    }
    foreach (['aceptar', 'cancelar', 'listo', 'recogido', 'dinero', 'faltante', 'devolucion'] as $accion) {
        $this->putJson($this->url.'/pedidos/1/'.$accion, [])->assertForbidden();
    }
    $this->putJson($this->url, ['activo' => false])->assertForbidden();
    $this->postJson($this->url.'/invitar', ['codigo' => $this->dueno->codigo_publico])->assertForbidden();
    $this->putJson($this->url.'/miembros/'.$this->empleado->id.'/permisos', ['permisos' => [...$this->permisos, 'administrador' => true]])->assertForbidden();
});

test('inventario permite borrar productos y servicios sin otorgar manejo de pedidos', function () {
    $this->negocio->miembros()->updateExistingPivot($this->empleado->id, ['modificar_inventario' => true]);
    $producto = $this->negocio->productos()->create(['nombre' => 'Pan', 'precio' => 1000, 'tipo_venta' => 'cantidad', 'unidad_medida' => 'unidad']);
    $servicio = $this->negocio->servicios()->create(['nombre' => 'Corte', 'descripcion' => 'Corte de cabello', 'duracion_minutos' => 30]);
    Sanctum::actingAs($this->empleado);
    $this->deleteJson($this->url.'/productos/'.$producto->id)->assertSuccessful();
    $this->deleteJson($this->url.'/servicios/'.$servicio->id)->assertSuccessful();
    $this->getJson($this->url.'/pedidos')->assertForbidden();
    $this->putJson($this->url, ['nombre' => 'Otra tienda'])->assertForbidden();
});

test('abrir y cerrar no permite cambiar otros datos ni conseguir rol de propietario', function () {
    $this->negocio->miembros()->updateExistingPivot($this->empleado->id, ['cambiar_estado' => true]);
    Sanctum::actingAs($this->empleado);
    $this->putJson($this->url, ['activo' => false])->assertOk()
        ->assertJsonPath('negocio.activo', false)->assertJsonPath('negocio.rol', 'trabajador');
    $this->putJson($this->url, ['activo' => true, 'nombre' => 'Cambio'])->assertForbidden();
    $this->putJson($this->url, ['activo' => true, 'user_id' => $this->empleado->id])->assertForbidden();
    expect($this->negocio->fresh()->nombre)->toBe('Tienda');
});

test('administrador edita negocio y equipo pero nunca al propietario ni otro negocio', function () {
    $this->negocio->miembros()->updateExistingPivot($this->empleado->id, ['administrador' => true]);
    $otro = User::factory()->create();
    $this->negocio->miembros()->attach($otro->id, ['rol' => 'trabajador', 'activo' => true]);
    Sanctum::actingAs($this->empleado);
    $this->putJson($this->url, ['nombre' => 'Nuevo nombre'])->assertOk()->assertJsonPath('negocio.rol', 'trabajador');
    $this->getJson($this->url.'/productos')->assertOk();
    $this->getJson($this->url.'/pedidos')->assertOk();
    $this->putJson($this->url.'/miembros/'.$otro->id.'/permisos', ['permisos' => $this->permisos])->assertOk();
    $this->deleteJson($this->url.'/miembros/'.$otro->id)->assertOk();
    $this->putJson($this->url.'/miembros/'.$this->dueno->id.'/permisos', ['permisos' => $this->permisos])->assertUnprocessable();
    $this->deleteJson($this->url.'/miembros/'.$this->dueno->id)->assertUnprocessable();
    expect($this->negocio->esPropietario($this->dueno))->toBeTrue();
    $ajeno = User::factory()->create()->negocio()->create(['nombre' => 'Ajeno']);
    $this->putJson('/api/negocios/'.$ajeno->id, ['nombre' => 'Cambio'])->assertForbidden();
    $this->putJson('/api/negocios/'.$ajeno->id.'/miembros/'.$ajeno->user_id.'/permisos', ['permisos' => $this->permisos])->assertForbidden();
});

test('el propietario puede conceder y revocar los permisos con efecto inmediato', function () {
    Sanctum::actingAs($this->dueno);
    $url = $this->url.'/miembros/'.$this->empleado->id.'/permisos';
    $this->putJson($url, ['permisos' => [...$this->permisos, 'gestionar_pedidos' => true]])->assertOk();
    Sanctum::actingAs($this->empleado);
    $this->getJson($this->url.'/pedidos')->assertOk();
    Sanctum::actingAs($this->dueno);
    $this->putJson($url, ['permisos' => $this->permisos])->assertOk();
    $this->putJson($url, ['permisos' => [...$this->permisos, 'propietario' => true]])->assertUnprocessable();
    Sanctum::actingAs($this->empleado);
    $this->getJson($this->url.'/pedidos')->assertForbidden();
    $this->negocio->miembros()->updateExistingPivot($this->empleado->id, ['administrador' => true, 'activo' => false]);
    $this->getJson($this->url.'/pedidos')->assertForbidden();
});

test('el vencimiento resta cinco puntos una sola vez y no afecta pedidos recientes o aceptados', function () {
    $cliente = User::factory()->create();
    $datos = ['user_id' => $cliente->id, 'estado' => 'pendiente', 'metodo_pago' => 'efectivo', 'total' => 1000, 'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567'];
    $vencido = $this->negocio->pedidos()->create($datos);
    $vencido->forceFill(['created_at' => now()->subMinutes(6)])->save();
    $reciente = $this->negocio->pedidos()->create($datos);
    $aceptado = $this->negocio->pedidos()->create([...$datos, 'estado' => 'aceptado']);
    $aceptado->forceFill(['created_at' => now()->subMinutes(10)])->save();
    $this->artisan('pedidos:vencer')->assertSuccessful();
    $this->artisan('pedidos:vencer')->assertSuccessful();
    expect($this->negocio->fresh()->reputacion)->toBe(75)
        ->and($vencido->fresh()->estado)->toBe('cancelado')
        ->and($reciente->fresh()->estado)->toBe('pendiente')
        ->and($aceptado->fresh()->estado)->toBe('aceptado');
    $this->assertDatabaseCount('reputacion_eventos', 1);
    $this->assertDatabaseHas('reputacion_eventos', ['pedido_id' => $vencido->id, 'motivo' => 'pedido_vencido', 'puntos' => -5]);
});
