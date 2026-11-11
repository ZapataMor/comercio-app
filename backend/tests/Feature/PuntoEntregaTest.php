<?php

use App\Models\ClienteDireccion;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\User;
use App\Support\TiempoEntrega;
use App\Support\UbicacionDomiciliario;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Punto de entrega: el cliente fija su dirección en el mapa, el pedido se lo
// lleva copiado y con él se estima en cuánto llega el domiciliario.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
});

function puntoPersona(string $rol = 'usuario'): User
{
    $user = User::factory()->create(['telefono' => '3001234567']);
    $user->assignRole($rol);

    return $user;
}

function puntoDireccion(User $cliente, array $datos = []): ClienteDireccion
{
    return $cliente->clienteDirecciones()->create($datos + [
        'fotos' => ['frente' => 'frente.jpg', 'izquierda' => 'izquierda.jpg', 'derecha' => 'derecha.jpg'],
        'direccion' => 'Calle 12 # 10-25', 'barrio' => 'Centro', 'lat' => 11.3790, 'lng' => -72.2400,
    ]);
}

/** @return array{0: Negocio, 1: Producto} */
function puntoNegocio(): array
{
    $horario = collect(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'])
        ->mapWithKeys(fn ($d) => [$d => ['abre' => '00:00', 'cierra' => '23:59']])->all();
    $negocio = puntoPersona()->negocio()->create(['nombre' => 'Tienda', 'activo' => true, 'horario' => $horario]);
    $producto = $negocio->productos()->create([
        'nombre' => 'Arepa', 'precio' => 3000, 'tipo_venta' => 'cantidad', 'unidad_medida' => 'unidad', 'disponible' => true,
    ]);

    return [$negocio, $producto];
}

function puntoCuerpo(Negocio $negocio, Producto $producto, array $extra = []): array
{
    return [
        'negocio_id' => $negocio->id,
        'items' => [['producto_id' => $producto->id, 'cantidad' => 1]],
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 12 # 10-25',
        'telefono_contacto' => '3001234567',
    ] + $extra;
}

/** Pedido que ya va en camino con ese domiciliario. */
function puntoPedidoEnCamino(User $cliente, User $domiciliario, array $extra = []): Pedido
{
    [$negocio] = puntoNegocio();

    return Pedido::create($extra + [
        'negocio_id' => $negocio->id, 'user_id' => $cliente->id, 'domiciliario_id' => $domiciliario->id,
        'estado' => 'en_camino', 'metodo_pago' => 'efectivo', 'subtotal' => 3000, 'costo_domicilio' => 0, 'total' => 3000,
        'direccion_entrega' => 'Calle 12 # 10-25', 'telefono_contacto' => '3001234567', 'codigo_confirmacion' => '4321',
        'entrega_lat' => 11.3790, 'entrega_lng' => -72.2400,
    ]);
}

// ---------------------------------------------------------------------------
// La dirección guarda su punto
// ---------------------------------------------------------------------------

test('el cliente guarda una dirección con su punto en el mapa', function () {
    Sanctum::actingAs(puntoPersona());

    $this->postJson('/api/cliente/direcciones', [...fotosReferenciaPrueba(),
        'direccion' => 'Calle 12 # 10-25', 'barrio' => 'Centro', 'lat' => 11.379, 'lng' => -72.24,
    ])->assertCreated()
        ->assertJsonPath('direccion.lat', 11.379)
        ->assertJsonPath('direccion.lng', -72.24);
});

test('la dirección exige un punto en el mapa', function () {
    Sanctum::actingAs(puntoPersona());

    $this->postJson('/api/cliente/direcciones', ['direccion' => 'Calle 12 # 10-25', 'barrio' => 'Centro'])
        ->assertUnprocessable()->assertJsonValidationErrors(['lat', 'lng']);
});

test('el punto necesita latitud y longitud juntas y dentro del mapa', function () {
    Sanctum::actingAs(puntoPersona());
    $base = ['direccion' => 'Calle 12 # 10-25', 'barrio' => 'Centro'];

    $this->postJson('/api/cliente/direcciones', $base + ['lat' => 11.379])
        ->assertStatus(422)->assertJsonValidationErrors(['lng']);
    $this->postJson('/api/cliente/direcciones', $base + ['lat' => 120, 'lng' => -72.24])
        ->assertStatus(422)->assertJsonValidationErrors(['lat']);
});

test('al editar la dirección el punto se puede mover pero no quitar', function () {
    $cliente = puntoPersona();
    $direccion = puntoDireccion($cliente);
    Sanctum::actingAs($cliente);
    $base = ['direccion' => 'Calle 12 # 10-25', 'barrio' => 'Centro'];

    $this->putJson("/api/cliente/direcciones/{$direccion->id}", $base + ['lat' => 11.38, 'lng' => -72.25])
        ->assertOk()->assertJsonPath('direccion.lat', 11.38);
    $this->putJson("/api/cliente/direcciones/{$direccion->id}", $base)
        ->assertUnprocessable()->assertJsonValidationErrors(['lat', 'lng']);

    expect($direccion->fresh()->tieneUbicacion())->toBeTrue();
});

// ---------------------------------------------------------------------------
// El pedido se lleva el punto copiado
// ---------------------------------------------------------------------------

test('el pedido copia el punto de la dirección elegida', function () {
    $cliente = puntoPersona();
    $direccion = puntoDireccion($cliente);
    [$negocio, $producto] = puntoNegocio();
    Sanctum::actingAs($cliente);

    $id = $this->postJson('/api/pedidos', puntoCuerpo($negocio, $producto, ['direccion_id' => $direccion->id]))
        ->assertCreated()->json('id');

    // Borrar la dirección después no cambia a dónde va este pedido.
    $direccion->delete();

    $this->getJson("/api/pedidos/{$id}")
        ->assertOk()
        ->assertJsonPath('entrega_ubicacion.lat', 11.379)
        ->assertJsonPath('entrega_ubicacion.lng', -72.24);
});

test('el pedido no toma el punto de una dirección ajena', function () {
    $ajena = puntoDireccion(puntoPersona());
    [$negocio, $producto] = puntoNegocio();
    Sanctum::actingAs(puntoPersona());

    $this->postJson('/api/pedidos', puntoCuerpo($negocio, $producto, ['direccion_id' => $ajena->id]))
        ->assertUnprocessable()->assertJsonValidationErrors('direccion_id');
});

test('un pedido exige una dirección guardada', function () {
    [$negocio, $producto] = puntoNegocio();
    Sanctum::actingAs(puntoPersona());

    $this->postJson('/api/pedidos', puntoCuerpo($negocio, $producto))->assertUnprocessable()->assertJsonValidationErrors('direccion_id');
});

// ---------------------------------------------------------------------------
// En cuánto llega
// ---------------------------------------------------------------------------

test('la distancia en línea recta coincide con una medida conocida', function () {
    // Un grado de latitud son unos 111,2 km en cualquier parte.
    expect(TiempoEntrega::km(11.0, -72.24, 12.0, -72.24))->toEqualWithDelta(111.2, 0.1);
    expect(TiempoEntrega::km(11.379, -72.24, 11.379, -72.24))->toBe(0.0);
});

test('el tiempo estimado crece con la distancia y nunca baja de un minuto', function () {
    $puerta = ['lat' => 11.3790, 'lng' => -72.2400];

    expect(TiempoEntrega::minutos($puerta, $puerta))->toBe(1);
    // ~1 km en línea recta: 1,35 km por calles a 22 km/h son 3,7 min, más la llegada.
    expect(TiempoEntrega::minutos(['lat' => 11.3880, 'lng' => -72.2400], $puerta))->toBe(5);
    expect(TiempoEntrega::minutos(null, $puerta))->toBeNull();
    expect(TiempoEntrega::minutos($puerta, null))->toBeNull();
});

test('el cliente ve en cuánto llega el domiciliario cuando ya viene en camino', function () {
    $cliente = puntoPersona();
    $domiciliario = puntoPersona('domiciliario');
    $pedido = puntoPedidoEnCamino($cliente, $domiciliario);
    UbicacionDomiciliario::guardar($domiciliario, 11.3880, -72.2400);
    Sanctum::actingAs($cliente);

    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertOk()
        ->assertJsonPath('minutos_estimados', 5);
});

test('sin posición vigente del domiciliario no se inventa un tiempo', function () {
    $cliente = puntoPersona();
    $domiciliario = puntoPersona('domiciliario');
    $pedido = puntoPedidoEnCamino($cliente, $domiciliario);
    Sanctum::actingAs($cliente);

    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('minutos_estimados', null);

    // Una posición vieja ya no dice dónde está.
    UbicacionDomiciliario::guardar($domiciliario, 11.3880, -72.2400);
    $domiciliario->forceFill(['ubicacion_at' => now()->subMinutes(UbicacionDomiciliario::VIGENCIA_MINUTOS + 1)])->save();

    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('minutos_estimados', null);
});

test('antes de salir en camino no hay tiempo estimado', function () {
    $cliente = puntoPersona();
    $domiciliario = puntoPersona('domiciliario');
    $pedido = puntoPedidoEnCamino($cliente, $domiciliario, ['estado' => 'recogido']);
    UbicacionDomiciliario::guardar($domiciliario, 11.3880, -72.2400);
    Sanctum::actingAs($cliente);

    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('minutos_estimados', null);
});

test('el domiciliario recibe el punto exacto de la entrega mientras lleva el pedido', function () {
    $domiciliario = puntoPersona('domiciliario');
    $pedido = puntoPedidoEnCamino(puntoPersona(), $domiciliario);
    Sanctum::actingAs($domiciliario);

    $this->getJson('/api/domiciliario/entregas')
        ->assertOk()
        ->assertJsonFragment(['entrega_ubicacion' => ['lat' => 11.379, 'lng' => -72.24]]);

    $pedido->update(['estado' => 'entregado', 'entregado_at' => now()]);

    $this->getJson('/api/domiciliario/entregas')->assertJsonMissing(['lat' => 11.379]);
});


test('cada campo rechaza signos y puntos incluso al crear el pedido directamente', function ($direccion) {
    Sanctum::actingAs(puntoPersona());
    [$negocio, $producto] = puntoNegocio();
    $this->postJson('/api/pedidos', array_replace(puntoCuerpo($negocio, $producto), ['direccion_entrega' => $direccion]))
        ->assertUnprocessable()->assertJsonValidationErrors('direccion_entrega');
    $this->postJson('/api/cliente/direcciones', ['direccion' => $direccion, 'barrio' => 'Centro'])
        ->assertUnprocessable()->assertJsonValidationErrors('direccion');
})->with(['.', 'Calle . #1', 'Calle 1 Carrera . #2', 'Calle 1 #.', 'Calle 1/2 #3', 'Calle 1 #2_3', 'Calle 1 #2!']);

test('en produccion se exigen tres fotos y se rechazan archivos que no son imagenes', function () {
    config(['vitrina.fotos_entrega_obligatorias' => true]);
    Sanctum::actingAs(puntoPersona());
    $base = ['direccion' => 'Calle 1 #2-3', 'barrio' => 'Centro', 'lat' => 11.379, 'lng' => -72.24];
    $this->postJson('/api/cliente/direcciones', $base)->assertUnprocessable()
        ->assertJsonValidationErrors(['foto_frente', 'foto_izquierda', 'foto_derecha']);
    $this->postJson('/api/cliente/direcciones', $base + ['foto_frente' => \Illuminate\Http\UploadedFile::fake()->create('script.svg', 10, 'image/svg+xml')])
        ->assertUnprocessable()->assertJsonValidationErrors('foto_frente');
});

test('fotos privadas solo para propietario y repartidor asignado durante entrega', function () {
    $cliente = puntoPersona();
    Sanctum::actingAs($cliente);
    $id = $this->postJson('/api/cliente/direcciones', fotosReferenciaPrueba() + [
        'direccion' => 'Calle 12 # 10-25', 'barrio' => 'Centro', 'lat' => 11.379, 'lng' => -72.24,
    ])->assertCreated()->json('direccion.id');
    $direccion = ClienteDireccion::findOrFail($id);
    $ruta = "/api/cliente/direcciones/{$id}/fotos/frente";
    $this->get($ruta)->assertOk()->assertHeader('Cache-Control', 'max-age=0, no-store, private');
    foreach ($direccion->fotos as $path) {
        \Illuminate\Support\Facades\Storage::disk('local')->assertExists($path);
        \Illuminate\Support\Facades\Storage::disk('public')->assertMissing($path);
    }
    $domiciliario = puntoPersona('domiciliario');
    $pedido = puntoPedidoEnCamino($cliente, $domiciliario, ['entrega_fotos' => $direccion->fotos]);
    $foto = "/api/pedidos/{$pedido->id}/fotos-entrega/frente";
    Sanctum::actingAs(puntoPersona('administrador'));
    $this->get($foto)->assertForbidden();
    Sanctum::actingAs(puntoPersona('domiciliario'));
    $this->get($ruta)->assertNotFound();
    $this->get($foto)->assertForbidden();
    Sanctum::actingAs($domiciliario);
    $this->get($foto)->assertOk();
    $this->getJson('/api/domiciliario/entregas')->assertJsonPath('pedidos.0.entrega_fotos.frente', $foto);
    foreach (['entregado', 'cancelado', 'devolviendo', 'listo'] as $estado) {
        $pedido->update(['estado' => $estado]);
        $this->get($foto)->assertForbidden();
        $this->getJson('/api/domiciliario/entregas')->assertJsonMissing(['entrega_ubicacion' => ['lat' => 11.379, 'lng' => -72.24]])
            ->assertJsonMissing(['entrega_fotos' => ['frente' => $foto]]);
    }
});

test('por ahora las fotos de referencia son opcionales', function () {
    $cliente = puntoPersona();
    Sanctum::actingAs($cliente);
    $id = $this->postJson('/api/cliente/direcciones', ['direccion' => 'Calle San Martín #2-3', 'barrio' => 'Centro', 'lat' => 11.379, 'lng' => -72.24, 'nombre' => 'Mi casa'])
        ->assertCreated()->assertJsonPath('direccion.nombre', 'Mi casa')->json('direccion.id');
    $direccion = $cliente->clienteDirecciones()->findOrFail($id);
    [$negocio, $producto] = puntoNegocio();
    $body = array_replace(puntoCuerpo($negocio, $producto, ['direccion_id' => $direccion->id]), ['direccion_entrega' => $direccion->direccion]);
    $this->postJson('/api/pedidos', $body)->assertCreated();
});

test('el pedido exige referencias completas y direccion consistente con el mapa', function () {
    config(['vitrina.fotos_entrega_obligatorias' => true]);
    $cliente = puntoPersona();
    $direccion = puntoDireccion($cliente, ['fotos' => null]);
    [$negocio, $producto] = puntoNegocio();
    Sanctum::actingAs($cliente);
    $body = puntoCuerpo($negocio, $producto, ['direccion_id' => $direccion->id]);
    $this->postJson('/api/pedidos', $body)->assertUnprocessable()->assertJsonValidationErrors('direccion_id');
    $direccion->update(['fotos' => ['frente' => 'a.jpg', 'izquierda' => 'b.jpg', 'derecha' => 'c.jpg']]);
    $this->postJson('/api/pedidos', array_replace($body, ['direccion_entrega' => 'Calle 99 #1']))
        ->assertUnprocessable()->assertJsonValidationErrors('direccion_entrega');
    $id = $this->postJson('/api/pedidos', $body)->assertCreated()->json('id');
    $direccion->update(['fotos' => ['frente' => 'nueva.jpg']]);
    expect(Pedido::findOrFail($id)->entrega_fotos['frente'])->toBe('a.jpg');
});
