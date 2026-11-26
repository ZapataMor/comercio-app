<?php

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Materiales;
use App\Gestion\Terminados;
use App\Models\AccesoWeb;
use App\Models\Negocio;
use App\Models\ProductoEnEspera;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Notification::fake();
    Storage::fake('public');
    $this->dueno = User::factory()->create(['name' => 'Ismael']);
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Grumar', 'direccion' => 'Calle 17', 'barrio' => 'Centro']);
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['produccion']);
    $this->seccion = $this->negocio->categorias()->create(['nombre' => 'Puertas']);
    $this->puerta = $this->negocio->productos()->create(['nombre' => 'Puerta en lámina', 'precio' => 680000, 'disponible' => false, 'categoria_id' => $this->seccion->id, 'descripcion' => 'Calibre 18']);
    $this->lamina = $this->negocio->articulosInventario()->create(['nombre' => 'Lámina', 'tipo' => 'materia_prima', 'unidad' => 'lamina']);
    Inventario::mover($this->lamina, 'entrada', 10);
    Materiales::guardar($this->puerta, [$this->lamina->id => 1], 'fabricar');
});

function entrarComoIsmael($test): void
{
    $test->get('/login')->assertOk();
    AccesosWeb::aprobar(AccesoWeb::latest('id')->first()->codigo, $test->dueno);
    $test->getJson('/login/estado')->assertJsonPath('estado', 'listo');
}

test('«al catálogo» suma a las existencias del producto y lo deja disponible', function () {
    entrarComoIsmael($this);
    $this->post("/negocio/produccion/productos/{$this->puerta->id}/hecho", ['cantidad' => 2, 'destino' => 'catalogo'])->assertSessionHas('ok');
    $this->post("/negocio/produccion/productos/{$this->puerta->id}/hecho", ['cantidad' => 1, 'destino' => 'catalogo'])->assertSessionHas('ok');

    $puerta = $this->puerta->fresh();
    expect($puerta->existencias)->toBe(3.0)->and($puerta->disponible)->toBeTrue()
        ->and($this->lamina->fresh()->cantidad)->toBe(7.0);
    $this->get('/negocio/catalogo')->assertSee('3 en stock');

    // Anular quita lo que había sumado.
    Materiales::anular($this->negocio->producciones()->latest('id')->first(), $this->dueno);
    expect($this->puerta->fresh()->existencias)->toBe(2.0);
});

test('«es de un pedido» descuenta materiales pero no toca el catálogo', function () {
    entrarComoIsmael($this);
    $this->post("/negocio/produccion/productos/{$this->puerta->id}/hecho", ['cantidad' => 1, 'destino' => 'pedido'])->assertSessionHas('ok');

    expect($this->puerta->fresh()->existencias)->toBeNull()
        ->and(ProductoEnEspera::count())->toBe(0)
        ->and($this->lamina->fresh()->cantidad)->toBe(9.0)
        ->and($this->negocio->producciones()->sole()->destino)->toBe('pedido');
});

