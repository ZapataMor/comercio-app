<?php

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Models\AccesoWeb;
use App\Models\InventarioArticulo;
use App\Models\Negocio;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Notification::fake();
    $this->dueno = User::factory()->create(['name' => 'Ismael']);
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Grumar', 'direccion' => 'Calle 10', 'barrio' => 'Centro']);
    $this->trabajador = User::factory()->create(['name' => 'Ayudante']);
    $this->negocio->miembros()->attach($this->trabajador->id, ['rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false)]);
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['inventario']);
});

function entrarAlPanelInventario($test, User $user): void
{
    $test->get('/login')->assertOk();
    AccesosWeb::aprobar(AccesoWeb::latest('id')->first()->codigo, $user);
    $test->getJson('/login/estado')->assertJsonPath('estado', 'listo');
}

function articuloDePrueba(Negocio $negocio, array $datos = []): InventarioArticulo
{
    return $negocio->articulosInventario()->create($datos + [
        'nombre' => 'Tubo cuadrado 1"', 'tipo' => 'material', 'unidad' => 'unidad', 'categoria' => 'Tubos',
        'caracteristicas' => [['nombre' => 'Calibre', 'valor' => '18'], ['nombre' => 'Largo', 'valor' => '6 m']],
    ]);
}

test('el inventario ya funciona y sale en el menú con su propia página', function () {
    entrarAlPanelInventario($this, $this->dueno);

    $this->get('/negocio')->assertOk()->assertSee('/negocio/inventario')->assertDontSee('/negocio/modulos/inventario');
    $this->get('/negocio/modulos/inventario')->assertRedirect('/negocio/inventario');
    $this->get('/negocio/inventario')->assertOk()->assertSee('Todavía no hay materiales')->assertSee('+ Añadir un material');
});

test('sin el módulo encendido no se entra', function () {
    Gestion::definirModulos($this->negocio, []);
    entrarAlPanelInventario($this, $this->dueno);

    $this->get('/negocio/inventario')->assertForbidden();
    $this->post('/negocio/inventario', ['nombre' => 'X', 'tipo' => 'material', 'unidad' => 'unidad', 'cantidad' => 1])->assertForbidden();
});

test('se crea materia prima con características libres y la existencia inicial queda como entrada', function () {
    Storage::fake('public');
    entrarAlPanelInventario($this, $this->dueno);

    $this->from('/negocio/inventario')->post('/negocio/inventario', [
        '_articulo' => 'nuevo',
        'tipo' => 'material',
        'nombre' => '  Lámina galvanizada ',
        'categoria' => 'Láminas',
        'unidad' => 'lamina',
        'cantidad' => '12,5',
        'minimo' => '4',
        'costo' => '$ 85.000',
        'proveedor' => 'Ferretería El Tornillo',
        'caracteristicas' => [
            ['nombre' => 'calibre', 'valor' => '20'],
            ['nombre' => 'Medida', 'valor' => '1 x 2 m'],
            ['nombre' => 'Calibre', 'valor' => '22'], // repetida: gana la primera
            ['nombre' => '', 'valor' => 'sin nombre'],  // incompleta: se ignora
            ['nombre' => 'Color', 'valor' => ''],
        ],
        'imagen' => UploadedFile::fake()->image('lamina.jpg', 600, 400),
    ])->assertRedirect('/negocio/inventario')->assertSessionHas('ok');

    $a = $this->negocio->articulosInventario()->firstOrFail();
    expect($a->nombre)->toBe('Lámina galvanizada')
        ->and($a->cantidad)->toBe(12.5)
        ->and($a->minimo)->toBe(4.0)
        ->and($a->costo)->toBe(85000)
        ->and($a->valor())->toBe(1062500)
        ->and($a->caracteristicas)->toBe([['nombre' => 'Calibre', 'valor' => '20'], ['nombre' => 'Medida', 'valor' => '1 x 2 m']])
        ->and($a->cantidadTexto())->toBe('12,5 láminas')
        ->and($a->imagen)->not->toBeNull();
    Storage::disk('public')->assertExists($a->imagen);

    $m = $a->movimientos()->sole();
    expect($m->tipo)->toBe('entrada')->and($m->saldo)->toBe(12.5)->and($m->nota)->toBe('Existencia inicial')->and($m->user_id)->toBe($this->dueno->id);

    // La tarjeta, el modal y la búsqueda por característica.
    $this->get('/negocio/inventario')->assertOk()
        ->assertSee('Lámina galvanizada')->assertSee('láminas')->assertSee('Ferretería El Tornillo')->assertSee('$ 1.062.500');
    $this->get('/negocio/inventario?buscar=1 x 2')->assertSee('Lámina galvanizada');
    $this->get('/negocio/inventario?buscar=aluminio')->assertSee('Ningún artículo coincide');
});

