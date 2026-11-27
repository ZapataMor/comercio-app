<?php

use App\Gestion\AccesosWeb;
use App\Gestion\Etapas;
use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Modelos;
use App\Models\AccesoWeb;
use App\Models\InventarioArticulo;
use App\Models\ModeloProduccion;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Produccion;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

/*
 * Materiales y producción: modelos con materiales predeterminados y la
 * producción por etapas (por hacer → ponerle nombre → catálogo).
 */
beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    Notification::fake();
    Storage::fake('public');
    $this->dueno = User::factory()->create(['name' => 'Ismael']);
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Grumar', 'direccion' => 'Calle 10', 'barrio' => 'Centro', 'activo' => true, 'tiempo_preparacion' => 20]);
    $this->trabajador = User::factory()->create(['name' => 'Andrés']);
    $this->negocio->miembros()->attach($this->trabajador->id, ['rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false)]);
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['inventario']);

    $this->varilla = etapaArticulo($this->negocio, 'Varilla 3/8', 'unidad', 20, 9000);
    $this->pintura = etapaArticulo($this->negocio, 'Pintura anticorrosiva', 'gal', 3, 60000);
    $this->soldadura = etapaArticulo($this->negocio, 'Soldadura 6013', 'kg', 5, 24000);
    $this->pulidora = etapaArticulo($this->negocio, 'Pulidora', 'unidad', 2, null, 'herramienta');
    // La reja del ejemplo: 6 varillas y 1 galón de pintura.
    $this->reja = Modelos::guardar($this->negocio, null, ['nombre' => 'Reja de ventana'], [$this->varilla->id => 6, $this->pintura->id => 1]);
});

function etapaArticulo(Negocio $negocio, string $nombre, string $unidad, float $cantidad, ?int $costo = null, string $tipo = 'material'): InventarioArticulo
{
    $a = $negocio->articulosInventario()->create(['nombre' => $nombre, 'tipo' => $tipo, 'unidad' => $unidad, 'costo' => $costo]);
    if ($cantidad > 0) {
        Inventario::mover($a, 'entrada', $cantidad);
    }

    return $a->fresh();
}

function entrarAMateriales($test, User $user): void
{
    $test->get('/login')->assertOk();
    AccesosWeb::aprobar(AccesoWeb::latest('id')->first()->codigo, $user);
    $test->getJson('/login/estado')->assertJsonPath('estado', 'listo');
}

function pedidoConModelo(Negocio $negocio, Producto $producto, float $cantidad): Pedido
{
    $pedido = $negocio->pedidos()->create([
        'user_id' => User::factory()->create()->id, 'estado' => 'aceptado', 'metodo_pago' => 'efectivo',
        'subtotal' => 10000, 'costo_domicilio' => 4000, 'total' => 14000,
        'direccion_entrega' => 'Calle 1 #2-3', 'telefono_contacto' => '3001234567', 'minutos_preparacion' => 20,
    ]);
    $pedido->items()->create(['producto_id' => $producto->id, 'nombre' => $producto->nombre, 'precio' => 10000, 'cantidad' => $cantidad]);

    return $pedido;
}

/** Filas del formulario de la etapa 1 a partir de articulo_id => cantidad. */
function filasEtapa(array $filas): array
{
    return collect($filas)->map(fn ($c, $id) => ['articulo_id' => $id, 'cantidad' => (string) $c])->values()->all();
}

test('un solo módulo con Materiales, Herramientas, Producción y Modelos', function () {
    entrarAMateriales($this, $this->dueno);

    $this->get('/negocio')->assertSee('Materiales y producción')->assertDontSee('Producción y materiales');
    $this->get('/negocio/inventario')->assertOk()->assertSee('Varilla 3/8')->assertDontSee('Pulidora')
        ->assertSee('/negocio/inventario/produccion')->assertSee('/negocio/inventario/modelos');
    $this->get('/negocio/inventario?tipo=herramienta')->assertOk()->assertSee('Pulidora')->assertDontSee('Varilla 3/8');
    $this->get('/negocio/inventario/produccion')->assertOk()->assertSee('No hay nada en proceso')->assertSee('+ Nueva producción');
    $this->get('/negocio/inventario/modelos')->assertOk()->assertSee('Reja de ventana')->assertSee('Alcanza para 3');
    // El catálogo ya no tiene «En espera» ni materiales.
    $this->get('/negocio/catalogo')->assertOk()->assertDontSee('En espera')->assertDontSee('Materiales que gasta');
});