test('«en espera» se completa con sus especificaciones y se publica como producto nuevo', function () {
    entrarComoIsmael($this);
    $this->post("/negocio/produccion/productos/{$this->puerta->id}/hecho", ['cantidad' => 1, 'destino' => 'espera'])->assertSessionHas('ok');
    $espera = ProductoEnEspera::sole();
    expect($espera->nombre)->toBe('Puerta en lámina')->and($espera->precio)->toBe(680000)->and($espera->estado)->toBe('en_espera');
    $this->get('/negocio/catalogo?pestana=espera')->assertOk()->assertSee('En espera')->assertSee('Completar y publicar');

    // Guardar sin publicar.
    $this->put("/negocio/catalogo/en-espera/{$espera->id}", [
        '_espera' => (string) $espera->id, 'accion' => 'guardar', 'nombre' => 'Puerta en lámina 1,00 × 2,20 m', 'precio' => '$ 760.000',
        'especificaciones' => [['nombre' => 'Ancho', 'valor' => '100 cm'], ['nombre' => 'Alto', 'valor' => '220 cm'], ['nombre' => 'Color', 'valor' => ''], ['nombre' => 'ancho', 'valor' => 'repetida']],
    ])->assertSessionHas('ok');
    expect($espera->fresh()->especificaciones)->toBe([['nombre' => 'Ancho', 'valor' => '100 cm'], ['nombre' => 'Alto', 'valor' => '220 cm']])
        ->and($espera->fresh()->precio)->toBe(760000);

    // Publicar como producto nuevo con su foto.
    $this->put("/negocio/catalogo/en-espera/{$espera->id}", [
        'accion' => 'publicar', 'modo' => 'nuevo', 'nombre' => 'Puerta en lámina 1,00 × 2,20 m', 'precio' => '760000',
        'especificaciones' => [['nombre' => 'Ancho', 'valor' => '100 cm'], ['nombre' => 'Apertura', 'valor' => 'Derecha']],
        'imagen' => UploadedFile::fake()->image('puerta.jpg', 600, 800),
    ])->assertRedirect('/negocio/catalogo')->assertSessionHas('ok');

    $nueva = $this->negocio->productos()->where('nombre', 'Puerta en lámina 1,00 × 2,20 m')->sole();
    expect($nueva->existencias)->toBe(1.0)->and($nueva->disponible)->toBeTrue()
        ->and((int) $nueva->precio)->toBe(760000)
        ->and($nueva->categoria_id)->toBe($this->seccion->id)
        ->and($nueva->atributos)->toBe(['Ancho: 100 cm', 'Apertura: Derecha'])
        ->and($nueva->materiales()->count())->toBe(1)
        ->and($nueva->imagen)->not->toBeNull()
        ->and($espera->fresh()->estado)->toBe('publicado')
        ->and($espera->fresh()->publicado_en)->toBe($nueva->id)
        ->and($this->puerta->fresh()->existencias)->toBeNull();

    // Ya no se puede volver a publicar.
    $this->put("/negocio/catalogo/en-espera/{$espera->id}", ['accion' => 'publicar', 'modo' => 'nuevo', 'nombre' => 'X', 'precio' => 1])->assertSessionHasErrors('espera');
});

test('«en espera» también se puede sumar al producto de partida o descartar', function () {
    $p1 = Terminados::registrar($this->puerta, 2, $this->dueno, null, false, 'espera');
    $p2 = Terminados::registrar($this->puerta, 1, $this->dueno, null, false, 'espera');
    [$e1, $e2] = [ProductoEnEspera::where('produccion_id', $p1->id)->sole(), ProductoEnEspera::where('produccion_id', $p2->id)->sole()];
    entrarComoIsmael($this);

    $this->put("/negocio/catalogo/en-espera/{$e1->id}", ['accion' => 'publicar', 'modo' => 'sumar', 'nombre' => 'Puerta en lámina'])->assertSessionHas('ok');
    expect($this->puerta->fresh()->existencias)->toBe(2.0)->and($this->negocio->productos()->count())->toBe(1);

    $this->post("/negocio/catalogo/en-espera/{$e2->id}/descartar")->assertSessionHas('ok');
    expect($e2->fresh()->estado)->toBe('descartado')->and($this->puerta->fresh()->existencias)->toBe(2.0);

    // Anular una producción que sigue en espera la quita de la lista.
    $p3 = Terminados::registrar($this->puerta, 1, $this->dueno, null, false, 'espera');
    Materiales::anular($p3, $this->dueno);
    expect(ProductoEnEspera::where('produccion_id', $p3->id)->count())->toBe(0);
});

