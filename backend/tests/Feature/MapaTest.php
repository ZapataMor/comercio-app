<?php

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\TipoNegocio;
use App\Models\User;
use App\Support\UbicacionDomiciliario;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Mapa: pin de los negocios y posición de los domiciliarios (quién la ve y cuándo).

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    Notification::fake();
});

function mapaUsuario(string $rol, array $datos = []): User
{
    $user = User::factory()->create($datos);
    $user->assignRole($rol);

    return $user;
}

function mapaNegocio(?User $dueno = null, array $datos = []): Negocio
{
    $dueno ??= mapaUsuario('usuario');

    return $dueno->negocio()->create($datos + ['nombre' => 'Tienda', 'activo' => true]);
}

/** Pedido del cliente en el negocio, ya en el estado indicado. */
function mapaPedido(Negocio $negocio, User $cliente, ?User $domiciliario, string $estado): Pedido
{
    return Pedido::create([
        'negocio_id' => $negocio->id,
        'user_id' => $cliente->id,
        'domiciliario_id' => $domiciliario?->id,
        'estado' => $estado,
        'metodo_pago' => 'efectivo',
        'subtotal' => 5000,
        'costo_domicilio' => 0,
        'total' => 5000,
        'direccion_entrega' => 'Calle 5',
        'telefono_contacto' => '3001234567',
    ]);
}

function reportarUbicacion(User $domiciliario, float $lat = 11.3843, float $lng = -72.2432)
{
    Sanctum::actingAs($domiciliario);

    return test()->putJson('/api/domiciliario/ubicacion', ['lat' => $lat, 'lng' => $lng]);
}

// ---------------------------------------------------------------------------
// Pin del negocio
// ---------------------------------------------------------------------------

test('el propietario fija y quita el pin de su negocio', function () {
    $dueno = mapaUsuario('usuario');
    $negocio = mapaNegocio($dueno);
    Sanctum::actingAs($dueno);

    $this->putJson("/api/negocios/{$negocio->id}", ['lat' => 11.3843, 'lng' => -72.2432])
        ->assertOk()
        ->assertJsonPath('negocio.lat', 11.3843)
        ->assertJsonPath('negocio.lng', -72.2432);

    $this->putJson("/api/negocios/{$negocio->id}", ['lat' => null, 'lng' => null])->assertOk();
    expect($negocio->fresh()->tieneUbicacion())->toBeFalse();
});

test('el pin necesita latitud y longitud válidas', function () {
    $dueno = mapaUsuario('usuario');
    $negocio = mapaNegocio($dueno);
    Sanctum::actingAs($dueno);

    $this->putJson("/api/negocios/{$negocio->id}", ['lat' => 11.38])->assertJsonValidationErrors('lng');
    $this->putJson("/api/negocios/{$negocio->id}", ['lat' => 120, 'lng' => -72.2])->assertJsonValidationErrors('lat');
});

test('el mapa solo muestra negocios con pin, ni vetados ni archivados', function () {
    mapaNegocio(null, ['nombre' => 'Con pin', 'lat' => 11.38, 'lng' => -72.24]);
    mapaNegocio(null, ['nombre' => 'Sin pin']);
    $vetado = mapaNegocio(null, ['nombre' => 'Vetado', 'lat' => 11.39, 'lng' => -72.25]);
    $vetado->forceFill(['vetado_at' => now()])->save();

    Sanctum::actingAs(mapaUsuario('usuario'));

    $this->getJson('/api/negocios/mapa')
        ->assertOk()
        ->assertJsonCount(1, 'negocios')
        ->assertJsonPath('negocios.0.nombre', 'Con pin')
        ->assertJsonPath('negocios.0.lat', 11.38);
});

test('cada negocio del mapa trae todos sus tipos para el filtro', function () {
    $drogueria = mapaNegocio(null, ['nombre' => 'Droguería', 'lat' => 11.38, 'lng' => -72.24]);
    $drogueria->tiposNegocio()->attach([
        TipoNegocio::firstOrCreate(['slug' => 'farmacia'], ['nombre' => 'Farmacia'])->id,
        TipoNegocio::firstOrCreate(['slug' => 'tienda'], ['nombre' => 'Tienda'])->id,
    ]);
    // Negocio viejo sin tipos en la tabla: se usa su categoría de texto.
    mapaNegocio(null, ['nombre' => 'Peluquería', 'categoria' => 'Peluquería', 'lat' => 11.39, 'lng' => -72.25]);

    Sanctum::actingAs(mapaUsuario('usuario'));

    $negocios = collect($this->getJson('/api/negocios/mapa')->assertOk()->json('negocios'))->keyBy('nombre');

    expect($negocios['Droguería']['tipos'])->toEqualCanonicalizing(['Farmacia', 'Tienda'])
        ->and($negocios['Peluquería']['tipos'])->toBe(['Peluquería']);
});