test('los modelos guardan materiales por unidad y no aceptan herramientas, repetidos ni ajenos', function () {
    entrarAMateriales($this, $this->dueno);
    $porton = $this->negocio->productos()->create(['nombre' => 'Portón negro', 'precio' => 1500000]);

    $this->post('/negocio/inventario/modelos', [
        '_modelo' => 'nuevo', 'nombre' => 'Portón', 'al_pedido' => '0', 'productos' => [$porton->id],
        'materiales' => [['articulo_id' => $this->varilla->id, 'cantidad' => '10'], ['articulo_id' => $this->soldadura->id, 'cantidad' => '0,5'], ['articulo_id' => '', 'cantidad' => '']],
    ])->assertSessionHas('ok');
    $modelo = ModeloProduccion::where('nombre', 'Portón')->sole();
    expect($modelo->materiales->pluck('pivot.cantidad', 'nombre')->map(fn ($c) => (float) $c)->all())->toEqual(['Soldadura 6013' => 0.5, 'Varilla 3/8' => 10.0])
        ->and($porton->fresh()->modelo_id)->toBe($modelo->id)
        ->and(Modelos::alcanza($modelo))->toBe(2)
        ->and(Modelos::costo($modelo))->toBe(['costo' => 90000 + 12000, 'completo' => true]);

    $url = "/negocio/inventario/modelos/{$modelo->id}";
    $this->put($url, ['nombre' => 'Portón', 'materiales' => [['articulo_id' => $this->pulidora->id, 'cantidad' => 1]]])->assertSessionHasErrors('materiales');
    $this->put($url, ['nombre' => 'Portón', 'materiales' => [['articulo_id' => $this->varilla->id, 'cantidad' => 1], ['articulo_id' => $this->varilla->id, 'cantidad' => 2]]])->assertSessionHasErrors('materiales');
    $ajeno = etapaArticulo(User::factory()->create()->negocio()->create(['nombre' => 'Otro', 'direccion' => 'C', 'barrio' => 'B']), 'Ajeno', 'unidad', 1);
    $this->put($url, ['nombre' => 'Portón', 'materiales' => [['articulo_id' => $ajeno->id, 'cantidad' => 1]]])->assertSessionHasErrors('materiales.0.articulo_id');
    $this->put($url, ['nombre' => 'Portón', 'al_pedido' => '1', 'materiales' => []])->assertSessionHasErrors('materiales');
    expect($modelo->materiales()->count())->toBe(2);

    // Quitarle el producto lo desliga; eliminar el modelo deja el producto.
    $this->put($url, ['nombre' => 'Portón', 'materiales' => [['articulo_id' => $this->varilla->id, 'cantidad' => 10]], 'productos' => []])->assertSessionHas('ok');
    expect($porton->fresh()->modelo_id)->toBeNull();
    $this->delete($url)->assertSessionHas('ok');
    expect(ModeloProduccion::find($modelo->id))->toBeNull()->and($porton->fresh())->not->toBeNull();
});

