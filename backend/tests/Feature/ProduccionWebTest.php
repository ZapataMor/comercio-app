<?php

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Materiales;
use App\Models\AccesoWeb;
use App\Models\InventarioArticulo;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Produccion;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    Notification::fake();
    $this->dueno = User::factory()->create(['name' => 'Ismael']);
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Grumar', 'direccion' => 'Calle 10', 'barrio' => 'Centro', 'activo' => true, 'tiempo_preparacion' => 20]);
    $this->trabajador = User::factory()->create(['name' => 'Ayudante']);
    $this->negocio->miembros()->attach($this->trabajador->id, ['rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false)]);
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['produccion']);

    $this->porton = $this->negocio->productos()->create(['nombre' => 'Portón', 'precio' => 1500000, 'disponible' => true]);
    $this->soldadura = prodArticulo($this->negocio, 'Soldadura 6013', 'insumo', 'unidad', 100, 400);
    $this->lamina = prodArticulo($this->negocio, 'Lámina 1,22 x 2,44', 'materia_prima', 'lamina', 3, 118000);
    $this->varilla = prodArticulo($this->negocio, 'Varilla 3/8', 'materia_prima', 'unidad', 25, 9000);
});

function prodArticulo(Negocio $negocio, string $nombre, string $tipo, string $unidad, float $cantidad, ?int $costo = null): InventarioArticulo
{
    $a = $negocio->articulosInventario()->create(['nombre' => $nombre, 'tipo' => $tipo, 'unidad' => $unidad, 'costo' => $costo]);
    if ($cantidad > 0) {
        Inventario::mover($a, 'entrada', $cantidad);
    }

    return $a->fresh();
}

function entrarAlPanelProduccion($test, User $user): void
{
    $test->get('/login')->assertOk();
    AccesosWeb::aprobar(AccesoWeb::latest('id')->first()->codigo, $user);
    $test->getJson('/login/estado')->assertJsonPath('estado', 'listo');
}

/** El portón del ejemplo: 10 soldaduras, 1 lámina y 10 varillas 3/8. */
function recetaPorton($test, string $modo = 'fabricar'): void
{
    Materiales::guardar($test->porton, [$test->soldadura->id => 10, $test->lamina->id => 1, $test->varilla->id => 10], $modo);
}

function pedidoCon(Negocio $negocio, Producto $producto, float $cantidad, string $estado = 'aceptado'): Pedido
{
    $pedido = $negocio->pedidos()->create([
        'user_id' => User::factory()->create()->id, 'estado' => $estado, 'metodo_pago' => 'efectivo',
        'subtotal' => 10000, 'costo_domicilio' => 4000, 'total' => 14000,
        'direccion_entrega' => 'Calle 1 #2-3', 'telefono_contacto' => '3001234567', 'minutos_preparacion' => 20,
    ]);
    $pedido->items()->create(['producto_id' => $producto->id, 'nombre' => $producto->nombre, 'precio' => 10000, 'cantidad' => $cantidad]);

    return $pedido;
}

test('el módulo ya funciona, tiene su página y depende del inventario', function () {
    expect(Gestion::tieneModulo($this->negocio, 'inventario'))->toBeTrue();
    entrarAlPanelProduccion($this, $this->dueno);

    $this->get('/negocio')->assertSee('/negocio/produccion')->assertDontSee('/negocio/modulos/produccion');
    $this->get('/negocio/produccion')->assertOk()->assertSee('Ningún producto tiene materiales todavía')->assertSee('+ Definir materiales de un producto');
});

test('se definen los materiales desde la web y el catálogo los muestra con cuántos alcanzan', function () {
    entrarAlPanelProduccion($this, $this->dueno);

    $this->from('/negocio/catalogo')->put("/negocio/produccion/productos/{$this->porton->id}/materiales", [
        '_materiales' => (string) $this->porton->id,
        'materiales_al' => 'fabricar',
        'materiales' => [
            ['articulo_id' => $this->soldadura->id, 'cantidad' => '10'],
            ['articulo_id' => $this->lamina->id, 'cantidad' => '1'],
            ['articulo_id' => $this->varilla->id, 'cantidad' => '10'],
            ['articulo_id' => '', 'cantidad' => ''], // fila vacía: se ignora
        ],
    ])->assertRedirect('/negocio/catalogo')->assertSessionHas('abrir', 'producto-'.$this->porton->id);

    $this->porton->refresh();
    expect($this->porton->materiales->pluck('pivot.cantidad', 'nombre')->map(fn ($c) => (float) $c)->all())
        ->toEqual(['Lámina 1,22 x 2,44' => 1.0, 'Soldadura 6013' => 10.0, 'Varilla 3/8' => 10.0])
        // 25 varillas / 10 = 2 portones; las láminas alcanzan para 3.
        ->and(Materiales::alcanza($this->porton))->toBe(2)
        ->and(Materiales::costo($this->porton))->toBe(['costo' => 4000 + 118000 + 90000, 'completo' => true]);

    $this->get('/negocio/catalogo')->assertOk()->assertSee('Materiales que gasta')->assertSee('Alcanza para 2')->assertSee('Registrar como hecho');
    $this->get('/negocio/produccion')->assertOk()->assertSee('Portón')->assertSee('Alcanza para 2');
    $this->get('/negocio/inventario')->assertSee('Se usa en')->assertSee('Portón · 10 unidades');
});