// ---------------------------------------------------------------------------
// Posición del domiciliario
// ---------------------------------------------------------------------------

test('el domiciliario en turno guarda su posición', function () {
    $domi = mapaUsuario('domiciliario', ['en_turno' => true]);

    reportarUbicacion($domi)->assertOk()->assertJsonPath('compartir', true);

    expect((float) $domi->fresh()->ubicacion_lat)->toBe(11.3843);
});

test('fuera de turno y sin entregas no se guarda la posición', function () {
    $domi = mapaUsuario('domiciliario', ['en_turno' => false]);

    reportarUbicacion($domi)->assertOk()->assertJsonPath('compartir', false);

    expect($domi->fresh()->ubicacion_at)->toBeNull();
});

test('con una entrega en curso comparte aunque no esté en turno', function () {
    $domi = mapaUsuario('domiciliario', ['en_turno' => false]);
    mapaPedido(mapaNegocio(), mapaUsuario('usuario'), $domi, 'en_camino');

    reportarUbicacion($domi)->assertOk()->assertJsonPath('compartir', true);
});

test('salir de turno borra la posición', function () {
    $domi = mapaUsuario('domiciliario', ['en_turno' => true]);
    reportarUbicacion($domi);

    $this->putJson('/api/domiciliario/turno', ['en_turno' => false])->assertOk();

    expect($domi->fresh()->ubicacion_at)->toBeNull();
});

test('la posición no sale en los datos del usuario', function () {
    $domi = mapaUsuario('domiciliario', ['en_turno' => true]);
    reportarUbicacion($domi);

    $this->getJson('/api/user')->assertOk()->assertJsonMissingPath('ubicacion_lat');
});

// ---------------------------------------------------------------------------
// Quién la ve
// ---------------------------------------------------------------------------

test('el cliente ve al domiciliario solo mientras le lleva el pedido', function () {
    $cliente = mapaUsuario('usuario');
    $domi = mapaUsuario('domiciliario', ['en_turno' => true]);
    $pedido = mapaPedido(mapaNegocio(null, ['lat' => 11.38, 'lng' => -72.24]), $cliente, $domi, 'tomado');
    reportarUbicacion($domi);

    Sanctum::actingAs($cliente);
    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertOk()
        ->assertJsonPath('domiciliario_ubicacion', null)
        ->assertJsonPath('negocio_ubicacion.lat', 11.38);

    $pedido->update(['estado' => 'en_camino']);
    $this->getJson("/api/pedidos/{$pedido->id}")
        ->assertOk()
        ->assertJsonPath('domiciliario_ubicacion.lat', 11.3843);

    $pedido->update(['estado' => 'entregado']);
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('domiciliario_ubicacion', null);
});

test('una posición vieja ya no se muestra', function () {
    $cliente = mapaUsuario('usuario');
    $domi = mapaUsuario('domiciliario', ['en_turno' => true]);
    $pedido = mapaPedido(mapaNegocio(), $cliente, $domi, 'en_camino');
    reportarUbicacion($domi);

    $this->travel(10)->minutes();

    Sanctum::actingAs($cliente);
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('domiciliario_ubicacion', null);
});

test('el negocio ve al domiciliario desde que toma el pedido', function () {
    $dueno = mapaUsuario('usuario');
    $negocio = mapaNegocio($dueno);
    $domi = mapaUsuario('domiciliario', ['en_turno' => true]);
    $pedido = mapaPedido($negocio, mapaUsuario('usuario'), $domi, 'tomado');
    reportarUbicacion($domi);

    Sanctum::actingAs($dueno);
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertOk()
        ->assertJsonPath('domiciliario_ubicacion.lat', 11.3843);

    $pedido->update(['estado' => 'en_camino']);
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('domiciliario_ubicacion.lat', 11.3843);
});