test('etapa 1: de un modelo salen sus materiales y se ajustan con más, menos y añadidos', function () {
    entrarAMateriales($this, $this->dueno);

    $this->post('/negocio/inventario/produccion', ['modelo_id' => $this->reja->id, 'cantidad' => '2', 'nota' => 'Casa del señor Pérez'])->assertSessionHas('ok');
    $p = Produccion::sole();
    expect($p->estado)->toBe(Produccion::POR_HACER)->and($p->nombre)->toBe('Reja de ventana')->and($p->user_id)->toBe($this->dueno->id)
        ->and($p->materiales->mapWithKeys(fn ($a) => [$a->nombre => [(float) $a->pivot->cantidad, (float) $a->pivot->normal]])->all())
        ->toEqual(['Pintura anticorrosiva' => [2.0, 2.0], 'Varilla 3/8' => [12.0, 12.0]]);
    // Todavía no se descuenta nada.
    expect($this->varilla->fresh()->cantidad)->toBe(20.0);
    $this->get('/negocio/inventario/produccion')->assertSee('Por hacer')->assertSee('Lo normal: 12 unidades')->assertSee('Terminada: descontar materiales');

    // Se usaron 2 varillas de más, 1 galón menos, y 0,5 kg de soldadura aparte.
    $this->put("/negocio/inventario/produccion/{$p->id}", [
        '_produccion' => $p->id, 'accion' => 'guardar', 'cantidad' => '2',
        'materiales' => filasEtapa([$this->varilla->id => 14, $this->pintura->id => 1, $this->soldadura->id => '0,5']),
    ])->assertSessionHas('ok');
    $p->refresh();
    expect($p->materiales->mapWithKeys(fn ($a) => [$a->nombre => [(float) $a->pivot->cantidad, $a->pivot->normal === null ? null : (float) $a->pivot->normal]])->all())
        ->toEqual(['Pintura anticorrosiva' => [1.0, 2.0], 'Soldadura 6013' => [0.5, null], 'Varilla 3/8' => [14.0, 12.0]]);

    // Un material del modelo en cero se queda (se ve que no se usó); uno añadido en cero se quita.
    $this->put("/negocio/inventario/produccion/{$p->id}", ['accion' => 'guardar', 'cantidad' => '2', 'materiales' => filasEtapa([$this->varilla->id => 14, $this->pintura->id => 0, $this->soldadura->id => 0])]);
    expect($p->materiales()->pluck('nombre')->all())->toBe(['Pintura anticorrosiva', 'Varilla 3/8']);

    // Herramientas no; cancelar la borra sin tocar el inventario.
    $this->put("/negocio/inventario/produccion/{$p->id}", ['accion' => 'guardar', 'cantidad' => '2', 'materiales' => filasEtapa([$this->pulidora->id => 1])])->assertSessionHasErrors('materiales');
    $this->delete("/negocio/inventario/produccion/{$p->id}")->assertSessionHas('ok');
    expect(Produccion::count())->toBe(0)->and($this->varilla->fresh()->cantidad)->toBe(20.0);
});

test('sin modelo se escribe qué es y se añaden los materiales', function () {
    entrarAMateriales($this, $this->dueno);
    $this->post('/negocio/inventario/produccion', ['cantidad' => '1'])->assertSessionHasErrors('nombre');
    $this->post('/negocio/inventario/produccion', ['nombre' => 'Baranda de escalera', 'cantidad' => '1'])->assertSessionHas('ok');

    $p = Produccion::sole();
    expect($p->modelo_id)->toBeNull()->and($p->materiales()->count())->toBe(0);
    $this->put("/negocio/inventario/produccion/{$p->id}", ['accion' => 'terminar', 'cantidad' => '1', 'materiales' => filasEtapa([$this->varilla->id => 4])])->assertSessionHas('ok');
    expect($this->varilla->fresh()->cantidad)->toBe(16.0)->and($p->fresh()->estado)->toBe(Produccion::TERMINADA);
});

