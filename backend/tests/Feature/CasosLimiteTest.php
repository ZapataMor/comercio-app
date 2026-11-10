<?php

use App\Models\Ajuste;
use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\PedidoReporte;
use App\Models\Producto;
use App\Models\User;
use App\Notifications\CitaActualizada;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\PrecioProductoActualizado;
use App\Support\PrecioCarrito;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Casos límite que dejaban pedidos, citas o cuentas en un estado sin salida:
// reintentos, cambios de precio, pedidos atascados, equipo que se va.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
});

function limPersona(string $rol = 'usuario'): User
{
    $user = User::factory()->create(['telefono' => '3001234567', 'password' => 'ClaveSegura1']);
    $user->syncRoles(User::rolesDelTipo($rol));

    return $user;
}

/** @return array{0: User, 1: Negocio, 2: Producto} */
function limNegocio(): array
{
    $dueno = limPersona();
    $horario = collect(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'])
        ->mapWithKeys(fn ($d) => [$d => ['abre' => '00:00', 'cierra' => '23:59']])->all();
    $negocio = $dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true, 'horario' => $horario]);
    $producto = $negocio->productos()->create([
        'nombre' => 'Arepa', 'precio' => 3000, 'tipo_venta' => 'cantidad', 'unidad_medida' => 'unidad', 'disponible' => true,
    ]);

    return [$dueno, $negocio, $producto];
}

function limCuerpo(Negocio $negocio, Producto $producto, array $extra = []): array
{
    return [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 2]],
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 1 # 2-3',
        'telefono_contacto' => '3001234567',
    ] + $extra;
}

/** Deja un pedido del cliente en el estado pedido, con su domiciliario si aplica. */
function limPedido(User $cliente, Negocio $negocio, string $estado, ?User $domiciliario = null): Pedido
{
    return Pedido::create([
        'negocio_id' => $negocio->id, 'user_id' => $cliente->id, 'domiciliario_id' => $domiciliario?->id,
        'estado' => $estado, 'metodo_pago' => 'efectivo', 'subtotal' => 6000, 'costo_domicilio' => 0, 'total' => 6000,
        'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '300',
        // Único por pedido: el índice no admite dos códigos vigentes iguales.
        'codigo_confirmacion' => in_array($estado, Pedido::EN_RUTA, true) ? sprintf('%04d', 4321 + Pedido::count()) : null,
        'entregado_at' => $estado === 'entregado' ? now() : null,
    ]);
}

test('un identificador que no es número responde 404 y no un error del servidor', function () {
    Sanctum::actingAs(limPersona());

    $this->getJson('/api/pedidos/abc')->assertNotFound();
    $this->postJson('/api/pedidos/abc/cancelar')->assertNotFound();
    $this->getJson('/api/pedidos/999999999999999999999999999999')->assertNotFound();
});

test('un horario con días mal nombrados se rechaza', function () {
    Sanctum::actingAs(limPersona());

    $this->postJson('/api/negocios', [
        'nombre' => 'Tienda', 'categoria' => 'Bar', 'barrio' => 'Centro',
        'horario' => ['lunes' => ['abre' => '08:00', 'cierra' => '18:00']],
    ])->assertStatus(422)->assertJsonValidationErrors('horario');

    $this->postJson('/api/negocios', [
        'nombre' => 'Tienda', 'categoria' => 'Bar', 'barrio' => 'Centro',
        'horario' => ['lun' => ['abre' => '08:00', 'cierra' => '18:00']],
    ])->assertCreated();
});

test('reintentar el mismo intento de compra devuelve el mismo pedido', function () {
    [, $negocio, $producto] = limNegocio();
    Sanctum::actingAs($cliente = limPersona());

    $cuerpo = limCuerpo($negocio, $producto, ['clave_intento' => 'intento-0001']);
    $primero = $this->postJson('/api/pedidos', $cuerpo)->assertCreated()->json('id');
    $segundo = $this->postJson('/api/pedidos', $cuerpo)->assertCreated()->json('id');

    expect($segundo)->toBe($primero);
    expect($cliente->pedidos()->count())->toBe(1);

    // Otro intento (otra clave) sí es otro pedido, y la clave es por cliente.
    $this->postJson('/api/pedidos', limCuerpo($negocio, $producto, ['clave_intento' => 'intento-0002']))->assertCreated();
    Sanctum::actingAs(limPersona());
    $this->postJson('/api/pedidos', $cuerpo)->assertCreated();
    expect(Pedido::count())->toBe(3);
});