test('en efectivo el negocio lo sigue viendo hasta confirmar el dinero', function () {
    $dueno = mapaUsuario('usuario');
    $negocio = mapaNegocio($dueno);
    $domi = mapaUsuario('domiciliario');
    $pedido = mapaPedido($negocio, mapaUsuario('usuario'), $domi, 'en_camino');
    $pedido->update(['metodo_pago' => 'efectivo', 'recogido_at' => now()]);
    $ruta = "/api/negocios/{$negocio->id}/pedidos/{$pedido->id}";
    reportarUbicacion($domi);

    // Entregó y salió de turno: sigue compartiendo porque debe el dinero.
    $pedido->update(['estado' => 'entregado']);
    expect(UbicacionDomiciliario::debeCompartir($domi->fresh()))->toBeTrue();
    reportarUbicacion($domi, 11.39)->assertJsonPath('compartir', true);

    Sanctum::actingAs($dueno);
    $this->getJson($ruta)->assertJsonPath('domiciliario_ubicacion.lat', 11.39);

    // Decir que no lo recibió no lo deja de mostrar.
    $pedido->update(['dinero_estado' => 'no_recibido']);
    $this->getJson($ruta)->assertJsonPath('domiciliario_ubicacion.lat', 11.39);

    $pedido->update(['dinero_estado' => 'recibido']);
    $this->getJson($ruta)->assertJsonPath('domiciliario_ubicacion', null);
    expect(UbicacionDomiciliario::debeCompartir($domi->fresh()))->toBeFalse();
});

test('el negocio ve la última posición aunque sea vieja; el cliente no', function () {
    $dueno = mapaUsuario('usuario');
    $negocio = mapaNegocio($dueno);
    $domi = mapaUsuario('domiciliario');
    $cliente = mapaUsuario('usuario');
    $pedido = mapaPedido($negocio, $cliente, $domi, 'en_camino');
    reportarUbicacion($domi);
    $domi->forceFill(['ubicacion_at' => now()->subHour()])->save();

    Sanctum::actingAs($dueno);
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('domiciliario_ubicacion.lat', 11.3843)
        ->assertJsonPath('domiciliario_ubicacion.hace_segundos', fn ($s) => $s >= 3600);

    Sanctum::actingAs($cliente);
    $this->getJson("/api/pedidos/{$pedido->id}")->assertJsonPath('domiciliario_ubicacion', null);
});

test('pagado por transferencia deja de verse al entregar', function () {
    $dueno = mapaUsuario('usuario');
    $negocio = mapaNegocio($dueno);
    $domi = mapaUsuario('domiciliario');
    $pedido = mapaPedido($negocio, mapaUsuario('usuario'), $domi, 'en_camino');
    $pedido->update(['metodo_pago' => 'transferencia', 'recogido_at' => now()]);
    reportarUbicacion($domi);

    $pedido->update(['estado' => 'entregado']);

    Sanctum::actingAs($dueno);
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('domiciliario_ubicacion', null);
    expect(UbicacionDomiciliario::debeCompartir($domi->fresh()))->toBeFalse();
});

test('sin confirmar el dinero el rastreo termina con el plazo para responder', function () {
    $dueno = mapaUsuario('usuario');
    $negocio = mapaNegocio($dueno);
    $domi = mapaUsuario('domiciliario');
    $pedido = mapaPedido($negocio, mapaUsuario('usuario'), $domi, 'entregado');
    $pedido->update(['metodo_pago' => 'efectivo', 'recogido_at' => now()->subHours(73)]);
    reportarUbicacion($domi);

    Sanctum::actingAs($dueno);
    $this->getJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}")
        ->assertJsonPath('domiciliario_ubicacion', null);
    expect(UbicacionDomiciliario::debeCompartir($domi->fresh()))->toBeFalse();
});

test('el administrador ve a los domiciliarios con posición reciente', function () {
    $domi = mapaUsuario('domiciliario', ['en_turno' => true]);
    mapaUsuario('domiciliario', ['en_turno' => true]); // nunca reportó
    reportarUbicacion($domi);

    Sanctum::actingAs(mapaUsuario('administrador'));
    $this->getJson('/api/admin/mapa/domiciliarios')
        ->assertOk()
        ->assertJsonCount(1, 'domiciliarios')
        ->assertJsonPath('domiciliarios.0.id', $domi->id)
        ->assertJsonPath('domiciliarios.0.en_entrega', false);
});

test('solo el administrador ve el mapa de domiciliarios', function () {
    Sanctum::actingAs(mapaUsuario('usuario'));

    $this->getJson('/api/admin/mapa/domiciliarios')->assertForbidden();
});