test('terminar descuenta lo ajustado; si no alcanza no termina salvo descontar lo que haya', function () {
    entrarAMateriales($this, $this->dueno);
    $p = Etapas::crear($this->negocio, $this->reja, null, 4, $this->dueno);
    $url = "/negocio/inventario/produccion/{$p->id}";

    // 4 rejas: 24 varillas (hay 20) y 4 galones (hay 3).
    $this->put($url, ['_produccion' => $p->id, 'accion' => 'terminar', 'cantidad' => '4', 'materiales' => filasEtapa([$this->varilla->id => 24, $this->pintura->id => 4])])
        ->assertSessionHasErrors('materiales');
    expect($p->fresh()->estado)->toBe(Produccion::POR_HACER)->and($this->varilla->fresh()->cantidad)->toBe(20.0);

    $this->put($url, ['accion' => 'terminar', 'cantidad' => '4', 'aunque_falte' => '1', 'materiales' => filasEtapa([$this->varilla->id => 24, $this->pintura->id => 4])])->assertSessionHas('ok');
    $p->refresh();
    expect($p->estado)->toBe(Produccion::TERMINADA)->and($p->terminada_at)->not->toBeNull()
        ->and($this->varilla->fresh()->cantidad)->toBe(0.0)->and($this->pintura->fresh()->cantidad)->toBe(0.0)
        ->and(collect($p->faltantes)->pluck('falto', 'nombre')->map(fn ($f) => (float) $f)->all())->toEqual(['Pintura anticorrosiva' => 1.0, 'Varilla 3/8' => 4.0])
        ->and($p->costo)->toBe(24 * 9000 + 4 * 60000)
        ->and($this->varilla->movimientos()->latest('id')->first()->nota)->toBe('Se hizo: 4 × Reja de ventana');

    // Ya no se puede volver a terminar ni editar la etapa 1.
    $this->put($url, ['accion' => 'terminar', 'cantidad' => '4', 'materiales' => []])->assertSessionHasErrors('produccion');
});

test('etapa 2: con nombre, precio y foto llega al catálogo como producto nuevo', function () {
    entrarAMateriales($this, $this->dueno);
    $seccion = $this->negocio->categorias()->create(['nombre' => 'Rejas']);
    $p = Etapas::terminar(Etapas::crear($this->negocio, $this->reja, null, 1, $this->trabajador), $this->trabajador);
    $url = "/negocio/inventario/produccion/{$p->id}/nombre";
    $this->get('/negocio/inventario/produccion')->assertSee('Ponerle nombre')->assertSee('Publicar en el catálogo');

    $datos = ['_nombrar' => $p->id, 'nombre' => 'Reja de ventana 1,2 × 1 m', 'categoria_id' => $seccion->id, 'descripcion' => 'Con anticorrosivo',
        'especificaciones' => [['nombre' => 'Ancho', 'valor' => '120 cm'], ['nombre' => 'Color', 'valor' => 'Negro'], ['nombre' => '', 'valor' => '']]];
    // Sin precio no se publica, pero sí se guarda.
    $this->put($url, $datos + ['accion' => 'publicar', 'modo' => 'nuevo', 'precio' => ''])->assertSessionHasErrors('precio');
    $this->put($url, $datos + ['accion' => 'guardar', 'precio' => '380.000', 'imagen' => UploadedFile::fake()->image('reja.jpg', 800, 600)])->assertSessionHas('ok');
    expect($p->fresh()->precio)->toBe(380000)->and($p->fresh()->estado)->toBe(Produccion::TERMINADA);

    $this->put($url, $datos + ['accion' => 'publicar', 'modo' => 'nuevo', 'precio' => '380000'])->assertSessionHas('ok');
    $producto = $this->negocio->productos()->where('nombre', 'Reja de ventana 1,2 × 1 m')->sole();
    $p->refresh();
    expect($producto->existencias)->toBe(1.0)->and($producto->disponible)->toBeTrue()->and((int) $producto->precio)->toBe(380000)
        ->and($producto->categoria_id)->toBe($seccion->id)->and($producto->modelo_id)->toBe($this->reja->id)
        ->and($producto->atributos)->toBe(['Ancho: 120 cm', 'Color: Negro'])
        ->and($producto->imagen)->not->toBeNull()->and($producto->imagen)->not->toBe($p->imagen)
        ->and($p->estado)->toBe(Produccion::PUBLICADA)->and($p->producto_id)->toBe($producto->id);
    Storage::disk('public')->assertExists($producto->imagen);

    // Anular lo publicado devuelve los materiales y quita la unidad del catálogo.
    $this->post("/negocio/inventario/produccion/{$p->id}/anular")->assertSessionHas('ok');
    expect($producto->fresh()->existencias)->toBe(0.0)->and($this->varilla->fresh()->cantidad)->toBe(20.0);
});