test('no se aceptan materiales repetidos ni de otro negocio', function () {
    entrarAlPanelProduccion($this, $this->dueno);
    $ajeno = prodArticulo(User::factory()->create()->negocio()->create(['nombre' => 'Otro', 'direccion' => 'C', 'barrio' => 'B']), 'Ajeno', 'otro', 'unidad', 5);
    $url = "/negocio/produccion/productos/{$this->porton->id}/materiales";

    $this->put($url, ['materiales_al' => 'fabricar', 'materiales' => [['articulo_id' => $ajeno->id, 'cantidad' => 1]]])->assertSessionHasErrors('materiales.0.articulo_id');
    $this->put($url, ['materiales_al' => 'fabricar', 'materiales' => [['articulo_id' => $this->lamina->id, 'cantidad' => 1], ['articulo_id' => $this->lamina->id, 'cantidad' => 2]]])->assertSessionHasErrors('materiales');
    $this->put($url, ['materiales_al' => 'fabricar', 'materiales' => [['articulo_id' => $this->lamina->id, 'cantidad' => '0']]])->assertSessionHasErrors('materiales.0.cantidad');
    expect($this->porton->materiales()->count())->toBe(0);
});

test('registrar un portón hecho descuenta sus materiales y queda en el historial', function () {
    recetaPorton($this);
    entrarAlPanelProduccion($this, $this->dueno);

    $this->post("/negocio/produccion/productos/{$this->porton->id}/hecho", ['cantidad' => '2', 'nota' => 'Para el señor Pérez'])->assertSessionHas('ok');

    expect($this->soldadura->fresh()->cantidad)->toBe(80.0)
        ->and($this->lamina->fresh()->cantidad)->toBe(1.0)
        ->and($this->varilla->fresh()->cantidad)->toBe(5.0);
    $p = Produccion::sole();
    expect($p->cantidad)->toBe(2.0)->and($p->origen)->toBe('manual')->and($p->user_id)->toBe($this->dueno->id)
        ->and($p->costo)->toBe(2 * (4000 + 118000 + 90000))
        ->and($p->movimientos()->count())->toBe(3)
        ->and($this->varilla->movimientos()->latest('id')->first()->nota)->toBe('Se hizo: 2 × Portón');

    $this->get('/negocio/produccion?pestana=historial')->assertSee('2 × Portón')->assertSee('Para el señor Pérez');
});

test('si no alcanza no se registra, salvo que se pida descontar lo que haya', function () {
    recetaPorton($this);
    entrarAlPanelProduccion($this, $this->dueno);
    $url = "/negocio/produccion/productos/{$this->porton->id}/hecho";

    // 3 portones necesitan 30 varillas y solo hay 25.
    $this->post($url, ['cantidad' => 3])->assertSessionHasErrors('cantidad');
    expect(session('errors')->first('cantidad'))->toContain('5 unidades de «Varilla 3/8»');
    expect(Produccion::count())->toBe(0)->and($this->varilla->fresh()->cantidad)->toBe(25.0);

    $this->post($url, ['cantidad' => 3, 'aunque_falte' => 1])->assertSessionHas('ok');
    $p = Produccion::sole();
    expect($this->varilla->fresh()->cantidad)->toBe(0.0)->and($this->lamina->fresh()->cantidad)->toBe(0.0)
        ->and($p->faltantes)->toBe([['articulo_id' => $this->varilla->id, 'nombre' => 'Varilla 3/8', 'falto' => 5, 'unidad' => 'unidad']]);
});

test('anular devuelve los materiales al inventario', function () {
    recetaPorton($this);
    entrarAlPanelProduccion($this, $this->dueno);
    $p = Materiales::registrar($this->porton, 1, $this->dueno);
    expect($this->lamina->fresh()->cantidad)->toBe(2.0);

    $this->post("/negocio/produccion/{$p->id}/anular")->assertSessionHas('ok');
    expect($this->lamina->fresh()->cantidad)->toBe(3.0)->and($this->varilla->fresh()->cantidad)->toBe(25.0)
        ->and($p->fresh()->anulada())->toBeTrue();
    $this->post("/negocio/produccion/{$p->id}/anular")->assertSessionHasErrors('produccion');
    expect($this->lamina->fresh()->cantidad)->toBe(3.0);
});