test('si el total ya no es el que vio el cliente, el pedido no se crea hasta que lo acepte', function () {
    [, $negocio, $producto] = limNegocio();
    Ajuste::guardar(Ajuste::TARIFA_DOMICILIO, 2000);
    Sanctum::actingAs(limPersona());

    // Vio 2 x 3000 + 2000; el negocio subió el precio a 5000.
    $producto->update(['precio' => 5000]);
    $this->postJson('/api/pedidos', limCuerpo($negocio, $producto, ['total_esperado' => 8000]))
        ->assertStatus(409)
        ->assertJsonPath('codigo', 'total_cambio')
        ->assertJsonPath('total', 12000)
        ->assertJsonPath('costo_domicilio', 2000)
        ->assertJsonPath('precios.0.precio', 5000);
    expect(Pedido::count())->toBe(0);

    $this->postJson('/api/pedidos', limCuerpo($negocio, $producto, ['total_esperado' => 12000]))->assertCreated();
});

test('quien es del equipo puede pedir en su negocio pero no calificarlo ni reseñarlo', function () {
    [$dueno, $negocio, $producto] = limNegocio();
    Sanctum::actingAs($dueno);
    $this->postJson('/api/pedidos', limCuerpo($negocio, $producto))->assertCreated();
    $pedido = limPedido($dueno, $negocio, 'entregado');
    $pedido->items()->create(['producto_id' => $producto->id, 'nombre' => 'Arepa', 'precio' => 3000, 'cantidad' => 2]);
    Sanctum::actingAs($dueno);

    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertOk()->assertJsonPath('puede_calificar', false)->assertJsonPath('puede_resenar', false);
    $this->postJson("/api/pedidos/{$pedido->id}/resenas", ['tienda' => ['estrellas' => 5]])->assertStatus(409);
    $this->postJson("/api/pedidos/{$pedido->id}/calificacion", ['negocio_ok' => true])->assertStatus(409);
    expect($negocio->fresh()->resenas_total)->toBe(0);

    // Un cliente cualquiera sí puede.
    $cliente = limPersona();
    $ajeno = limPedido($cliente, $negocio, 'entregado');
    Sanctum::actingAs($cliente);
    $this->postJson("/api/pedidos/{$ajeno->id}/resenas", ['tienda' => ['estrellas' => 4]])->assertCreated();
});

test('el admin ve los pedidos en curso y cierra uno atascado en camino', function () {
    [$dueno, $negocio] = limNegocio();
    $domiciliario = limPersona('domiciliario');
    $atascado = limPedido(limPersona(), $negocio, 'en_camino', $domiciliario);
    limPedido(limPersona(), $negocio, 'entregado');

    Sanctum::actingAs($dueno);
    $this->getJson('/api/admin/pedidos')->assertForbidden();

    Sanctum::actingAs($admin = limPersona('administrador'));
    $this->getJson('/api/admin/pedidos')
        ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('pedidos.0.id', $atascado->id);
    $this->getJson('/api/admin/stats')->assertOk()->assertJsonPath('pedidos_en_curso', 1);

    $this->putJson("/api/admin/pedidos/{$atascado->id}/cerrar", ['resultado' => 'entregado'])
        ->assertStatus(422)->assertJsonValidationErrors('motivo');
    $this->putJson("/api/admin/pedidos/{$atascado->id}/cerrar", ['resultado' => 'entregado', 'motivo' => 'El cliente confirmó por teléfono'])
        ->assertOk()->assertJsonPath('pedido.estado', 'entregado');

    $atascado->refresh();
    expect($atascado->entregado_at)->not->toBeNull()
        ->and($atascado->codigo_confirmacion)->toBeNull()
        ->and($atascado->cerrado_por_admin_id)->toBe($admin->id)
        ->and($atascado->nota_admin)->toBe('El cliente confirmó por teléfono');

    // Ya terminado, no se vuelve a cerrar.
    $this->putJson("/api/admin/pedidos/{$atascado->id}/cerrar", ['resultado' => 'cancelado', 'motivo' => 'x'])->assertStatus(409);
});