test('etapa 2: también se suma a un producto que ya está o queda como encargo', function () {
    entrarAMateriales($this, $this->dueno);
    $igual = $this->negocio->productos()->create(['nombre' => 'Reja estándar', 'precio' => 350000, 'disponible' => false]);
    $igual->forceFill(['existencias' => 2])->save();

    $p = Etapas::terminar(Etapas::crear($this->negocio, $this->reja, null, 2, $this->dueno), $this->dueno);
    $url = "/negocio/inventario/produccion/{$p->id}/nombre";
    $this->put($url, ['nombre' => 'Reja', 'accion' => 'publicar', 'modo' => 'sumar'])->assertSessionHasErrors('producto_id');
    $this->put($url, ['nombre' => 'Reja', 'accion' => 'publicar', 'modo' => 'sumar', 'producto_id' => $igual->id])->assertSessionHas('ok');
    expect($igual->fresh()->existencias)->toBe(4.0)->and($igual->fresh()->disponible)->toBeTrue()->and($igual->fresh()->modelo_id)->toBe($this->reja->id)
        ->and($this->negocio->productos()->count())->toBe(1);

    $otra = Etapas::terminar(Etapas::crear($this->negocio, $this->reja, null, 1, $this->dueno), $this->dueno);
    $this->put("/negocio/inventario/produccion/{$otra->id}/nombre", ['accion' => 'encargo'])->assertSessionHas('ok');
    expect($otra->fresh()->estado)->toBe(Produccion::ENCARGO)->and($this->negocio->productos()->count())->toBe(1);
    $this->get('/negocio/inventario/produccion?pestana=historial')->assertSee('Encargo')->assertSee('En el catálogo');
});

test('permisos: ver con inventario.ver, producir con produccion.gestionar y publicar con el catálogo', function () {
    $p = Etapas::crear($this->negocio, $this->reja, null, 1, $this->dueno);
    entrarAMateriales($this, $this->trabajador);
    $this->get('/negocio/inventario/produccion')->assertForbidden();

    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['inventario.ver']);
    $this->get('/negocio/inventario/produccion')->assertOk()->assertDontSee('+ Nueva producción');
    $this->post('/negocio/inventario/produccion', ['modelo_id' => $this->reja->id, 'cantidad' => 1])->assertForbidden();
    $this->put("/negocio/inventario/produccion/{$p->id}", ['accion' => 'terminar', 'cantidad' => 1, 'materiales' => []])->assertForbidden();
    $this->post('/negocio/inventario/modelos', ['nombre' => 'X'])->assertForbidden();

    // El soldador produce y termina, pero no publica en el catálogo.
    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['produccion.gestionar']);
    $this->get('/negocio/inventario/produccion')->assertOk()->assertSee('+ Nueva producción');
    $this->put("/negocio/inventario/produccion/{$p->id}", ['accion' => 'terminar', 'cantidad' => 1, 'materiales' => filasEtapa([$this->varilla->id => 6, $this->pintura->id => 1])])->assertSessionHas('ok');
    $this->get('/negocio/inventario/produccion')->assertSee('Solo quien puede cambiar el catálogo');
    $this->put("/negocio/inventario/produccion/{$p->id}/nombre", ['nombre' => 'Reja', 'precio' => 1, 'accion' => 'publicar', 'modo' => 'nuevo'])->assertForbidden();
    $this->put("/negocio/inventario/produccion/{$p->id}/nombre", ['accion' => 'encargo'])->assertSessionHas('ok');

    // De otro negocio: no existe.
    $ajena = Etapas::crear(User::factory()->create()->negocio()->create(['nombre' => 'Otro', 'direccion' => 'C', 'barrio' => 'B']), null, 'Algo', 1, null);
    $this->delete("/negocio/inventario/produccion/{$ajena->id}")->assertNotFound();
});