test('entradas, salidas y conteos cambian la existencia y no la dejan negativa', function () {
    entrarAlPanelInventario($this, $this->dueno);
    $a = articuloDePrueba($this->negocio, ['minimo' => 5]);

    $this->post("/negocio/inventario/{$a->id}/movimientos", ['tipo' => 'entrada', 'cantidad' => '20', 'nota' => 'Compra'])->assertSessionHas('ok');
    $this->post("/negocio/inventario/{$a->id}/movimientos", ['tipo' => 'salida', 'cantidad' => '16'])->assertSessionHas('ok');
    expect($a->fresh()->cantidad)->toBe(4.0)->and($a->fresh()->estado())->toBe('bajo');

    $this->post("/negocio/inventario/{$a->id}/movimientos", ['tipo' => 'salida', 'cantidad' => '5'])->assertSessionHasErrors('cantidad');
    expect($a->fresh()->cantidad)->toBe(4.0);

    $this->post("/negocio/inventario/{$a->id}/movimientos", ['tipo' => 'ajuste', 'cantidad' => '0'])->assertSessionHas('ok');
    expect($a->fresh()->cantidad)->toBe(0.0)->and($a->fresh()->estado())->toBe('agotado');
    expect($a->movimientos()->orderBy('id')->pluck('saldo')->all())->toBe([20.0, 4.0, 0.0]);

    $this->get('/negocio/inventario?estado=bajos')->assertSee('Tubo cuadrado');
});

test('editar no cambia la existencia y se pueden quitar características', function () {
    entrarAlPanelInventario($this, $this->dueno);
    $a = articuloDePrueba($this->negocio);
    Inventario::mover($a, 'entrada', 10);

    $this->put("/negocio/inventario/{$a->id}", [
        'tipo' => 'material', 'nombre' => 'Tubo cuadrado 1 pulgada', 'unidad' => 'unidad', 'cantidad' => '999',
        'caracteristicas' => [['nombre' => 'Calibre', 'valor' => '20']],
    ])->assertSessionHas('ok');

    $a->refresh();
    expect($a->nombre)->toBe('Tubo cuadrado 1 pulgada')->and($a->cantidad)->toBe(10.0)
        ->and($a->caracteristicas)->toBe([['nombre' => 'Calibre', 'valor' => '20']]);
});

test('el trabajador ve el inventario con «ver» y solo lo cambia con «editar»', function () {
    $a = articuloDePrueba($this->negocio);
    entrarAlPanelInventario($this, $this->trabajador);
    $this->get('/negocio/inventario')->assertForbidden();

    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['inventario.ver']);
    $this->get('/negocio/inventario')->assertOk()->assertSee('Tubo cuadrado')->assertDontSee('+ Añadir al inventario')->assertDontSee('Registrar un movimiento');
    $this->post("/negocio/inventario/{$a->id}/movimientos", ['tipo' => 'entrada', 'cantidad' => 1])->assertForbidden();
    $this->delete("/negocio/inventario/{$a->id}")->assertForbidden();

    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['inventario.ver', 'inventario.editar']);
    $this->post("/negocio/inventario/{$a->id}/movimientos", ['tipo' => 'entrada', 'cantidad' => '2,5'])->assertSessionHas('ok');
    expect($a->fresh()->cantidad)->toBe(2.5);
    $this->delete("/negocio/inventario/{$a->id}")->assertSessionHas('ok');
    expect(InventarioArticulo::count())->toBe(0);
});

test('no se toca el inventario de otro negocio', function () {
    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Otro', 'direccion' => 'Calle 1', 'barrio' => 'Centro']);
    $ajeno = articuloDePrueba($otro);
    entrarAlPanelInventario($this, $this->dueno);

    $this->post("/negocio/inventario/{$ajeno->id}/movimientos", ['tipo' => 'entrada', 'cantidad' => 1])->assertNotFound();
    $this->put("/negocio/inventario/{$ajeno->id}", ['tipo' => 'material', 'nombre' => 'X', 'unidad' => 'unidad'])->assertNotFound();
    $this->delete("/negocio/inventario/{$ajeno->id}")->assertNotFound();
});