test('el admin cancela un pedido en curso, pero no da por entregado uno que nadie recogió', function () {
    [, $negocio] = limNegocio();
    $pedido = limPedido(limPersona(), $negocio, 'aceptado');
    Sanctum::actingAs(limPersona('administrador'));

    $this->putJson("/api/admin/pedidos/{$pedido->id}/cerrar", ['resultado' => 'entregado', 'motivo' => 'x'])->assertStatus(409);
    $this->putJson("/api/admin/pedidos/{$pedido->id}/cerrar", ['resultado' => 'cancelado', 'motivo' => 'El negocio dejó de responder'])
        ->assertOk();

    $pedido->refresh();
    expect($pedido->estado)->toBe('cancelado')
        ->and($pedido->cancelado_por)->toBe('administrador')
        ->and($pedido->motivo_cancelacion)->toBe('El negocio dejó de responder');
});

test('no se le quita el rol a un domiciliario con entregas en curso', function () {
    [, $negocio] = limNegocio();
    $domiciliario = limPersona('domiciliario');
    $pedido = limPedido(limPersona(), $negocio, 'tomado', $domiciliario);
    Sanctum::actingAs(limPersona('administrador'));

    $this->putJson("/api/admin/usuarios/{$domiciliario->id}/rol", ['rol' => 'usuario'])->assertStatus(409);
    expect($domiciliario->fresh()->hasRole('domiciliario'))->toBeTrue();

    $pedido->update(['estado' => 'entregado']);
    $this->putJson("/api/admin/usuarios/{$domiciliario->id}/rol", ['rol' => 'usuario'])->assertOk();
});

test('no se suspende a un domiciliario que todavía lleva recogidas o entregas', function () {
    [, $negocio] = limNegocio();
    $domiciliario = limPersona('domiciliario');
    $domiciliario->forceFill(['en_turno' => true])->save();
    $sinRecoger = limPedido(limPersona(), $negocio, 'tomado', $domiciliario);
    $enCamino = limPedido(limPersona(), $negocio, 'en_camino', $domiciliario);
    Sanctum::actingAs(limPersona('administrador'));

    $this->putJson("/api/admin/usuarios/{$domiciliario->id}/suspender", ['motivo' => 'Fraude'])->assertStatus(409);
    expect($sinRecoger->fresh())->estado->toBe('tomado')->domiciliario_id->toBe($domiciliario->id);
    expect($enCamino->fresh())->estado->toBe('en_camino')->domiciliario_id->toBe($domiciliario->id);
    expect($domiciliario->fresh()->suspendido_at)->toBeNull();
    $sinRecoger->update(['estado' => 'entregado']);
    $enCamino->update(['estado' => 'entregado']);
    $this->putJson("/api/admin/usuarios/{$domiciliario->id}/suspender", ['motivo' => 'Fraude'])->assertOk();
    expect($domiciliario->fresh()->en_turno)->toBeFalse();
});

test('el dueño no elimina su cuenta con pedidos en curso en su negocio', function () {
    [$dueno, $negocio] = limNegocio();
    $pedido = limPedido(limPersona(), $negocio, 'aceptado');
    Sanctum::actingAs($dueno);

    $this->deleteJson('/api/cuenta', ['password' => 'ClaveSegura1'])
        ->assertStatus(409)->assertJsonPath('message', 'Tienda tiene pedidos en curso. Termínalos o cancélalos antes de eliminar tu cuenta.');
    expect($negocio->fresh()->archivado_at)->toBeNull();

    $pedido->update(['estado' => 'entregado']);
    $this->deleteJson('/api/cuenta', ['password' => 'ClaveSegura1'])->assertOk();
    expect($negocio->fresh()->archivado_at)->not->toBeNull();
});

