<?php

use App\Models\Barrio;
use App\Models\User;
use App\Support\HorarioNegocio;
use App\Support\PrecioCarrito;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Lo que el cliente le dice al domiciliario (indicaciones y con qué billete
// paga), barrios con espacios, cuándo abre una tienda cerrada y el carrito
// que ya no vence.

beforeEach(function () {
    Role::findOrCreate('usuario', 'web');
    Role::findOrCreate('domiciliario', 'web');
    Notification::fake();

    $this->dueno = User::factory()->create();
    $this->dueno->assignRole('usuario');
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $this->producto = $this->negocio->productos()->create(['nombre' => 'Arepa', 'precio' => 15000]);

    $this->cliente = User::factory()->create();
    $this->cliente->assignRole('usuario');
    Sanctum::actingAs($this->cliente);
});

function pedirArepa(array $extra = [], array $direccion = [])
{
    $guardada = test()->cliente->clienteDirecciones()->create([
        'direccion' => 'Calle 1 #2-3', 'barrio' => 'Santa Isabel', 'lat' => 11.379, 'lng' => -72.24,
        'fotos' => ['frente' => 'f.jpg', 'izquierda' => 'i.jpg', 'derecha' => 'd.jpg'],
        ...$direccion,
    ]);

    return test()->postJson('/api/pedidos', [
        'negocio_id' => test()->negocio->id,
        'items' => [['producto_id' => test()->producto->id, 'cantidad' => 1]],
        'metodo_pago' => 'efectivo',
        'direccion_id' => $guardada->id,
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
        ...$extra,
    ]);
}

test('el billete con que paga queda en el pedido y lo ven el cliente, el negocio y el domiciliario', function () {
    $id = pedirArepa(['paga_con' => 50000])->assertCreated()->json('id');

    $this->getJson("/api/pedidos/{$id}")->assertOk()->assertJsonPath('paga_con', 50000);

    $domiciliario = User::factory()->create();
    $domiciliario->assignRole('domiciliario');
    $this->negocio->pedidos()->findOrFail($id)->update(['estado' => 'tomado', 'domiciliario_id' => $domiciliario->id, 'tomado_at' => now()]);
    Sanctum::actingAs($domiciliario);
    $this->getJson('/api/domiciliario/entregas')->assertOk()->assertJsonPath('pedidos.0.paga_con', 50000);
});

test('sin billete paga el valor exacto, y un billete que no alcanza se rechaza', function () {
    $id = pedirArepa()->assertCreated()->json('id');
    $this->getJson("/api/pedidos/{$id}")->assertOk()->assertJsonPath('paga_con', null);

    pedirArepa(['paga_con' => 10000])->assertUnprocessable()->assertJsonValidationErrors('paga_con');
});

test('por transferencia no se guarda billete', function () {
    $this->negocio->cuentasPago()->create(['tipo' => 'nequi', 'numero' => '3001112233', 'titular' => 'Tienda']);
    $id = pedirArepa(['metodo_pago' => 'transferencia', 'paga_con' => 50000])->assertCreated()->json('id');

    expect($this->negocio->pedidos()->findOrFail($id)->paga_con)->toBeNull();
});

test('las indicaciones de la dirección se copian al pedido y solo las ve quien lo lleva', function () {
    $id = pedirArepa([], ['indicaciones' => 'Frente a la tienda La 14, casa azul'])->assertCreated()->json('id');
    $this->getJson("/api/pedidos/{$id}")->assertOk()
        ->assertJsonPath('entrega_indicaciones', 'Frente a la tienda La 14, casa azul');

    $pedido = $this->negocio->pedidos()->findOrFail($id);
    $domiciliario = User::factory()->create();
    $domiciliario->assignRole('domiciliario');
    $pedido->update(['estado' => 'tomado', 'domiciliario_id' => $domiciliario->id, 'tomado_at' => now()]);
    Sanctum::actingAs($domiciliario);
    $this->getJson('/api/domiciliario/entregas')->assertOk()
        ->assertJsonPath('pedidos.0.entrega_indicaciones', 'Frente a la tienda La 14, casa azul');
});

test('la dirección guarda indicaciones y barrios con espacios y puntos', function () {
    $this->postJson('/api/cliente/direcciones', [
        ...fotosReferenciaPrueba(),
        'direccion' => 'Calle 1 #2-3', 'barrio' => 'Urb. Villa Inés', 'lat' => 11.379, 'lng' => -72.24,
        'indicaciones' => 'Casa de rejas blancas, al lado de la panadería.',
    ])->assertCreated()
        ->assertJsonPath('direccion.barrio', 'Urb. Villa Inés')
        ->assertJsonPath('direccion.indicaciones', 'Casa de rejas blancas, al lado de la panadería.');

    $this->postJson('/api/cliente/direcciones', [
        ...fotosReferenciaPrueba(),
        'direccion' => 'Calle 1 #2-3', 'barrio' => ' Santa  Isabel!', 'lat' => 11.379, 'lng' => -72.24,
    ])->assertUnprocessable()->assertJsonValidationErrors('barrio');
});

test('el pedido acepta un barrio con espacios', function () {
    pedirArepa()->assertCreated();
    expect($this->negocio->pedidos()->latest('id')->first()->direccion_entrega)->toBe('Calle 1 #2-3 - Barrio Santa Isabel');
});

test('un barrio escrito igual que uno del catálogo no crea otra sugerencia', function () {
    Barrio::create(['nombre' => 'Santa Isabel', 'aprobado' => true]);
    $this->postJson('/api/cliente/direcciones', [
        ...fotosReferenciaPrueba(),
        'direccion' => 'Calle 1 #2-3', 'barrio' => 'Santa Isabel', 'lat' => 11.379, 'lng' => -72.24,
    ])->assertCreated();

    expect(Barrio::where('nombre', 'like', 'Santa%')->count())->toBe(1);
});

test('una tienda cerrada dice cuándo vuelve a abrir', function (string $ahora, string $esperado) {
    // 2026-11-23 es lunes.
    Carbon::setTestNow(Carbon::parse($ahora));
    $this->negocio->forceFill([
        'activo' => false,
        'horario' => [
            'lun' => ['abre' => '06:30', 'cierra' => '20:00', 'almuerzo' => ['inicio' => '12:00', 'fin' => '14:00']],
            'mar' => ['abre' => '06:30', 'cierra' => '20:00'],
            'mie' => null, 'jue' => null, 'vie' => null, 'sab' => null, 'dom' => null, 'fes' => null,
        ],
    ])->save();

    expect(HorarioNegocio::textoApertura($this->negocio->fresh(), now()))->toBe($esperado);
    $this->getJson("/api/negocios/{$this->negocio->id}/estado")->assertOk()->assertJsonPath('abre_texto', $esperado);
})->with([
    'antes de abrir' => ['2026-11-23 05:00', 'Abre hoy a las 6:30 a. m.'],
    'en el almuerzo' => ['2026-11-23 12:30', 'Abre hoy a las 2:00 p. m.'],
    'de noche' => ['2026-11-23 21:00', 'Abre mañana a las 6:30 a. m.'],
    'días sin abrir' => ['2026-11-24 21:00', 'Abre el lunes a las 6:30 a. m.'],
]);

test('una tienda abierta o sin horario no dice cuándo abre', function () {
    expect(HorarioNegocio::textoApertura($this->negocio, now()))->toBeNull();
    $this->negocio->forceFill(['activo' => false, 'horario' => null])->save();
    expect(HorarioNegocio::textoApertura($this->negocio->fresh(), now()))->toBeNull();
});

test('el centro de un barrio sale de los negocios y propiedades públicos, no de las casas de los clientes', function () {
    $this->negocio->forceFill(['barrio' => 'Santa Isabel', 'lat' => 11.38, 'lng' => -72.24])->save();
    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Otra', 'activo' => true, 'barrio' => 'santa isabel', 'lat' => 11.39, 'lng' => -72.26]);
    $this->cliente->clienteDirecciones()->create(['direccion' => 'Calle 1 #2-3', 'barrio' => 'Santa Isabel', 'lat' => 12.0, 'lng' => -73.0]);

    $this->getJson('/api/barrios/centro?nombre=Santa%20Isabel')->assertOk()
        ->assertJsonPath('centro.lat', 11.385)
        ->assertJsonPath('centro.lng', -72.25);
    $this->getJson('/api/barrios/centro?nombre=Sin%20puntos')->assertOk()->assertJsonPath('centro', null);
});

test('el carrito no vence: una cotización de hace días sigue sirviendo', function () {
    $token = PrecioCarrito::cotizar($this->producto, $this->cliente->id)['precio_token'];
    $this->travel(3)->days();

    pedirArepa(['items' => [['producto_id' => $this->producto->id, 'cantidad' => 1, 'precio_token' => $token]]])
        ->assertCreated();
});

test('antes de tomar un pedido el domiciliario ve el barrio, no la dirección exacta', function () {
    $id = pedirArepa(['paga_con' => 50000])->assertCreated()->json('id');
    $this->negocio->pedidos()->findOrFail($id)->update(['estado' => 'listo', 'listo_at' => now()]);

    $domiciliario = User::factory()->create();
    $domiciliario->assignRole('domiciliario');
    Sanctum::actingAs($domiciliario);
    $this->getJson('/api/domiciliario/disponibles')->assertOk()
        ->assertJsonPath('pedidos.0.barrio_entrega', 'Santa Isabel')
        ->assertJsonPath('pedidos.0.direccion_entrega', '')
        ->assertJsonPath('pedidos.0.paga_con', 50000);
});
