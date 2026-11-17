<?php

use App\Models\User;
use App\Support\RutaCalles;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as PeticionHttp;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

// «Cómo llegar» dentro de la app: la ruta por calles (OSRM) con sus indicaciones.

beforeEach(function () {
    config([
        'services.rutas.moto' => 'https://osrm.prueba/route/v1/driving',
        'services.rutas.pie' => 'https://osrm.prueba/routed-foot/route/v1/foot',
    ]);
    Sanctum::actingAs(User::factory()->create());
});

/** Del centro de Maicao a unas cuadras (tomado de una respuesta real de OSRM). */
function rutaPeticion(array $extra = []): array
{
    return $extra + ['desde_lat' => 11.38264, 'desde_lng' => -72.24321, 'hasta_lat' => 11.37918, 'hasta_lng' => -72.23804];
}

function respuestaOsrm(): array
{
    $paso = fn (string $tipo, ?string $giro, string $calle, float $m, array $punto) => [
        'maneuver' => array_filter(['type' => $tipo, 'modifier' => $giro, 'location' => $punto]),
        'name' => $calle,
        'distance' => $m,
    ];

    return [
        'code' => 'Ok',
        'routes' => [[
            'distance' => 961.2,
            'duration' => 126.6,
            'geometry' => ['type' => 'LineString', 'coordinates' => [[-72.243207, 11.382643], [-72.242852, 11.3827], [-72.23804, 11.379183]]],
            'legs' => [[
                'steps' => [
                    $paso('depart', null, 'Calle 19', 39.4, [-72.243207, 11.382643]),
                    $paso('turn', 'right', 'Carrera 15', 294.2, [-72.242852, 11.3827]),
                    $paso('turn', 'left', 'Calle 16', 260, [-72.242242, 11.380123]),
                    $paso('arrive', 'right', 'Calle 14', 0, [-72.23804, 11.379183]),
                ],
            ]],
        ]],
    ];
}

test('entrega la línea, la distancia y los pasos en español', function () {
    Http::fake(['osrm.prueba/*' => Http::response(respuestaOsrm())]);

    $r = $this->postJson('/api/ruta', rutaPeticion())->assertOk();

    expect($r->json('modo'))->toBe('moto')
        ->and($r->json('distancia_m'))->toBe(961)
        ->and($r->json('duracion_s'))->toBe(127)
        ->and($r->json('linea'))->toHaveCount(3)
        ->and($r->json('linea.0'))->toBe([-72.243207, 11.382643])
        ->and($r->json('pasos.*.texto'))->toBe([
            'Arranca por la Calle 19',
            'Gira a la derecha por la Carrera 15',
            'Gira a la izquierda por la Calle 16',
            'Llegas: el destino queda a la derecha',
        ])
        ->and($r->json('pasos.*.icono'))->toBe(['salida', 'derecha', 'izquierda', 'llegada'])
        // Cada maniobra, a cuántos metros del inicio: suma de los tramos anteriores.
        ->and($r->json('pasos.*.en_m'))->toBe([0, 39, 334, 594])
        ->and($r->json('pasos.1.punto'))->toBe(['lat' => 11.3827, 'lng' => -72.242852]);

    // OSRM recibe longitud,latitud (redondeadas a ~11 m) y pide la geometría completa.
    Http::assertSent(fn (PeticionHttp $p) => str_starts_with(
        $p->url(),
        'https://osrm.prueba/route/v1/driving/-72.243200,11.382600;-72.238000,11.379200?',
    ) && $p['geometries'] === 'geojson' && $p['steps'] === 'true');
});

test('a pie usa el servidor de rutas caminando', function () {
    Http::fake(['osrm.prueba/*' => Http::response(respuestaOsrm())]);

    $this->postJson('/api/ruta', rutaPeticion(['modo' => 'pie']))->assertOk()->assertJsonPath('modo', 'pie');

    Http::assertSent(fn (PeticionHttp $p) => str_starts_with($p->url(), 'https://osrm.prueba/routed-foot/route/v1/foot/'));
});