test('las citas se reasignan antes de quitar a un trabajador y se avisa al cliente', function () {
    [$dueno, $negocio] = limNegocio();
    $trabajador = limPersona();
    $negocio->miembros()->attach($trabajador->id, ['rol' => Negocio::ROL_TRABAJADOR, 'activo' => true]);
    $cliente = limPersona();
    $cita = fn (User $profesional, string $estado, $inicio) => Cita::create([
        'negocio_id' => $negocio->id, 'servicio_nombre' => 'Corte', 'cliente_id' => $cliente->id, 'cliente_nombre' => 'Cliente',
        'profesional_id' => $profesional->id, 'origen' => 'app', 'estado' => $estado,
        'inicio' => $inicio, 'fin' => $inicio->copy()->addMinutes(30), 'confirmar_antes_de' => now()->addHour(),
    ]);
    $confirmada = $cita($trabajador, 'confirmada', now()->addDays(2));
    $pendiente = $cita($trabajador, 'pendiente', now()->addDays(3));
    $pasada = $cita($trabajador, 'confirmada', now()->subDay());
    $delDueno = $cita($dueno, 'confirmada', now()->addDays(5));

    Sanctum::actingAs($dueno);
    $this->deleteJson("/api/negocios/{$negocio->id}/miembros/{$trabajador->id}")->assertStatus(409);
    $this->putJson("/api/negocios/{$negocio->id}/citas/{$confirmada->id}/reasignar", ['profesional_id' => $dueno->id])->assertOk();
    $this->putJson("/api/negocios/{$negocio->id}/citas/{$pendiente->id}/reasignar", ['profesional_id' => $dueno->id])->assertOk();
    $this->deleteJson("/api/negocios/{$negocio->id}/miembros/{$trabajador->id}")->assertOk();

    expect($confirmada->fresh())->estado->toBe('confirmada')->profesional_id->toBe($dueno->id);
    expect($pendiente->fresh()->estado)->toBe('pendiente');
    Notification::assertSentTo($cliente, CitaActualizada::class, fn ($n) => $n->reasignada);
    expect($pasada->fresh()->estado)->toBe('confirmada');
    expect($delDueno->fresh()->estado)->toBe('confirmada');
});

test('cambiar la contraseña cierra las demás sesiones y conserva la actual', function () {
    $user = limPersona();
    $otra = $user->createToken('api')->plainTextToken;
    $actual = $user->createToken('api')->plainTextToken;

    $this->withToken($actual)->putJson('/api/perfil', [
        'name' => 'Ana', 'email' => $user->email, 'direccion' => 'Calle 1', 'barrio' => 'Centro', 'telefono' => '3001234567',
        'password' => 'OtraClave22', 'password_confirmation' => 'OtraClave22', 'password_actual' => 'ClaveSegura1',
    ])->assertOk();

    expect($user->tokens()->count())->toBe(1);
    $this->withToken($actual)->getJson('/api/user')->assertOk();
    app('auth')->forgetGuards();
    $this->withToken($otra)->getJson('/api/user')->assertUnauthorized();
});

test('cliente ausente requiere cinco minutos desde la llegada y confirmación de devolución del comercio', function () {
    [$dueno, $negocio] = limNegocio();
    $cliente = limPersona();
    $domiciliario = limPersona('domiciliario');
    $pedido = limPedido($cliente, $negocio, 'en_camino', $domiciliario);
    $ruta = "/api/domiciliario/pedidos/{$pedido->id}";
    Sanctum::actingAs($otro = limPersona('domiciliario'));
    $this->putJson($ruta.'/llegada')->assertStatus(409);
    Sanctum::actingAs($domiciliario);
    $this->putJson($ruta.'/cliente-no-encontrado')->assertStatus(409);
    $this->putJson($ruta.'/llegada')->assertOk();
    $llegada = $pedido->fresh()->llegada_at;
    $this->travel(4)->minutes();
    $this->putJson($ruta.'/llegada')->assertOk();
    expect($pedido->fresh()->llegada_at->eq($llegada))->toBeTrue();
    $this->putJson($ruta.'/cliente-no-encontrado')->assertStatus(409);
    $this->travel(1)->minutes();
    $this->putJson($ruta.'/cliente-no-encontrado')->assertOk();
    $this->putJson($ruta.'/cliente-no-encontrado')->assertStatus(409);
    expect($pedido->fresh())->estado->toBe('devolviendo')->codigo_confirmacion->toBeNull()->cancelado_at->toBeNull();
    Notification::assertSentTo($cliente, EstadoPedidoActualizado::class, fn ($n) => $n->texto[0] === 'Cliente no encontrado');
    Notification::assertSentTo($dueno, EstadoPedidoActualizado::class);
    $this->deleteJson('/api/perfil/domiciliario')->assertStatus(409);
    $this->getJson('/api/domiciliario/entregas')->assertJsonPath('pedidos.0.estado', 'devolviendo');
    Sanctum::actingAs($cliente);
    $this->postJson("/api/pedidos/{$pedido->id}/cancelar")->assertStatus(409);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/devolucion")->assertForbidden();
    Sanctum::actingAs(limPersona('administrador'));
    $this->getJson('/api/admin/reportes')->assertOk()->assertJsonPath('reportes.0.objetivo', 'cliente')->assertJsonPath('total', 1);
    $this->putJson("/api/admin/pedidos/{$pedido->id}/cerrar", ['resultado' => 'cancelado', 'motivo' => 'Cierre manual'])->assertStatus(409);
    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/devolucion")->assertOk();
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/devolucion")->assertStatus(409);
    expect($pedido->fresh())->estado->toBe('cancelado')->devolucion_confirmada_por->toBe($dueno->id);
    expect($pedido->fresh()->devuelto_at)->not->toBeNull();
    Sanctum::actingAs($domiciliario);
    $this->getJson('/api/domiciliario/entregas')->assertJsonCount(0, 'pedidos');
    $this->deleteJson('/api/perfil/domiciliario')->assertOk();
});