test('con cada pedido: el modelo del producto se descuenta al quedar listo y solo una vez', function () {
    $pan = etapaArticulo($this->negocio, 'Pan', 'unidad', 10);
    $carne = etapaArticulo($this->negocio, 'Carne molida', 'kg', 1);
    $hamburguesa = $this->negocio->productos()->create(['nombre' => 'Hamburguesa', 'precio' => 18000, 'disponible' => true]);
    Modelos::guardar($this->negocio, null, ['nombre' => 'Hamburguesa', 'al_pedido' => true], [$pan->id => 1, $carne->id => 0.15], [$hamburguesa->id]);
    // Uno que se fabrica (no «con cada pedido»): un pedido no lo descuenta.
    $reja = $this->negocio->productos()->create(['nombre' => 'Reja', 'precio' => 1]);
    $reja->forceFill(['modelo_id' => $this->reja->id])->save();

    $pedido = pedidoConModelo($this->negocio, $hamburguesa, 3);
    $pedido->items()->create(['producto_id' => $reja->id, 'nombre' => 'Reja', 'precio' => 1, 'cantidad' => 1]);
    Sanctum::actingAs($this->dueno);
    $this->putJson("/api/negocios/{$this->negocio->id}/pedidos/{$pedido->id}/listo")->assertOk();

    expect($pan->fresh()->cantidad)->toBe(7.0)->and($carne->fresh()->cantidad)->toBe(0.55)->and($this->varilla->fresh()->cantidad)->toBe(20.0);
    $p = Produccion::sole();
    expect($p->estado)->toBe(Produccion::PEDIDO)->and($p->pedido_id)->toBe($pedido->id)->and($p->cantidad)->toBe(3.0);
    Etapas::descontarPedido($pedido->fresh());
    expect($pan->fresh()->cantidad)->toBe(7.0)->and(Produccion::count())->toBe(1);

    // Nunca frena el pedido: descuenta lo que hay y anota lo que faltó.
    $otro = pedidoConModelo($this->negocio, $hamburguesa, 9);
    $this->putJson("/api/negocios/{$this->negocio->id}/pedidos/{$otro->id}/listo")->assertOk();
    expect($pan->fresh()->cantidad)->toBe(0.0)->and(collect(Produccion::where('pedido_id', $otro->id)->sole()->faltantes)->pluck('falto', 'nombre')->all())->toEqual(['Carne molida' => 0.8, 'Pan' => 2]);
});

test('sin Materiales y producción, marcar listo no toca el inventario', function () {
    $pan = etapaArticulo($this->negocio, 'Pan', 'unidad', 10);
    $hamburguesa = $this->negocio->productos()->create(['nombre' => 'Hamburguesa', 'precio' => 18000, 'disponible' => true]);
    Modelos::guardar($this->negocio, null, ['nombre' => 'Hamburguesa', 'al_pedido' => true], [$pan->id => 1], [$hamburguesa->id]);
    Gestion::definirModulos($this->negocio, []);

    Sanctum::actingAs($this->dueno);
    $this->putJson("/api/negocios/{$this->negocio->id}/pedidos/".pedidoConModelo($this->negocio, $hamburguesa, 2)->id.'/listo')->assertOk();
    expect($pan->fresh()->cantidad)->toBe(10.0)->and(Produccion::count())->toBe(0);
});