test('la misma ruta pedida otra vez no vuelve a consultar el servidor', function () {
    Http::fake(['osrm.prueba/*' => Http::response(respuestaOsrm())]);

    $this->postJson('/api/ruta', rutaPeticion())->assertOk();
    // Un par de metros más allá: misma ruta guardada.
    $this->postJson('/api/ruta', rutaPeticion(['desde_lat' => 11.38262]))->assertOk();

    Http::assertSentCount(1);
});

test('sin camino por calles responde 422 con un mensaje claro', function () {
    Http::fake(['osrm.prueba/*' => Http::response(['code' => 'NoRoute', 'message' => 'Impossible route'], 400)]);

    $this->postJson('/api/ruta', rutaPeticion())
        ->assertStatus(422)
        ->assertJsonPath('message', 'No encontramos un camino por calles hasta ese punto.');
});

test('si el servidor de rutas falla o no responde, 503 sin romper nada', function () {
    Http::fake(['osrm.prueba/*' => Http::response('Bad gateway', 502)]);
    $this->postJson('/api/ruta', rutaPeticion())
        ->assertStatus(503)
        ->assertJsonPath('message', 'No pudimos trazar la ruta en este momento.');

    Http::fake(['osrm.prueba/*' => fn () => throw new ConnectionException('timeout')]);
    $this->postJson('/api/ruta', rutaPeticion(['hasta_lat' => 11.37]))->assertStatus(503);
});

test('valida los puntos, el modo y la distancia antes de consultar', function () {
    Http::fake();

    $this->postJson('/api/ruta', ['desde_lat' => 11.38])->assertStatus(422)->assertJsonValidationErrors(['desde_lng', 'hasta_lat', 'hasta_lng']);
    $this->postJson('/api/ruta', rutaPeticion(['modo' => 'avion']))->assertStatus(422)->assertJsonValidationErrors('modo');
    $this->postJson('/api/ruta', rutaPeticion(['desde_lat' => 95]))->assertStatus(422)->assertJsonValidationErrors('desde_lat');
    // De Maicao a Bogotá no es un recorrido dentro de la ciudad.
    $this->postJson('/api/ruta', rutaPeticion(['hasta_lat' => 4.711, 'hasta_lng' => -74.0721]))
        ->assertStatus(422)
        ->assertJsonPath('message', 'El destino está demasiado lejos para trazar la ruta.');

    Http::assertNothingSent();
});

test('pide sesión', function () {
    $this->app['auth']->forgetGuards();

    $this->withHeaders(['Authorization' => ''])->postJson('/api/ruta', rutaPeticion())->assertUnauthorized();
});

test('indicaciones de glorietas, bifurcaciones y calles sin nombre', function () {
    expect(RutaCalles::indicacion('roundabout', null, 'Avenida El Libertador', 2))->toBe('En la glorieta, toma la segunda salida hacia la Avenida El Libertador')
        ->and(RutaCalles::indicacion('rotary', null, '', 1))->toBe('En la glorieta, toma la primera salida')
        ->and(RutaCalles::indicacion('fork', 'slight left', 'Troncal del Caribe'))->toBe('En la bifurcación, mantente a la izquierda por la Troncal del Caribe')
        ->and(RutaCalles::indicacion('end of road', 'right', 'Callejón Real'))->toBe('Al final de la vía, gira a la derecha por el Callejón Real')
        ->and(RutaCalles::indicacion('new name', 'straight', 'Carrera 10'))->toBe('Sigue derecho por la Carrera 10')
        ->and(RutaCalles::indicacion('turn', 'uturn'))->toBe('Da la vuelta en U')
        ->and(RutaCalles::indicacion('turn', 'sharp left', 'Los Almendros'))->toBe('Gira cerrado a la izquierda por Los Almendros')
        ->and(RutaCalles::indicacion('arrive', null))->toBe('Llegas al destino');
});