test('el cliente cancela antes de en camino y un pedido recogido se devuelve', function () {
    [$dueno, $negocio] = limNegocio();
    $cliente = limPersona();
    $domiciliario = limPersona('domiciliario');
    foreach (['listo', 'tomado', 'recogido', 'en_camino'] as $estado) {
        $pedido = limPedido($cliente, $negocio, $estado, $estado === 'listo' ? null : $domiciliario);
        Sanctum::actingAs($cliente);
        $respuesta = $this->postJson("/api/pedidos/{$pedido->id}/cancelar", ['motivo' => 'Ya no puedo recibirlo']);
        if ($estado === 'en_camino') {
            $respuesta->assertStatus(409);
            expect($pedido->fresh()->estado)->toBe('en_camino');
        } else {
            $respuesta->assertOk();
            expect($pedido->fresh()->estado)->toBe($estado === 'recogido' ? 'devolviendo' : 'cancelado');
        }
    }
});

test('el comercio escribe el motivo antes de cancelar y no puede cancelar después de listo', function () {
    [$dueno, $negocio] = limNegocio();
    $pedido = limPedido(limPersona(), $negocio, 'aceptado');
    Sanctum::actingAs($dueno);
    $ruta = "/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/cancelar";
    $this->putJson($ruta)->assertUnprocessable()->assertJsonValidationErrors('motivo');
    $this->putJson($ruta, ['motivo' => '   '])->assertUnprocessable();
    $this->putJson($ruta, ['motivo' => 'Se agotó el producto'])->assertOk();
    expect($pedido->fresh()->motivo_cancelacion)->toBe('Se agotó el producto');
    expect(PedidoReporte::where('pedido_id', $pedido->id)->first()->objetivo)->toBe('negocio');
});

test('un faltante espera la elección del cliente sin cambiar los productos unilateralmente', function () {
    [$dueno, $negocio, $producto] = limNegocio();
    $cliente = limPersona();
    $pedido = limPedido($cliente, $negocio, 'aceptado');
    $pedido->items()->create(['producto_id' => $producto->id, 'nombre' => $producto->nombre, 'precio' => 3000, 'cantidad' => 2]);
    $alternativa = $negocio->productos()->create(['nombre' => 'Otra arepa', 'precio' => 4500, 'disponible' => true]);
    $ruta = "/api/negocios/{$negocio->id}/pedidos/{$pedido->id}";
    Sanctum::actingAs($dueno);
    $this->putJson($ruta.'/faltante', ['motivo' => 'Se agotó el queso. Puedes elegir la arepa sencilla.'])->assertOk();
    $versionAnterior = $pedido->fresh()->faltante_version;
    $this->putJson($ruta.'/faltante', ['motivo' => 'Se agotó también el jamón. Puedes elegir otra arepa.'])->assertOk();
    $version = $pedido->fresh()->faltante_version;
    expect($version)->not->toBe($versionAnterior);
    $this->putJson($ruta.'/listo')->assertStatus(409);
    expect($pedido->fresh()->total)->toBe('6000.00');
    Sanctum::actingAs(limPersona());
    $cuerpo = ['items' => [['producto_id' => $alternativa->id, 'cantidad' => 1]], 'total_esperado' => 4500, 'faltante_version' => $version];
    $this->putJson("/api/pedidos/{$pedido->id}/ajuste", $cuerpo)->assertNotFound();
    Sanctum::actingAs($cliente);
    $this->putJson("/api/pedidos/{$pedido->id}/ajuste", array_replace($cuerpo, ['faltante_version' => $versionAnterior]))->assertStatus(409);
    $this->putJson("/api/pedidos/{$pedido->id}/ajuste", array_replace($cuerpo, ['total_esperado' => 4000]))->assertStatus(409);
    $this->putJson("/api/pedidos/{$pedido->id}/ajuste", $cuerpo)->assertOk();
    expect($pedido->fresh())->faltante_motivo->toBeNull()->total->toBe('4500.00');
    expect($pedido->items()->sole()->producto_id)->toBe($alternativa->id);
    $this->putJson("/api/pedidos/{$pedido->id}/ajuste", $cuerpo)->assertStatus(409);
    Sanctum::actingAs($dueno);
    $this->putJson($ruta.'/listo')->assertOk();
});