test('publicar en espera exige precio y permiso para cambiar el catálogo', function () {
    $p = Terminados::registrar($this->puerta, 1, $this->dueno, null, false, 'espera');
    $espera = ProductoEnEspera::where('produccion_id', $p->id)->sole();
    $trabajador = User::factory()->create();
    $this->negocio->miembros()->attach($trabajador->id, ['rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false)]);

    $this->get('/login');
    AccesosWeb::aprobar(AccesoWeb::latest('id')->first()->codigo, $trabajador);
    $this->getJson('/login/estado');
    $this->put("/negocio/catalogo/en-espera/{$espera->id}", ['accion' => 'publicar', 'modo' => 'nuevo', 'nombre' => 'X', 'precio' => 1])->assertForbidden();

    $this->post('/negocio/salir');
    entrarComoIsmael($this);
    $this->put("/negocio/catalogo/en-espera/{$espera->id}", ['accion' => 'publicar', 'modo' => 'nuevo', 'nombre' => 'Puerta', 'precio' => ''])->assertSessionHasErrors('precio');
    expect($espera->fresh()->estado)->toBe('en_espera');
});

test('las unidades en stock se editan en el formulario del producto y vacío deja de contarlas', function () {
    entrarComoIsmael($this);
    $tipo = \App\Models\TipoProducto::where('slug', 'otro')->value('id');
    $base = ['_producto' => (string) $this->puerta->id, 'nombre' => 'Puerta en lámina', 'precio' => '680000', 'tipo_producto_id' => $tipo, 'venta' => 'cantidad', 'disponible' => 1];

    $this->put("/negocio/catalogo/productos/{$this->puerta->id}", $base + ['existencias' => '4'])->assertSessionHas('ok');
    expect($this->puerta->fresh()->existencias)->toBe(4.0);
    $this->put("/negocio/catalogo/productos/{$this->puerta->id}", $base + ['existencias' => 'muchas'])->assertSessionHasErrors('existencias');
    $this->put("/negocio/catalogo/productos/{$this->puerta->id}", $base + ['existencias' => ''])->assertSessionHas('ok');
    expect($this->puerta->fresh()->existencias)->toBeNull();
});

test('la app lista lo que se puede producir y registra como hecho con su destino', function () {
    \Laravel\Sanctum\Sanctum::actingAs($this->dueno);
    $base = "/api/negocios/{$this->negocio->id}/produccion";

    $this->getJson($base)->assertOk()
        ->assertJsonPath('productos.0.nombre', 'Puerta en lámina')
        ->assertJsonPath('productos.0.alcanza', 10)
        ->assertJsonPath('productos.0.materiales.0.unidad_varios', 'láminas')
        ->assertJsonCount(3, 'destinos');
    $this->getJson('/api/negocios/mios')->assertJsonPath('negocios.0.puede_producir', true);

    $this->postJson("$base/{$this->puerta->id}/hecho", ['cantidad' => '2', 'destino' => 'catalogo'])->assertOk()
        ->assertJsonPath('producto.existencias', 2)
        ->assertJsonPath('produccion.destino', 'catalogo');
    expect($this->lamina->fresh()->cantidad)->toBe(8.0);

    // Falta material: 422 con lo que falta; con aunque_falte se registra.
    $this->postJson("$base/{$this->puerta->id}/hecho", ['cantidad' => 12, 'destino' => 'pedido'])->assertStatus(422)
        ->assertJsonPath('faltantes.0.nombre', 'Lámina')
        ->assertJsonPath('faltantes.0.falta', '4 láminas');
    $this->postJson("$base/{$this->puerta->id}/hecho", ['cantidad' => 12, 'destino' => 'pedido', 'aunque_falte' => true])->assertOk();
    expect($this->lamina->fresh()->cantidad)->toBe(0.0);
});

test('en la app producción exige el módulo y el permiso', function () {
    $trabajador = User::factory()->create();
    $this->negocio->miembros()->attach($trabajador->id, ['rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false)]);
    \Laravel\Sanctum\Sanctum::actingAs($trabajador);
    $base = "/api/negocios/{$this->negocio->id}/produccion";

    $this->getJson($base)->assertForbidden();
    $this->getJson('/api/negocios/mios')->assertJsonPath('negocios.0.puede_producir', false);
    Gestion::guardarPermisos($this->negocio, $trabajador, ['produccion.gestionar']);
    $this->getJson($base)->assertOk();
    $this->postJson("$base/{$this->puerta->id}/hecho", ['cantidad' => 1, 'destino' => 'espera'])->assertOk();
    expect(ProductoEnEspera::sole()->user_id)->toBe($trabajador->id);

    Gestion::definirModulos($this->negocio, ['inventario']);
    $this->getJson($base)->assertForbidden();
    \Laravel\Sanctum\Sanctum::actingAs(User::factory()->create());
    $this->getJson($base)->assertForbidden();
});