test('con «cada pedido», el pedido descuenta al quedar listo y solo una vez', function () {
    // Un restaurante: la hamburguesa gasta 1 pan y 0,15 kg de carne.
    $hamburguesa = $this->negocio->productos()->create(['nombre' => 'Hamburguesa', 'precio' => 18000, 'disponible' => true]);
    $pan = prodArticulo($this->negocio, 'Pan', 'insumo', 'unidad', 10);
    $carne = prodArticulo($this->negocio, 'Carne molida', 'insumo', 'kg', 1);
    Materiales::guardar($hamburguesa, [$pan->id => 1, $carne->id => 0.15], 'pedido');
    recetaPorton($this); // «al registrar»: un pedido no lo descuenta

    $pedido = pedidoCon($this->negocio, $hamburguesa, 3);
    $pedido->items()->create(['producto_id' => $this->porton->id, 'nombre' => 'Portón', 'precio' => 1, 'cantidad' => 1]);
    Sanctum::actingAs($this->dueno);
    $this->putJson("/api/negocios/{$this->negocio->id}/pedidos/{$pedido->id}/listo")->assertOk();

    expect($pan->fresh()->cantidad)->toBe(7.0)->and($carne->fresh()->cantidad)->toBe(0.55)
        ->and($this->lamina->fresh()->cantidad)->toBe(3.0);
    $p = Produccion::sole();
    expect($p->origen)->toBe('pedido')->and($p->pedido_id)->toBe($pedido->id)->and($p->cantidad)->toBe(3.0);

    // Repetir no descuenta otra vez, y cancelar después no devuelve: ya se preparó.
    Materiales::descontarPedido($pedido->fresh());
    expect($pan->fresh()->cantidad)->toBe(7.0)->and(Produccion::count())->toBe(1);
});

test('un pedido nunca se frena por falta de material: descuenta lo que hay y anota lo que faltó', function () {
    $hamburguesa = $this->negocio->productos()->create(['nombre' => 'Hamburguesa', 'precio' => 18000, 'disponible' => true]);
    $pan = prodArticulo($this->negocio, 'Pan', 'insumo', 'unidad', 2);
    Materiales::guardar($hamburguesa, [$pan->id => 1], 'pedido');
    $pedido = pedidoCon($this->negocio, $hamburguesa, 5);

    Sanctum::actingAs($this->dueno);
    $this->putJson("/api/negocios/{$this->negocio->id}/pedidos/{$pedido->id}/listo")->assertOk();
    expect($pedido->fresh()->estado)->toBe('listo')->and($pan->fresh()->cantidad)->toBe(0.0)
        ->and(Produccion::sole()->faltantes[0]['falto'])->toEqual(3);
});

test('sin el módulo de producción, marcar listo no toca el inventario', function () {
    $hamburguesa = $this->negocio->productos()->create(['nombre' => 'Hamburguesa', 'precio' => 18000, 'disponible' => true]);
    $pan = prodArticulo($this->negocio, 'Pan', 'insumo', 'unidad', 10);
    Materiales::guardar($hamburguesa, [$pan->id => 1], 'pedido');
    Gestion::definirModulos($this->negocio, ['inventario']);
    $pedido = pedidoCon($this->negocio, $hamburguesa, 2);

    Sanctum::actingAs($this->dueno);
    $this->putJson("/api/negocios/{$this->negocio->id}/pedidos/{$pedido->id}/listo")->assertOk();
    expect($pan->fresh()->cantidad)->toBe(10.0)->and(Produccion::count())->toBe(0);
});

test('el trabajador necesita el permiso de producción para cambiar materiales o registrar', function () {
    recetaPorton($this);
    entrarAlPanelProduccion($this, $this->trabajador);
    $this->get('/negocio/produccion')->assertForbidden();

    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['inventario.ver']);
    $this->get('/negocio/produccion')->assertForbidden();
    $this->post("/negocio/produccion/productos/{$this->porton->id}/hecho", ['cantidad' => 1])->assertForbidden();

    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['produccion.gestionar']);
    $this->get('/negocio/produccion')->assertOk()->assertSee('Registrar como hecho');
    $this->post("/negocio/produccion/productos/{$this->porton->id}/hecho", ['cantidad' => 1])->assertSessionHas('ok');
    expect($this->lamina->fresh()->cantidad)->toBe(2.0);
});

test('no se registra un producto sin materiales ni uno de otro negocio', function () {
    entrarAlPanelProduccion($this, $this->dueno);
    $this->post("/negocio/produccion/productos/{$this->porton->id}/hecho", ['cantidad' => 1])->assertSessionHasErrors('cantidad');

    $ajeno = User::factory()->create()->negocio()->create(['nombre' => 'Otro', 'direccion' => 'C', 'barrio' => 'B'])
        ->productos()->create(['nombre' => 'Ajeno', 'precio' => 1]);
    $this->post("/negocio/produccion/productos/{$ajeno->id}/hecho", ['cantidad' => 1])->assertNotFound();
    $this->put("/negocio/produccion/productos/{$ajeno->id}/materiales", ['materiales_al' => 'fabricar'])->assertNotFound();
    expect(fn () => Materiales::guardar($this->porton, [$this->lamina->id => 1], 'nunca'))->toThrow(ValidationException::class);
});