test('el precio reservado del carrito dura una hora y no se puede alterar ni prestar a otro cliente', function () {
    [, $negocio, $producto] = limNegocio();
    Ajuste::guardar(Ajuste::TARIFA_DOMICILIO, 0);
    $cliente = limPersona();
    $reserva = PrecioCarrito::cotizar($producto, $cliente->id);
    $producto->update(['precio' => 99000]);
    $cuerpo = array_replace(limCuerpo($negocio, $producto), ['items' => [['producto_id' => $producto->id, 'cantidad' => 2, 'precio_token' => $reserva['precio_token']]], 'total_esperado' => 6000]);
    Sanctum::actingAs(limPersona());
    $this->postJson('/api/pedidos', $cuerpo)->assertUnprocessable();
    Sanctum::actingAs($cliente);
    $alterado = $cuerpo;
    $alterado['items'][0]['precio_token'] = 'precio-falsificado';
    $this->postJson('/api/pedidos', $alterado)->assertUnprocessable();
    $id = $this->postJson('/api/pedidos', $cuerpo)->assertCreated()->json('id');
    expect(Pedido::find($id)->total)->toBe('6000.00');
    expect(Pedido::find($id)->items()->sole()->precio)->toBe('3000.00');
    $this->travel(1)->hours();
    $this->postJson('/api/pedidos', $cuerpo)->assertUnprocessable();
    expect(Pedido::count())->toBe(1);
});

test('el cliente recibe un aviso si cambia el precio de un producto de su carrito vigente', function () {
    [$dueno, $negocio, $producto] = limNegocio();
    $cliente = limPersona();
    Sanctum::actingAs($cliente);
    $catalogo = $this->getJson("/api/negocios/{$negocio->id}")->assertOk();
    $token = $catalogo->json('productos.0.precio_token');
    expect($token)->toBeString();
    $this->putJson('/api/carrito', ['items' => [['producto_id' => $producto->id, 'precio_token' => $token]], 'vence_at' => now()->addHour()->timestamp])->assertOk();
    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/productos/{$producto->id}", ['precio' => 5000])->assertOk();
    Notification::assertSentTo($cliente, PrecioProductoActualizado::class);
    Notification::fake();
    $this->travel(1)->hours();
    $this->putJson("/api/negocios/{$negocio->id}/productos/{$producto->id}", ['precio' => 6000])->assertOk();
    Notification::assertNotSentTo($cliente, PrecioProductoActualizado::class);
});

test('el negocio no se elimina con pedidos activos y desaparece al borrarlo definitivamente', function () {
    [$dueno, $negocio] = limNegocio();
    $pedido = limPedido(limPersona(), $negocio, 'aceptado');
    Sanctum::actingAs($dueno);
    $this->deleteJson("/api/negocios/{$negocio->id}")->assertStatus(409);
    $pedido->update(['estado' => 'cancelado']);
    $this->deleteJson("/api/negocios/{$negocio->id}")->assertOk();
    $this->getJson('/api/negocios/mios')->assertJsonCount(0, 'negocios');
    $this->getJson("/api/negocios/{$negocio->id}")->assertNotFound();
    $this->putJson("/api/negocios/{$negocio->id}", ['nombre' => 'Reabierto'])->assertNotFound();
});