test('la app anota, ajusta y termina una producción; ponerle nombre queda para la web', function () {
    Sanctum::actingAs($this->dueno);
    $base = "/api/negocios/{$this->negocio->id}/produccion";

    $this->getJson($base)->assertOk()
        ->assertJsonPath('modelos.0.nombre', 'Reja de ventana')
        ->assertJsonPath('modelos.0.alcanza', 3)
        ->assertJsonCount(3, 'materiales') // sin la pulidora
        ->assertJsonPath('por_hacer', []);
    $this->getJson('/api/negocios/mios')->assertJsonPath('negocios.0.puede_producir', true);

    $id = $this->postJson($base, ['modelo_id' => $this->reja->id, 'cantidad' => '1'])->assertCreated()
        ->assertJsonPath('produccion.materiales.1.nombre', 'Varilla 3/8')
        ->assertJsonPath('produccion.materiales.1.normal', 6)
        ->assertJsonPath('produccion.materiales.1.por_unidad', 6)
        ->json('produccion.id');

    $this->putJson("$base/$id", ['cantidad' => 1, 'materiales' => [['articulo_id' => $this->varilla->id, 'cantidad' => 7], ['articulo_id' => $this->pintura->id, 'cantidad' => 1], ['articulo_id' => $this->soldadura->id, 'cantidad' => '0,5']]])
        ->assertOk()->assertJsonCount(3, 'produccion.materiales');
    $this->getJson($base)->assertJsonPath('por_hacer.0.id', $id);

    // Falta material: 422 con lo que falta; con aunque_falte se termina.
    $this->putJson("$base/$id", ['cantidad' => 1, 'terminar' => true, 'materiales' => [['articulo_id' => $this->varilla->id, 'cantidad' => 25]]])
        ->assertStatus(422)->assertJsonPath('faltantes.0.nombre', 'Varilla 3/8')->assertJsonPath('faltantes.0.falta', '5 unidades');
    $this->putJson("$base/$id", ['cantidad' => 1, 'terminar' => true, 'materiales' => [['articulo_id' => $this->varilla->id, 'cantidad' => 7], ['articulo_id' => $this->pintura->id, 'cantidad' => 1]]])
        ->assertOk()->assertJsonPath('produccion.estado', 'terminada');
    expect($this->varilla->fresh()->cantidad)->toBe(13.0);
    $this->getJson($base)->assertJsonPath('para_nombrar', 1)->assertJsonPath('recientes.0.estado', 'terminada');

    $otra = $this->postJson($base, ['nombre' => 'Baranda', 'cantidad' => 1])->assertCreated()->json('produccion.id');
    $this->deleteJson("$base/$otra")->assertOk();
    $this->deleteJson("$base/$id")->assertStatus(422);
});

test('en la app producción exige el módulo y el permiso', function () {
    Sanctum::actingAs($this->trabajador);
    $base = "/api/negocios/{$this->negocio->id}/produccion";

    $this->getJson($base)->assertForbidden();
    $this->getJson('/api/negocios/mios')->assertJsonPath('negocios.0.puede_producir', false);
    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['produccion.gestionar']);
    $this->getJson($base)->assertOk();
    $this->postJson($base, ['modelo_id' => $this->reja->id])->assertCreated();
    expect(Produccion::sole()->user_id)->toBe($this->trabajador->id);

    Gestion::definirModulos($this->negocio, []);
    $this->getJson($base)->assertForbidden();
    Sanctum::actingAs(User::factory()->create());
    $this->getJson($base)->assertForbidden();
});

test('las reglas rechazan cantidades y estados que no van', function () {
    expect(fn () => Etapas::crear($this->negocio, $this->reja, null, 0, null))->toThrow(ValidationException::class)
        ->and(fn () => Etapas::crear($this->negocio, null, '  ', 1, null))->toThrow(ValidationException::class);
    $p = Etapas::crear($this->negocio, $this->reja, null, 1, null);
    expect(fn () => Etapas::publicar($p, 'nuevo'))->toThrow(ValidationException::class)
        ->and(fn () => Etapas::anular($p, null))->toThrow(ValidationException::class);
    Etapas::terminar($p, null);
    expect(fn () => Etapas::cancelar($p))->toThrow(ValidationException::class)
        ->and(fn () => Etapas::guardar($p, 1, []))->toThrow(ValidationException::class);
});