test('las sugerencias de características ponen primero las del negocio con sus valores', function () {
    articuloDePrueba($this->negocio);
    articuloDePrueba($this->negocio, ['nombre' => 'Tubo redondo', 'caracteristicas' => [['nombre' => 'Calibre', 'valor' => '20'], ['nombre' => 'Color', 'valor' => 'Negro']]]);

    $s = Inventario::sugerencias($this->negocio);
    expect(array_slice($s['nombres'], 0, 3))->toBe(['Calibre', 'Color', 'Largo'])
        ->and($s['nombres'])->toContain('Material', 'Peso')
        ->and(count($s['nombres']))->toBe(count(array_unique(array_map('mb_strtolower', $s['nombres']))))
        ->and($s['valores']['Calibre'])->toBe(['18', '20']);
});

test('los números se leen con coma o punto', function () {
    expect(Inventario::leerNumero('2,5'))->toBe('2.5')
        ->and(Inventario::leerNumero('2.5'))->toBe('2.5')
        ->and(Inventario::leerNumero('1.250,75'))->toBe('1250.75')
        ->and(Inventario::leerNumero('1.000.000'))->toBe('1000000')
        ->and(Inventario::leerNumero('doce'))->toBe('doce')
        ->and(Inventario::leerNumero(''))->toBeNull()
        ->and(InventarioArticulo::numero(1500))->toBe('1.500')
        ->and(InventarioArticulo::numero(2.25))->toBe('2,25');
    expect(fn () => Inventario::mover(articuloDePrueba($this->negocio), 'robo', 1))->toThrow(ValidationException::class);
});

test('el comando de prueba carga el inventario de una latonería y se puede repetir', function () {
    Gestion::definirModulos($this->negocio, []);
    $this->artisan('vitrina:inventario-de-prueba', ['negocio' => $this->negocio->id])->assertSuccessful();
    $this->artisan('vitrina:inventario-de-prueba', ['negocio' => $this->negocio->id])->assertSuccessful();

    expect(Gestion::tieneModulo($this->negocio, 'inventario'))->toBeTrue()
        ->and($this->negocio->articulosInventario()->count())->toBe(20)
        ->and($this->negocio->articulosInventario()->where('nombre', 'Disco de corte 7"')->value('cantidad'))->toEqual(3);

    $this->artisan('vitrina:inventario-de-prueba', ['negocio' => $this->negocio->id, '--con-productos' => true])->assertSuccessful();
    expect($this->negocio->modelosProduccion()->count())->toBe(3)
        ->and($this->negocio->productos()->whereNotNull('modelo_id')->count())->toBe(3)
        ->and($this->negocio->producciones()->where('estado', 'por_hacer')->count())->toBe(1);

    $this->artisan('vitrina:inventario-de-prueba', ['negocio' => $this->negocio->id, '--quitar' => true])->assertSuccessful();
    expect($this->negocio->articulosInventario()->count())->toBe(0);
    expect($this->negocio->productos()->withTrashed()->count())->toBe(0)->and($this->negocio->producciones()->count())->toBe(0);
});

test('el «−» de la tarjeta descuenta uno sin recargar y no deja la existencia en negativo', function () {
    entrarAlPanelInventario($this, $this->dueno);
    $a = articuloDePrueba($this->negocio, ['minimo' => 1]);
    Inventario::mover($a, 'entrada', 2);
    $this->get('/negocio/inventario')->assertSee('data-usar=', false)->assertDontSee('Calibre</small>', false);

    $url = "/negocio/inventario/{$a->id}/movimientos";
    $this->postJson($url, ['tipo' => 'salida', 'cantidad' => 1, 'nota' => 'Se usó (desde la tarjeta)'])->assertOk()
        ->assertJsonPath('numero', '1')->assertJsonPath('unidad', 'unidad')->assertJsonPath('estado', 'bajo');
    $this->postJson($url, ['tipo' => 'salida', 'cantidad' => 1])->assertOk()->assertJsonPath('estado', 'agotado');
    $this->postJson($url, ['tipo' => 'salida', 'cantidad' => 1])->assertStatus(422);
    expect($a->fresh()->cantidad)->toBe(0.0)->and($a->movimientos()->where('tipo', 'salida')->count())->toBe(2);
});