test('los reportes requieren participación en el pedido y solo el administrador los resuelve', function () {
    [$dueno, $negocio] = limNegocio();
    $cliente = limPersona();
    $pedido = limPedido($cliente, $negocio, 'aceptado');
    $cuerpo = ['objetivo' => 'negocio', 'motivo' => 'El comercio dejó de responder.'];
    Sanctum::actingAs(limPersona());
    $this->postJson("/api/pedidos/{$pedido->id}/reporte", $cuerpo)->assertForbidden();
    Sanctum::actingAs($dueno);
    $this->postJson("/api/pedidos/{$pedido->id}/reporte", $cuerpo)->assertUnprocessable();
    Sanctum::actingAs($cliente);
    $id = $this->postJson("/api/pedidos/{$pedido->id}/reporte", $cuerpo)->assertCreated()->json('id');
    $this->postJson("/api/pedidos/{$pedido->id}/reporte", $cuerpo)->assertJsonPath('id', $id);
    $this->getJson('/api/admin/reportes')->assertForbidden();
    $this->putJson("/api/admin/reportes/{$id}/resolver", ['resolucion' => 'Se revisó el caso.'])->assertForbidden();
    Sanctum::actingAs(limPersona('administrador'));
    $this->getJson('/api/admin/reportes')->assertJsonPath('total', 1);
    $this->putJson("/api/admin/reportes/{$id}/resolver", ['resolucion' => 'Se revisó el caso con ambas partes.'])->assertOk();
    $this->getJson('/api/admin/reportes')->assertJsonPath('total', 0);
    $this->getJson('/api/admin/reportes?estado=resueltos')->assertJsonPath('total', 1);
    $this->putJson("/api/admin/reportes/{$id}/resolver", ['resolucion' => 'Otra resolución'])->assertStatus(409);
});

test('la no aceptación de un pedido aparece en los reportes del administrador', function () {
    [, $negocio] = limNegocio();
    $pedido = limPedido(limPersona(), $negocio, 'pendiente');
    $this->travel(6)->minutes();
    $this->artisan('pedidos:vencer')->assertSuccessful();
    Sanctum::actingAs(limPersona('administrador'));
    $this->getJson('/api/admin/reportes')->assertJsonPath('reportes.0.tipo', 'sin_aceptar')->assertJsonPath('reportes.0.pedido_id', $pedido->id);
});

test('cambiar la clave también cierra las sesiones web guardadas de ese usuario', function () {
    $usuario = limPersona();
    $otraPersona = limPersona();
    $token = $usuario->createToken('actual')->plainTextToken;
    \Illuminate\Support\Facades\DB::table('sessions')->insert([
        ['id' => 'equipo-anterior', 'user_id' => $usuario->id, 'payload' => base64_encode(serialize([])), 'last_activity' => time()],
        ['id' => 'sesion-ajena', 'user_id' => $otraPersona->id, 'payload' => base64_encode(serialize([])), 'last_activity' => time()],
    ]);
    config(['session.driver' => 'database']);
    $this->withToken($token)->putJson('/api/perfil', [
        'name' => 'Ana', 'email' => $usuario->email, 'direccion' => 'Calle 1', 'barrio' => 'Centro', 'telefono' => '3001234567',
        'password' => 'OtraClave22', 'password_confirmation' => 'OtraClave22', 'password_actual' => 'ClaveSegura1',
    ])->assertOk();
    $this->assertDatabaseMissing('sessions', ['id' => 'equipo-anterior']);
    $this->assertDatabaseHas('sessions', ['id' => 'sesion-ajena']);
    expect($usuario->tokens()->count())->toBe(1);
});

test('el panel web del administrador muestra reportes y guarda su resolución', function () {
    [, $negocio] = limNegocio();
    $pedido = limPedido(limPersona(), $negocio, 'aceptado');
    $reporte = \App\Models\PedidoReporte::registrar($pedido, 'negocio', 'reporte_usuario', 'El comercio dejó de atender el pedido.');
    $this->actingAs(limPersona('administrador'));
    $this->get('/admin/reportes')->assertOk()->assertSee('El comercio dejó de atender el pedido.');
    $this->put("/admin/reportes/{$reporte->id}/resolver", ['resolucion' => 'Se verificó lo ocurrido con las partes.'])->assertRedirect();
    expect($reporte->fresh()->resuelto_at)->not->toBeNull();
});
