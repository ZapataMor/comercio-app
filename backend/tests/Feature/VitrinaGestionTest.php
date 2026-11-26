<?php

use App\Events\CambioEnVivo;
use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Gestion\Horario;
use App\Gestion\Modulos;
use App\Models\AccesoWeb;
use App\Models\CategoriaCatalogo;
use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\PlantillaGestion;
use App\Models\Producto;
use App\Models\TareaTrabajo;
use App\Models\TipoProducto;
use App\Models\User;
use App\Notifications\InvitacionTrabajoRecibida;
use App\Support\EnVivo;
use App\Support\GoogleIdToken;
use App\Support\Telefono\EnviadorCodigos;
use App\Support\Telefono\EnviadorLog;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Notification::fake();
    Role::findOrCreate('administrador', 'web');
    $this->super = User::factory()->create();
    $this->super->assignRole('administrador');
    $this->dueno = User::factory()->create(['name' => 'Ismael']);
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Latonería', 'direccion' => 'Calle 10', 'barrio' => 'Centro']);
    $this->trabajador = User::factory()->create(['name' => 'Ayudante']);
    $this->negocio->miembros()->attach($this->trabajador->id, ['rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false)]);
});

/** Después de llamar a la API en la misma prueba, vuelve a ser el navegador (guardia web). */
function comoNavegador($test): void
{
    auth()->forgetGuards();
    app('auth')->shouldUse('web');
}

/** Entra al panel del negocio como lo haría el navegador con la app. */
function entrarAlPanel($test, User $user): void
{
    $test->get('/login')->assertOk();
    $acceso = AccesoWeb::latest('id')->first();
    AccesosWeb::aprobar($acceso->codigo, $user);
    $test->getJson('/login/estado')->assertJsonPath('estado', 'listo');
}

test('el catálogo de módulos resuelve dependencias y dependientes', function () {
    expect(Modulos::conDependencias('caja'))->toBe(['inventario', 'caja'])
        ->and(Modulos::conDependencias('facturacion'))->toBe(['cuentas', 'facturacion'])
        ->and(Modulos::dependientes('inventario'))->toEqualCanonicalizing(['caja', 'produccion', 'compras'])
        ->and(Modulos::nucleo())->toContain('inicio', 'catalogo', 'equipo')
        ->and(Modulos::opcionales())->not->toContain('inicio');
    foreach (Modulos::todos() as $clave => $m) {
        foreach ($m['depende_de'] as $dep) {
            expect(Modulos::existe($dep))->toBeTrue("$clave depende de $dep, que no existe");
        }
    }
});

test('las plantillas iniciales vienen en la migración', function () {
    $latoneria = PlantillaGestion::where('slug', 'latoneria-y-ornamentacion')->firstOrFail();
    expect($latoneria->modulos)->toContain('sedes', 'personal', 'medida')
        ->and(collect($latoneria->campos_producto)->pluck('clave'))->toContain('calibre', 'apertura', 'proteccion');
});

test('solo el super administrador entra a la configuración', function () {
    $this->get('/admin/gestion')->assertRedirect('/login');
    $this->actingAs($this->dueno)->get('/admin/gestion')->assertForbidden();
    $this->actingAs($this->super)->get('/admin/gestion')->assertOk()->assertSee('Catálogo de módulos')->assertSee('Latonería');
    $this->get('/admin/gestion/negocios/'.$this->negocio->id)->assertOk()->assertSee('Encender panel web');
});

test('encender el panel crea la sede principal y queda en el registro de acciones', function () {
    $this->actingAs($this->super)->post('/admin/gestion/negocios/'.$this->negocio->id.'/panel', ['activa' => 1, 'motivo' => 'Contrató gestión'])
        ->assertSessionHas('ok');
    $negocio = $this->negocio->fresh();
    expect($negocio->gestion_activa)->toBeTrue()
        ->and($negocio->sedes()->count())->toBe(1)
        ->and($negocio->sedes()->first()->principal)->toBeTrue()
        ->and($negocio->sedes()->first()->direccion)->toBe('Calle 10')
        ->and(Gestion::modulosActivos($negocio))->toBe(Modulos::nucleo());
    $this->assertDatabaseHas('admin_acciones', ['accion' => 'admin.gestion.panel']);

    $this->post('/admin/gestion/negocios/'.$this->negocio->id.'/panel', ['activa' => 0, 'motivo' => 'Dejó de pagar']);
    expect(Gestion::modulosActivos($negocio->fresh()))->toBe([])
        ->and($negocio->sedes()->count())->toBe(1);
});

test('los módulos se encienden con sus dependencias y la plantilla suma los suyos', function () {
    Gestion::activar($this->negocio);
    $this->actingAs($this->super)->post('/admin/gestion/negocios/'.$this->negocio->id.'/modulos', ['modulos' => ['caja', 'facturacion']])
        ->assertSessionHas('ok', fn ($m) => str_contains($m, 'Inventario') && str_contains($m, 'Cuentas'));
    expect(Gestion::opcionalesEncendidos($this->negocio))->toEqualCanonicalizing(['inventario', 'caja', 'cuentas', 'facturacion']);

    $this->post('/admin/gestion/negocios/'.$this->negocio->id.'/modulos', ['modulos' => ['personal']]);
    expect(Gestion::opcionalesEncendidos($this->negocio))->toBe(['personal']);
    $this->post('/admin/gestion/negocios/'.$this->negocio->id.'/modulos', ['modulos' => ['no-existe']])->assertSessionHasErrors('modulos.0');

    $plantilla = PlantillaGestion::where('slug', 'latoneria-y-ornamentacion')->first();
    $this->post('/admin/gestion/negocios/'.$this->negocio->id.'/plantilla', ['plantilla_gestion_id' => $plantilla->id])->assertSessionHas('ok');
    expect($this->negocio->fresh()->plantilla_gestion_id)->toBe($plantilla->id)
        ->and(Gestion::opcionalesEncendidos($this->negocio))->toContain('personal', 'nomina', 'sedes', 'compras', 'inventario');
});

test('no se apaga «Varias sedes» mientras haya varias sedes activas', function () {
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['sedes']);
    $this->negocio->sedes()->create(['nombre' => 'Fábrica', 'tipo' => 'fabrica']);
    $this->actingAs($this->super)->post('/admin/gestion/negocios/'.$this->negocio->id.'/modulos', ['modulos' => []])->assertSessionHasErrors('modulos');
    expect(Gestion::opcionalesEncendidos($this->negocio))->toBe(['sedes']);
});

test('el super administrador crea plantillas con ficha técnica', function () {
    $this->actingAs($this->super)->post('/admin/gestion/plantillas', [
        'nombre' => 'Vidriería', 'descripcion' => 'Vidrios a la medida', 'activa' => 1,
        'modulos' => ['medida', 'caja'],
        'campos' => [
            ['etiqueta' => 'Grosor', 'tipo' => 'numero', 'unidad' => 'mm', 'requerido' => 1],
            ['etiqueta' => 'Tipo de vidrio', 'tipo' => 'opciones', 'opciones' => 'Templado, Laminado,  , Templado'],
            ['etiqueta' => '', 'tipo' => 'texto'],
        ],
    ])->assertRedirect()->assertSessionHas('ok');
    $p = PlantillaGestion::where('nombre', 'Vidriería')->firstOrFail();
    expect($p->slug)->toBe('vidrieria')
        ->and($p->campos_producto)->toBe([
            ['clave' => 'grosor', 'etiqueta' => 'Grosor', 'tipo' => 'numero', 'requerido' => true, 'unidad' => 'mm'],
            ['clave' => 'tipo_de_vidrio', 'etiqueta' => 'Tipo de vidrio', 'tipo' => 'opciones', 'requerido' => false, 'opciones' => ['Templado', 'Laminado']],
        ])
        ->and($p->modulosCompletos())->toEqualCanonicalizing(['medida', 'inventario', 'caja']);

    $this->get('/admin/gestion/plantillas/'.$p->id)->assertOk()->assertSee('Tipo de vidrio');
    $this->put('/admin/gestion/plantillas/'.$p->id, ['nombre' => 'Vidriería', 'campos' => [['etiqueta' => 'Color', 'tipo' => 'opciones', 'opciones' => 'Solo uno']]])
        ->assertSessionHasErrors('campos.0.opciones');
    expect($p->fresh()->campos_producto)->toHaveCount(2);
});

test('se entra a la web con el código aprobado desde la app', function () {
    Gestion::activar($this->negocio);
    $this->get('/negocio')->assertRedirect('/login');
    $this->get('/login')->assertOk()->assertSee('Iniciar sesión')->assertSee('Código QR');
    $acceso = AccesoWeb::latest('id')->first();
    $this->getJson('/login/estado')->assertJsonPath('estado', 'pendiente');

    // La app: consulta y aprueba (con guion y minúsculas también sirve).
    $codigo = strtolower($acceso->codigoVisible());
    $this->actingAs($this->dueno)->postJson('/api/acceso-web/consultar', ['codigo' => $codigo])->assertOk()->assertJsonStructure(['navegador', 'codigo']);
    $this->postJson('/api/acceso-web/aprobar', ['codigo' => $codigo])->assertOk();
    $this->postJson('/api/acceso-web/aprobar', ['codigo' => $codigo])->assertUnprocessable();
    comoNavegador($this);

    $this->getJson('/login/estado')->assertJsonPath('estado', 'listo');
    $this->get('/negocio')->assertOk()->assertSee('Inicio')->assertSee('Latonería');
    expect(auth()->id())->toBe($this->dueno->id);
    foreach (['tienda', 'catalogo', 'pedidos', 'trabajadores', 'agenda', 'resenas', 'sedes'] as $ruta) {
        $this->get('/negocio/'.$ruta)->assertOk();
    }
});

test('no aprueba códigos vencidos ni de quien no tiene panel web', function () {
    $this->get('/login');
    $acceso = AccesoWeb::latest('id')->first();
    $this->actingAs($this->dueno)->postJson('/api/acceso-web/aprobar', ['codigo' => $acceso->codigo])
        ->assertUnprocessable()->assertJsonPath('errors.codigo.0', fn ($m) => str_contains($m, 'panel web'));
    Gestion::activar($this->negocio);
    $acceso->update(['expira_at' => now()->subSecond()]);
    $this->postJson('/api/acceso-web/aprobar', ['codigo' => $acceso->codigo])
        ->assertUnprocessable()->assertJsonPath('errors.codigo.0', fn ($m) => str_contains($m, 'venció'));
    $this->getJson('/api/acceso-web')->assertJsonPath('disponible', true);
});

test('cerrar la sesión desde la app saca al navegador', function () {
    Gestion::activar($this->negocio);
    entrarAlPanel($this, $this->dueno);
    $this->get('/negocio')->assertOk();

    $acceso = AccesoWeb::where('estado', 'usado')->firstOrFail();
    $this->actingAs($this->dueno)->getJson('/api/acceso-web/sesiones')->assertJsonCount(1, 'data');
    $this->actingAs($this->trabajador)->deleteJson('/api/acceso-web/sesiones/'.$acceso->id)->assertNotFound();
    $this->actingAs($this->dueno)->deleteJson('/api/acceso-web/sesiones/'.$acceso->id)->assertOk();
    comoNavegador($this);

    $this->get('/negocio')->assertRedirect('/login');
    $this->assertGuest();
});

test('la sesión web vence a las 12 horas y si se apaga el panel', function () {
    Gestion::activar($this->negocio);
    entrarAlPanel($this, $this->dueno);
    $this->travel(AccesosWeb::HORAS_SESION + 1)->hours();
    $this->get('/negocio')->assertRedirect('/login');
    $this->travelBack();

    entrarAlPanel($this, $this->dueno);
    Gestion::desactivar($this->negocio);
    $this->get('/negocio')->assertRedirect('/login')->assertSessionHas('error');
});

test('el super administrador con contraseña no pierde su sesión al visitar el panel del negocio', function () {
    $this->actingAs($this->super)->get('/negocio')->assertRedirect('/login');
    $this->assertAuthenticatedAs($this->super);
});

test('el menú y los módulos dependen de lo encendido y de los permisos', function () {
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['caja', 'personal']);
    entrarAlPanel($this, $this->trabajador);

    $this->get('/negocio')->assertOk()->assertSee('/negocio/catalogo')->assertDontSee('/negocio/modulos/caja');
    $this->get('/negocio/modulos/caja')->assertForbidden();
    $this->get('/negocio/modulos/facturacion')->assertForbidden();
    $this->get('/negocio/pedidos')->assertForbidden();
    $this->put('/negocio/trabajadores/'.$this->trabajador->id, ['modulos' => ['caja.vender']])->assertForbidden();

    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['caja.vender']);
    $this->get('/negocio')->assertSee('/negocio/modulos/caja');
    $this->get('/negocio/modulos/caja')->assertOk()->assertSee('Vender en la caja');
    expect(Gestion::puede($this->trabajador, $this->negocio, 'caja.vender'))->toBeTrue()
        ->and(Gestion::puede($this->trabajador, $this->negocio, 'caja.cerrar'))->toBeFalse()
        ->and(Gestion::puede($this->dueno, $this->negocio, 'caja.cerrar'))->toBeTrue();

    // Si se apaga el módulo, el permiso se conserva pero deja de valer.
    Gestion::definirModulos($this->negocio, ['personal']);
    expect(Gestion::puede($this->trabajador, $this->negocio, 'caja.vender'))->toBeFalse();
    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['personal.llegadas']);
    Gestion::definirModulos($this->negocio, ['personal', 'caja']);
    expect(Gestion::permisosDe($this->trabajador, $this->negocio))->toEqualCanonicalizing(['caja.vender', 'personal.llegadas']);
});

test('el catálogo muestra los productos en tarjetas con su imagen', function () {
    Gestion::activar($this->negocio);
    $con = $this->negocio->productos()->create(['nombre' => 'Bomper delantero', 'descripcion' => 'Para camioneta', 'precio' => 350000, 'atributos' => ['Acero', 'Negro']]);
    $con->forceFill(['imagen' => 'productos/bomper.jpg'])->save();
    $this->negocio->productos()->create(['nombre' => 'Espejo lateral', 'precio' => 80000, 'disponible' => false]);
    entrarAlPanel($this, $this->dueno);

    $this->get('/negocio/catalogo')->assertOk()
        ->assertSee('class="producto"', false)
        ->assertSee('src="'.asset('storage/productos/bomper.jpg').'"', false)
        ->assertSee('Bomper delantero')->assertSee('Para camioneta')->assertSee('Acero')->assertSee('$ 350.000')
        ->assertSee('Sin imagen de Espejo lateral')->assertSee('Agotado');
});

test('el dueño crea, edita, agota y elimina productos desde el catálogo web', function () {
    Storage::fake('public');
    Gestion::activar($this->negocio);
    $comida = TipoProducto::where('slug', 'comida')->firstOrFail();
    $global = CategoriaCatalogo::firstOrFail();
    $seccion = $this->negocio->categorias()->create(['nombre' => 'Repuestos']);
    entrarAlPanel($this, $this->dueno);
    $this->get('/negocio/catalogo')->assertOk()->assertSee('+ Añadir producto');

    $this->from('/negocio/catalogo')->post('/negocio/catalogo/productos', [
        '_producto' => 'nuevo', 'nombre' => 'Arepa rellena', 'descripcion' => 'Con queso', 'precio' => '3.500',
        'venta' => 'kilos', 'tipo_producto_id' => $comida->id, 'categoria_id' => $seccion->id,
        'atributos_lista' => ['Queso', ' Maíz ', 'Mantequilla', 'Queso', ''], 'fijos_lista' => ['Maíz', 'Pollo'],
        'extras_lista' => [['nombre' => 'Huevo', 'precio' => '1.000'], ['nombre' => '', 'precio' => '']],
        'otros_nombres_lista' => ['arepita'], 'categorias_marcadas' => [$global->id], 'disponible' => '1',
        'imagen' => UploadedFile::fake()->image('arepa.png', 800, 600),
    ])->assertRedirect('/negocio/catalogo')->assertSessionHas('ok');

    $p = $this->negocio->productos()->where('nombre', 'Arepa rellena')->firstOrFail();
    expect((int) $p->precio)->toBe(3500)
        ->and($p->unidad_medida)->toBe('kg')->and($p->tipo_venta)->toBe('peso')
        ->and($p->atributos)->toBe(['Queso', 'Maíz', 'Mantequilla'])
        ->and($p->ingredientes_fijos)->toBe(['Maíz'])
        ->and($p->extras)->toBe([['nombre' => 'Huevo', 'precio' => 1000]])
        ->and($p->nombres_alternos)->toBe(['arepita'])
        ->and($p->categoriasCatalogo->pluck('id')->all())->toBe([$global->id])
        ->and($p->imagen)->not->toBeNull();
    Storage::disk('public')->assertExists($p->imagen);

    // El detalle del modal muestra toda la información.
    $this->get('/negocio/catalogo')->assertSee('id="producto-'.$p->id.'"', false)
        ->assertSee('Con queso')->assertSee('Ingredientes opcionales')->assertSee('Ingredientes obligatorios')
        ->assertSeeInOrder(['Extras', 'Huevo', '+ $ 1.000'])->assertSee('arepita')->assertSee($global->nombre)
        ->assertSee('name="atributos_lista[]" value="Mantequilla"', false)->assertSee('name="fijos_lista[]" value="Maíz" checked', false);

    // Editar: sin categorías de Vitrina y por cantidad.
    $this->from('/negocio/catalogo')->put('/negocio/catalogo/productos/'.$p->id, [
        '_producto' => (string) $p->id, 'nombre' => 'Arepa de queso', 'precio' => '4000', 'venta' => 'cantidad',
        'tipo_producto_id' => $comida->id, 'atributos_lista' => ['Queso'], 'disponible' => '1',
    ])->assertRedirect('/negocio/catalogo');
    $p->refresh();
    expect($p->nombre)->toBe('Arepa de queso')->and((int) $p->precio)->toBe(4000)
        ->and($p->unidad_medida)->toBe('unidad')->and($p->categoriasCatalogo()->count())->toBe(0);

    // Con errores vuelve con el formulario de ese producto.
    $this->from('/negocio/catalogo')->put('/negocio/catalogo/productos/'.$p->id, ['_producto' => (string) $p->id, 'nombre' => '', 'precio' => '', 'tipo_producto_id' => $comida->id])
        ->assertRedirect('/negocio/catalogo')->assertSessionHasErrors(['nombre', 'precio'])->assertSessionHasInput('_producto', (string) $p->id);

    $this->patch('/negocio/catalogo/productos/'.$p->id.'/disponible')->assertSessionHas('ok');
    expect($p->fresh()->disponible)->toBeFalse();

    $this->delete('/negocio/catalogo/productos/'.$p->id)->assertSessionHas('ok');
    expect($this->negocio->productos()->find($p->id))->toBeNull()
        ->and(Producto::withTrashed()->find($p->id))->not->toBeNull();
});

test('sin permiso de catálogo solo se ven los productos, sin editarlos', function () {
    Gestion::activar($this->negocio);
    $p = $this->negocio->productos()->create(['nombre' => 'Bomper', 'precio' => 1000]);
    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Otro']);
    $ajeno = $otro->productos()->create(['nombre' => 'Ajeno', 'precio' => 1000]);
    entrarAlPanel($this, $this->trabajador);

    $this->get('/negocio/catalogo')->assertOk()->assertSee('Bomper')->assertDontSee('Añadir producto')->assertDontSee('Añadir servicio')->assertDontSee('data-editar', false);
    $this->put('/negocio/catalogo/productos/'.$p->id, ['nombre' => 'X'])->assertForbidden();
    $this->patch('/negocio/catalogo/productos/'.$p->id.'/disponible')->assertForbidden();
    $this->delete('/negocio/catalogo/productos/'.$p->id)->assertForbidden();
    expect($p->fresh()->nombre)->toBe('Bomper');

    // El dueño tampoco toca productos de otro negocio.
    auth()->logout();
    entrarAlPanel($this, $this->dueno);
    $this->delete('/negocio/catalogo/productos/'.$ajeno->id)->assertNotFound();
});

test('el catálogo web busca y filtra por disponibilidad', function () {
    Gestion::activar($this->negocio);
    $this->negocio->productos()->create(['nombre' => 'Bomper delantero', 'precio' => 1000]);
    $this->negocio->productos()->create(['nombre' => 'Espejo lateral', 'precio' => 1000, 'disponible' => false]);
    entrarAlPanel($this, $this->dueno);

    $this->get('/negocio/catalogo?buscar=bomper')->assertSee('Bomper delantero')->assertDontSee('Espejo lateral');
    $this->get('/negocio/catalogo?estado=agotados')->assertSee('Espejo lateral')->assertDontSee('Bomper delantero');
});

test('las sedes: una sola sin el módulo, varias con él y siempre una principal', function () {
    Gestion::activar($this->negocio);
    entrarAlPanel($this, $this->dueno);
    $principal = $this->negocio->sedes()->first();

    $this->post('/negocio/sedes', ['nombre' => 'Fábrica', 'tipo' => 'fabrica'])->assertSessionHas('error');
    expect($this->negocio->sedes()->count())->toBe(1);

    Gestion::definirModulos($this->negocio, ['sedes']);
    $this->post('/negocio/sedes', ['nombre' => 'Fábrica', 'tipo' => 'fabrica', 'factura' => 1])->assertRedirect('/negocio/sedes');
    $this->post('/negocio/sedes', ['nombre' => 'Fábrica', 'tipo' => 'bodega'])->assertSessionHasErrors('nombre');
    $fabrica = $this->negocio->sedes()->where('nombre', 'Fábrica')->first();

    $this->put('/negocio/sedes/'.$principal->id, ['nombre' => 'Principal', 'tipo' => 'punto_venta', 'activa' => 0])->assertSessionHas('error');
    $this->put('/negocio/sedes/'.$fabrica->id, ['nombre' => 'Fábrica', 'tipo' => 'fabrica', 'principal' => 1, 'activa' => 1]);
    expect($fabrica->fresh()->principal)->toBeTrue()->and($principal->fresh()->principal)->toBeFalse();

    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Ajeno']);
    $ajena = $otro->sedes()->create(['nombre' => 'Ajena']);
    $this->put('/negocio/sedes/'.$ajena->id, ['nombre' => 'Mía', 'tipo' => 'bodega'])->assertNotFound();
});

test('quien es de dos negocios con panel elige con cuál trabajar', function () {
    Gestion::activar($this->negocio);
    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Segundo']);
    $otro->miembros()->attach($this->dueno->id, ['rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false)]);
    Gestion::activar($otro);
    entrarAlPanel($this, $this->dueno);

    $this->get('/negocio')->assertRedirect('/negocio/elegir');
    $this->get('/negocio/elegir')->assertOk()->assertSee('Segundo');
    $this->post('/negocio/elegir', ['negocio_id' => 999999])->assertForbidden();
    $this->post('/negocio/elegir', ['negocio_id' => $otro->id])->assertRedirect('/negocio');
    $this->get('/negocio')->assertOk()->assertSee('Segundo');
});

// ------------------------------------------------ Login web con 3 opciones

/** El dueño con celular verificado y clave 2468. */
function duenoConCelular(User $dueno, string $telefono = '3005550101'): User
{
    $dueno->forceFill(['telefono' => $telefono, 'telefono_verificado_at' => now(), 'pin' => '2468', 'pin_fallidos' => 0, 'pin_bloqueado_at' => null])->save();

    return $dueno;
}

test('el login web tiene QR, WhatsApp, Google y el acceso del administrador', function () {
    $this->get('/login')->assertOk()
        ->assertSee('Código QR')->assertSee('WhatsApp')->assertSee('Google')
        ->assertSee('Administrador de Vitrina con usuario y contraseña');
    $this->get('/negocio/entrar')->assertRedirect('/login');
});

test('se entra con celular, clave y código de WhatsApp', function () {
    app()->instance(EnviadorCodigos::class, new EnviadorLog);
    Gestion::activar($this->negocio);
    duenoConCelular($this->dueno);

    $this->post('/login/celular', ['telefono' => '300 555 0101', 'pin' => '1111'])->assertRedirect('/login')->assertSessionHasErrors('pin');
    $this->post('/login/celular', ['telefono' => '3005550101', 'pin' => '2468'])->assertRedirect('/login')->assertSessionHas('ok');
    $paso = session('login_celular');
    expect($paso['codigo_prueba'])->toMatch('/^\d{6}$/');
    $this->get('/login')->assertSee('Modo de pruebas')->assertSee($paso['codigo_prueba']);

    $this->post('/login/celular/codigo', ['codigo' => $paso['codigo_prueba'] === '000000' ? '111111' : '000000'])->assertSessionHasErrors();
    $this->post('/login/celular/codigo', ['codigo' => $paso['codigo_prueba']])->assertRedirect('/negocio');
    $this->assertAuthenticatedAs($this->dueno);
    expect(AccesoWeb::where('user_id', $this->dueno->id)->where('estado', 'usado')->value('metodo'))->toBe('whatsapp');
    $this->get('/negocio')->assertOk();
});

test('sin panel web no se envía el código por WhatsApp', function () {
    duenoConCelular($this->dueno);
    $this->post('/login/celular', ['telefono' => '3005550101', 'pin' => '2468'])
        ->assertSessionHasErrors(['telefono' => 'Tu cuenta no tiene panel web: ninguno de tus negocios lo tiene activo. Pídeselo a Vitrina.']);
    expect(session('login_celular'))->toBeNull();
});

test('se entra con Google y la clave', function () {
    Gestion::activar($this->negocio);
    duenoConCelular($this->dueno)->forceFill(['google_id' => 'g-123'])->save();
    $this->mock(GoogleIdToken::class, fn ($m) => $m->shouldReceive('verificar')->andReturn(['sub' => 'g-123', 'email' => 'ismael@gmail.com']));

    $this->post('/login/google', ['credential' => 'token-de-google'])->assertRedirect('/login');
    $this->get('/login')->assertSee('Hola, <strong>Ismael</strong>', false);
    $this->post('/login/google/clave', ['pin' => '9999'])->assertSessionHasErrors('pin');
    $this->post('/login/google/clave', ['pin' => '2468'])->assertRedirect('/negocio');
    $this->assertAuthenticatedAs($this->dueno);
    expect(AccesoWeb::where('user_id', $this->dueno->id)->where('estado', 'usado')->value('metodo'))->toBe('google');
});

test('una cuenta de Google sin conectar no entra', function () {
    $this->mock(GoogleIdToken::class, fn ($m) => $m->shouldReceive('verificar')->andReturn(['sub' => 'otro', 'email' => 'x@gmail.com']));
    $this->post('/login/google', ['credential' => 'token'])->assertSessionHasErrors('google');
    $this->post('/login/google/clave', ['pin' => '2468'])->assertSessionHasErrors('google');
    $this->assertGuest();
});

test('el administrador de Vitrina entra con el QR a su panel', function () {
    $this->get('/login');
    $acceso = AccesoWeb::latest('id')->first();
    $this->actingAs($this->super)->getJson('/api/acceso-web')->assertJsonPath('disponible', true)->assertJsonPath('negocios.0.nombre', 'Administración de Vitrina');
    AccesosWeb::aprobar($acceso->codigo, $this->super);
    comoNavegador($this);
    auth()->guard('web')->logout();
    $this->getJson('/login/estado')->assertJsonPath('estado', 'listo')->assertJsonPath('url', route('admin.panel'));
    $this->get('/admin')->assertOk();
    $this->get('/negocio')->assertRedirect(route('admin.panel'));
    $this->assertAuthenticatedAs($this->super);
    $this->post('/logout');
    expect($acceso->fresh()->cerrado_at)->not->toBeNull();
});

test('la clave bloqueada en la web vuelve al login con el aviso', function () {
    Gestion::activar($this->negocio);
    duenoConCelular($this->dueno)->forceFill(['pin_bloqueado_at' => now()])->save();
    $this->post('/login/celular', ['telefono' => '3005550101', 'pin' => '2468'])
        ->assertRedirect('/login')->assertSessionHasErrors('pin');
});

test('el comando de pruebas enciende el panel y todos los módulos a todos los negocios', function () {
    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Otro']);
    $archivado = User::factory()->create()->negocio()->create(['nombre' => 'Archivado']);
    $archivado->forceFill(['archivado_at' => now()])->save();
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['personal']);

    $this->artisan('vitrina:gestion-para-todos', ['--force' => true])->assertSuccessful();

    foreach ([$this->negocio, $otro] as $n) {
        expect($n->fresh()->gestion_activa)->toBeTrue()
            ->and(Gestion::opcionalesEncendidos($n))->toEqualCanonicalizing(Modulos::opcionales())
            ->and($n->sedes()->count())->toBe(1);
    }
    expect($archivado->fresh()->gestion_activa)->toBeFalse();
});

test('el QR pide un código nuevo sin recargar y el anterior deja de servir', function () {
    Gestion::activar($this->negocio);
    $this->get('/login');
    $viejo = AccesoWeb::latest('id')->first();
    $r = $this->getJson('/login/codigo')->assertOk()->assertJsonStructure(['codigo', 'visible', 'segundos']);
    expect($r->json('codigo'))->not->toBe($viejo->codigo)
        ->and($viejo->fresh()->estado)->toBe('vencido');
    $this->actingAs($this->dueno)->postJson('/api/acceso-web/aprobar', ['codigo' => $viejo->codigo])->assertUnprocessable();
    $this->postJson('/api/acceso-web/aprobar', ['codigo' => $r->json('codigo')])->assertOk();
    comoNavegador($this);
    $this->getJson('/login/estado')->assertJsonPath('estado', 'listo');
});

test('Mi tienda muestra la portada con el nombre y el dueño edita la información', function () {
    Storage::fake('public');
    Gestion::activar($this->negocio);
    $this->negocio->forceFill(['imagen' => 'negocios/vieja.jpg'])->save();
    Storage::disk('public')->put('negocios/vieja.jpg', 'x');
    entrarAlPanel($this, $this->dueno);

    $this->get('/negocio/tienda')->assertOk()
        ->assertSee('class="tienda-portada"', false)
        ->assertSee('src="'.asset('storage/negocios/vieja.jpg').'"', false)
        ->assertSee('Editar información')->assertSee('Cuentas para transferencias');

    $this->from('/negocio/tienda')->put('/negocio/tienda', [
        '_formulario' => 'tienda', 'nombre' => 'Latonería Grumar', 'descripcion' => 'Bompers y rejas',
        'direccion' => 'Calle 12 # 5-20', 'barrio' => 'San José', 'telefono' => '3001234567', 'tiempo_preparacion' => 45,
        'imagen' => UploadedFile::fake()->image('portada.jpg', 1600, 600),
    ])->assertRedirect('/negocio/tienda')->assertSessionHas('ok');

    $n = $this->negocio->fresh();
    expect($n->nombre)->toBe('Latonería Grumar')->and($n->barrio)->toBe('San José')
        ->and($n->tiempo_preparacion)->toBe(45)->and($n->imagen)->not->toBe('negocios/vieja.jpg');
    Storage::disk('public')->assertMissing('negocios/vieja.jpg');
    Storage::disk('public')->assertExists($n->imagen);

    $this->from('/negocio/tienda')->put('/negocio/tienda', ['nombre' => '', 'direccion' => 'Calle 12', 'barrio' => 'Centro', 'tiempo_preparacion' => 2])
        ->assertRedirect('/negocio/tienda')->assertSessionHasErrors(['nombre', 'tiempo_preparacion']);
});

test('quien no administra ve Mi tienda sin editar ni ver las cuentas', function () {
    Gestion::activar($this->negocio);
    $this->negocio->cuentasPago()->create(['tipo' => 'nequi', 'numero' => '3001112233', 'titular' => 'Ismael', 'orden' => 1]);
    entrarAlPanel($this, $this->trabajador);

    $this->get('/negocio/tienda')->assertOk()->assertSee('Latonería')
        ->assertDontSee('Editar información')->assertDontSee('3001112233');
    $this->put('/negocio/tienda', ['nombre' => 'Otro', 'direccion' => 'Calle 1', 'barrio' => 'Centro', 'tiempo_preparacion' => 20])->assertForbidden();
    $this->post('/negocio/tienda/cuentas', ['tipo' => 'nequi', 'numero' => '3009998877', 'titular' => 'Ayudante', 'pin' => '2468'])->assertForbidden();
});

test('el dueño agrega, edita y elimina cuentas para transferencias con su clave', function () {
    Gestion::activar($this->negocio);
    $this->dueno->forceFill(['pin' => '2468'])->save();
    entrarAlPanel($this, $this->dueno);

    // Sin clave o con la equivocada no guarda, y la clave no queda en la sesión.
    $this->from('/negocio/tienda')->post('/negocio/tienda/cuentas', ['_formulario' => 'cuenta-nueva', 'tipo' => 'nequi', 'numero' => '3001112233', 'titular' => 'Ismael Pérez', 'pin' => '1111'])
        ->assertRedirect('/negocio/tienda')->assertSessionHasErrors('pin')->assertSessionHasInput('numero', '3001112233')->assertSessionMissing('_old_input.pin');
    expect($this->negocio->cuentasPago()->count())->toBe(0);

    $this->from('/negocio/tienda')->post('/negocio/tienda/cuentas', ['tipo' => 'banco', 'numero' => '123-456', 'titular' => 'Ismael Pérez', 'pin' => '2468'])
        ->assertSessionHasErrors(['banco', 'tipo_cuenta']);

    $this->from('/negocio/tienda')->post('/negocio/tienda/cuentas', ['tipo' => 'nequi', 'numero' => '300 111  2233', 'titular' => 'Ismael Pérez', 'pin' => '2468'])
        ->assertRedirect('/negocio/tienda')->assertSessionHas('ok');
    $cuenta = $this->negocio->cuentasPago()->firstOrFail();
    expect($cuenta->numero)->toBe('300 111 2233');

    $this->get('/negocio/tienda')->assertOk()->assertSee('class="cuenta"', false)->assertSee('300 111 2233')->assertSee('Ismael Pérez')
        ->assertSee('data-abrir="cuenta-'.$cuenta->id.'"', false)->assertSee('data-abrir="eliminar-'.$cuenta->id.'"', false);

    $this->from('/negocio/tienda')->put('/negocio/tienda/cuentas/'.$cuenta->id, ['tipo' => 'bancolombia', 'numero' => '12345678901', 'tipo_cuenta' => 'ahorros', 'titular' => 'Ismael Pérez', 'pin' => '2468'])
        ->assertRedirect('/negocio/tienda')->assertSessionHas('ok');
    expect($cuenta->fresh()->only(['tipo', 'numero', 'tipo_cuenta']))->toBe(['tipo' => 'bancolombia', 'numero' => '12345678901', 'tipo_cuenta' => 'ahorros']);

    $this->from('/negocio/tienda')->delete('/negocio/tienda/cuentas/'.$cuenta->id, [])->assertSessionHasErrors('pin');
    $this->from('/negocio/tienda')->delete('/negocio/tienda/cuentas/'.$cuenta->id, ['pin' => '2468'])->assertRedirect('/negocio/tienda')->assertSessionHas('ok');
    expect($this->negocio->cuentasPago()->count())->toBe(0);

    // La cuenta de otro negocio no se toca desde este panel.
    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Otro', 'direccion' => 'Calle 1', 'barrio' => 'Centro']);
    $ajena = $otro->cuentasPago()->create(['tipo' => 'nequi', 'numero' => '3005556677', 'titular' => 'Otra persona', 'orden' => 1]);
    $this->delete('/negocio/tienda/cuentas/'.$ajena->id, ['pin' => '2468'])->assertNotFound();
});

test('el switch de cada tarjeta marca disponible o agotado y avisa a la app', function () {
    Event::fake([CambioEnVivo::class]);
    Gestion::activar($this->negocio);
    $p = $this->negocio->productos()->create(['nombre' => 'Rejilla', 'precio' => 50000]);
    entrarAlPanel($this, $this->dueno);

    $this->get('/negocio/catalogo')->assertOk()->assertSee('role="switch"', false)
        ->assertSee('data-disponible="'.route('negocio.productos.disponible', $p->id).'"', false);

    // Con el valor es idempotente: dos veces «agotado» sigue agotado.
    foreach ([1, 2] as $_) {
        $this->patchJson('/negocio/catalogo/productos/'.$p->id.'/disponible', ['disponible' => false])
            ->assertOk()->assertJson(['disponible' => false]);
    }
    expect($p->fresh()->disponible)->toBeFalse();
    EnVivo::enviar();
    Event::assertDispatched(CambioEnVivo::class, fn ($e) => $e->tema === 'catalogo'
        && in_array('catalogo', $e->canales, true) && in_array('negocio.'.$this->negocio->id, $e->canales, true));

    $this->patchJson('/negocio/catalogo/productos/'.$p->id.'/disponible', ['disponible' => true])->assertJson(['disponible' => true]);
    expect($p->fresh()->disponible)->toBeTrue();
});

test('quien no puede cambiar el catálogo no ve el switch ni lo usa', function () {
    Gestion::activar($this->negocio);
    $p = $this->negocio->productos()->create(['nombre' => 'Rejilla', 'precio' => 50000]);
    entrarAlPanel($this, $this->trabajador);

    $this->get('/negocio/catalogo')->assertOk()->assertSee('Rejilla')->assertDontSee('role="switch"', false);
    $this->patchJson('/negocio/catalogo/productos/'.$p->id.'/disponible', ['disponible' => false])->assertForbidden();
    expect($p->fresh()->disponible)->toBeTrue();
});

test('las pestañas muestran primero los productos y, si no hay, los servicios', function () {
    Gestion::activar($this->negocio);
    entrarAlPanel($this, $this->dueno);
    $this->negocio->servicios()->create(['nombre' => 'Pintura de puerta', 'descripcion' => 'Con pintura electrostática', 'duracion_minutos' => 120, 'precio' => 90000]);

    // Solo servicios: abre en Servicios.
    $this->get('/negocio/catalogo')->assertOk()
        ->assertSee('data-pestana="servicios" aria-selected="true"', false)
        ->assertSee('Pintura de puerta')->assertSee('$ 90.000');

    // Con productos y servicios: primero los productos.
    $this->negocio->productos()->create(['nombre' => 'Bomper', 'precio' => 350000]);
    $this->get('/negocio/catalogo')->assertSee('data-pestana="productos" aria-selected="true"', false)
        ->assertSee('data-pestana="servicios" aria-selected="false"', false);
    $this->get('/negocio/catalogo?pestana=servicios')->assertSee('data-pestana="servicios" aria-selected="true"', false);

    // Sin servicios: productos.
    $this->negocio->servicios()->delete();
    $this->get('/negocio/catalogo')->assertSee('data-pestana="productos" aria-selected="true"', false)
        ->assertSee('Este negocio no ofrece servicios');
});

test('editar desde la web avisa en vivo a la app y a las demás pestañas', function () {
    Event::fake([CambioEnVivo::class]);
    Gestion::activar($this->negocio);
    $this->dueno->forceFill(['pin' => '2468'])->save();
    entrarAlPanel($this, $this->dueno);

    $this->put('/negocio/tienda', ['nombre' => 'Latonería Grumar', 'direccion' => 'Calle 12 # 5-20', 'barrio' => 'Centro', 'tiempo_preparacion' => 30])
        ->assertSessionHas('ok');
    EnVivo::enviar();
    Event::assertDispatched(CambioEnVivo::class, fn ($e) => $e->tema === 'negocio' && in_array('catalogo', $e->canales, true));
});

test('en la pestaña Servicios el botón añade un servicio, con las mismas reglas que la app', function () {
    Storage::fake('public');
    Event::fake([CambioEnVivo::class]);
    Gestion::activar($this->negocio);
    $this->negocio->productos()->create(['nombre' => 'Bomper', 'precio' => 350000]);
    entrarAlPanel($this, $this->dueno);

    // En Productos se ve «Añadir producto»; en Servicios, «Añadir servicio».
    $this->get('/negocio/catalogo')->assertSee('data-abrir="producto-nuevo" data-solo-pestana="productos" >', false)
        ->assertSee('data-abrir="servicio-nuevo" data-solo-pestana="servicios"  hidden', false);
    $this->get('/negocio/catalogo?pestana=servicios')->assertSee('data-abrir="producto-nuevo" data-solo-pestana="productos"  hidden', false)
        ->assertSee('data-abrir="servicio-nuevo" data-solo-pestana="servicios" >', false);

    $this->from('/negocio/catalogo?pestana=servicios')->post('/negocio/catalogo/servicios', ['_servicio' => 'nuevo', 'nombre' => 'Pintura', 'descripcion' => ''])
        ->assertRedirect('/negocio/catalogo?pestana=servicios')->assertSessionHasErrors('descripcion')->assertSessionHasInput('_servicio', 'nuevo');

    $this->post('/negocio/catalogo/servicios', [
        '_servicio' => 'nuevo', 'nombre' => 'Pintura de puerta', 'descripcion' => 'Con pintura electrostática',
        'precio' => '90.000', 'duracion_minutos' => 120, 'permite_citas' => '1',
        'imagenes' => [UploadedFile::fake()->image('puerta.jpg', 800, 600)],
    ])->assertRedirect('/negocio/catalogo?pestana=servicios')->assertSessionHas('ok');

    $s = $this->negocio->servicios()->firstOrFail();
    expect($s->only(['nombre', 'precio', 'duracion_minutos', 'permite_citas', 'disponible']))
        ->toBe(['nombre' => 'Pintura de puerta', 'precio' => 90000, 'duracion_minutos' => 120, 'permite_citas' => true, 'disponible' => false])
        ->and($s->galeria)->toHaveCount(1);
    EnVivo::enviar();
    Event::assertDispatched(CambioEnVivo::class, fn ($e) => $e->tema === 'catalogo' && in_array('negocio.'.$this->negocio->id, $e->canales, true));
});

/** Un pedido del negocio en el estado y el momento dados (para el panel web). */
function panelPedido(Negocio $negocio, User $cliente, string $estado, CarbonInterface $creado, array $extra = []): Pedido
{
    $p = Pedido::create([
        'negocio_id' => $negocio->id, 'user_id' => $cliente->id, 'estado' => $estado, 'metodo_pago' => 'efectivo',
        'subtotal' => 32000, 'costo_domicilio' => 4000, 'total' => 36000, 'paga_con' => 50000,
        'direccion_entrega' => 'Calle 20 #19-41', 'telefono_contacto' => '3007654321',
    ] + $extra);
    $p->forceFill(['created_at' => $creado])->save();
    $p->items()->create(['nombre' => 'Almuerzo ejecutivo', 'precio' => 16000, 'cantidad' => 2, 'opciones' => ['sin' => ['Fríjoles']]]);

    return $p;
}

test('los pedidos salen en tarjetas por día, con filtro, calendario y el detalle completo en el modal', function () {
    Gestion::activar($this->negocio);
    $cliente = User::factory()->create(['name' => 'Ana Cliente']);
    $domi = User::factory()->create(['name' => 'Pedro', 'apellidos' => 'Moto', 'telefono' => '3111111111']);
    $hoy = now()->setTime(12, 0);
    $entregado = panelPedido($this->negocio, $cliente, 'entregado', $hoy, [
        'domiciliario_id' => $domi->id, 'minutos_preparacion' => 25,
        'aceptado_at' => $hoy->copy()->addMinutes(2), 'listo_at' => $hoy->copy()->addMinutes(22),
        'tomado_at' => $hoy->copy()->addMinutes(5), 'recogido_at' => $hoy->copy()->addMinutes(30),
        'en_camino_at' => $hoy->copy()->addMinutes(31), 'entregado_at' => $hoy->copy()->addMinutes(45),
    ]);
    $cancelado = panelPedido($this->negocio, $cliente, 'cancelado', $hoy->copy()->subDays(3), [
        'cancelado_por' => 'cliente', 'motivo_cancelacion' => 'Me equivoqué de dirección', 'cancelado_at' => $hoy->copy()->subDays(3)->addMinutes(3),
    ]);
    entrarAlPanel($this, $this->dueno);

    $pagina = $this->get('/negocio/pedidos')->assertOk();
    // El calendario marca los días con pedidos.
    preg_match("/data-dias='([^']*)'/", $pagina->getContent(), $m);
    expect(json_decode(html_entity_decode($m[1] ?? ''), true))
        ->toBe([$cancelado->created_at->format('Y-m-d') => 1, $hoy->format('Y-m-d') => 1]);
    $pagina->assertSee('class="pedido"', false)->assertSeeInOrder(['Hoy', $entregado->codigo, $cancelado->codigo])
        ->assertSee('data-calendario-boton', false)->assertSee('2× Almuerzo ejecutivo')
        // Modal: cliente, domiciliario, tiempos.
        ->assertSee('id="pedido-'.$entregado->id.'"', false)->assertSee('Ana Cliente')->assertSee('3007654321')
        ->assertSee('Pedro Moto')->assertSee('3111111111')->assertSee('Sin fríjoles')
        ->assertSee('20 min (prometido: 25 min)')->assertSee('Tiempo total')->assertSee('45 min')
        ->assertSee('cambio $ 14.000', false)->assertSee('Me equivoqué de dirección');

    $this->get('/negocio/pedidos?dia='.$hoy->format('Y-m-d'))->assertSee($entregado->codigo)->assertDontSee($cancelado->codigo);
    $this->get('/negocio/pedidos?estado=cancelados')->assertSee($cancelado->codigo)->assertDontSee($entregado->codigo);
    $this->get('/negocio/pedidos?buscar='.$entregado->codigo)->assertSee($entregado->codigo)->assertDontSee($cancelado->codigo);
    $this->get('/negocio/pedidos?dia=no-es-fecha')->assertOk()->assertSee($cancelado->codigo);
});

// ------------------------------------------------------------ Trabajadores

test('Trabajadores reemplaza a Equipo en el menú y /negocio/equipo lleva allá', function () {
    Gestion::activar($this->negocio);
    entrarAlPanel($this, $this->dueno);
    $this->get('/negocio/equipo')->assertRedirect('/negocio/trabajadores');
    $this->get('/negocio')->assertSee('Trabajadores')->assertSee('/negocio/trabajadores');
    $this->get('/negocio/trabajadores')->assertOk()->assertSee('Ayudante')->assertSee('+ Asociar trabajador')->assertSee('+ Asignar tarea');
});

test('el horario se lee, se resume y valida las horas', function () {
    $h = Horario::desdeFormulario(['dias' => ['1', '2', '3', '4', '5'], 'entrada' => [1 => '08:00'], 'salida' => [1 => '17:00']]);
    expect($h['1'])->toBe(['entrada' => '08:00', 'salida' => '17:00'])
        ->and($h['2'])->toBe(['entrada' => null, 'salida' => null])
        ->and(Horario::resumen(Horario::leer(json_encode($h))))->toBe('Lunes a viernes')
        ->and(Horario::resumen(Horario::leer(['6' => [], '7' => []])))->toBe('Fines de semana')
        ->and(Horario::resumen(Horario::leer(['1' => [], '3' => [], '5' => []])))->toBe('Lunes, miércoles y viernes')
        ->and(Horario::resumen(Horario::leer(['2' => [], '3' => [], '4' => [], '5' => [], '6' => []])))->toBe('Martes a sábado')
        ->and(Horario::resumen(null))->toBe('Días sin definir')
        ->and(Horario::desdeFormulario(['dias' => []]))->toBeNull()
        ->and(Horario::horasDelDia(Horario::leer($h), 1))->toBe('8:00 a. m. – 5:00 p. m.');
    expect(fn () => Horario::desdeFormulario(['dias' => [6], 'entrada' => [6 => '08:00']]))->toThrow(ValidationException::class);
});

test('el dueño asocia con el código: la invitación lleva sede, cargo, días y permisos y la membresía nace así', function () {
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['sedes', 'personal']);
    $norte = $this->negocio->sedes()->create(['nombre' => 'Norte']);
    $nuevo = User::factory()->create(['name' => 'Soldador', 'codigo_publico' => 'UABC23']);
    entrarAlPanel($this, $this->dueno);

    $this->postJson('/negocio/trabajadores/codigo', ['codigo' => '#uabc23'])->assertOk()->assertJsonPath('nombre', $nuevo->nombre_completo)->assertJsonPath('aviso', null);
    $this->postJson('/negocio/trabajadores/codigo', ['codigo' => 'UNOEXI'])->assertNotFound();
    $this->postJson('/negocio/trabajadores/codigo', ['codigo' => $this->trabajador->codigo_publico])->assertJsonPath('aviso', 'Ya hace parte del negocio.');

    $this->post('/negocio/trabajadores/invitar', [
        'codigo' => 'uabc23', 'cargo' => 'Soldador', 'sede_id' => $norte->id,
        'dias' => [6, 7], 'entrada' => [6 => '07:00', 7 => '07:00'], 'salida' => [6 => '13:00', 7 => '12:00'],
        'vitrina' => ['gestionar_pedidos'], 'modulos' => ['personal.llegadas', 'equipo.tareas'],
    ])->assertRedirect('/negocio/trabajadores')->assertSessionHas('ok');
    Notification::assertSentTo($nuevo, InvitacionTrabajoRecibida::class);
    $this->get('/negocio/trabajadores')->assertSee('Invitaciones sin aceptar')->assertSee('Fines de semana');

    // Repetir la invitación no se puede.
    $this->post('/negocio/trabajadores/invitar', ['codigo' => 'UABC23'])->assertSessionHas('error');

    $invitacion = InvitacionTrabajo::where('user_id', $nuevo->id)->firstOrFail();
    $this->actingAs($nuevo)->putJson('/api/invitaciones/'.$invitacion->id.'/aceptar')->assertOk();
    $fila = $this->negocio->miembros()->whereKey($nuevo->id)->first()->pivot;
    expect($fila->cargo)->toBe('Soldador')
        ->and((int) $fila->sede_id)->toBe($norte->id)
        ->and(Horario::leer($fila->horario))->toBe([6 => ['entrada' => '07:00', 'salida' => '13:00'], 7 => ['entrada' => '07:00', 'salida' => '12:00']])
        ->and((bool) $fila->gestionar_pedidos)->toBeTrue()
        ->and((bool) $fila->modificar_inventario)->toBeFalse()
        ->and(Gestion::permisosDe($nuevo, $this->negocio))->toEqualCanonicalizing(['personal.llegadas', 'equipo.tareas']);
});

test('el dueño cambia sede, días y permisos de un trabajador y lo quita del negocio', function () {
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['sedes', 'caja']);
    $norte = $this->negocio->sedes()->create(['nombre' => 'Norte']);
    entrarAlPanel($this, $this->dueno);

    $this->put('/negocio/trabajadores/'.$this->trabajador->id, [
        'cargo' => 'Cajero', 'sede_id' => $norte->id, 'dias' => [1, 3, 5],
        'vitrina' => ['modificar_inventario', 'cambiar_estado'], 'modulos' => ['caja.vender'],
    ])->assertRedirect('/negocio/trabajadores')->assertSessionHas('ok');
    $permisos = $this->negocio->permisosPara($this->trabajador);
    expect($permisos['modificar_inventario'])->toBeTrue()->and($permisos['gestionar_pedidos'])->toBeFalse()->and($permisos['cambiar_estado'])->toBeTrue()
        ->and(Gestion::permisosDe($this->trabajador, $this->negocio))->toBe(['caja.vender']);
    $this->get('/negocio/trabajadores')->assertSee('Cajero')->assertSee('Lunes, miércoles y viernes')->assertSee('Norte');
    $this->get('/negocio/trabajadores?sede='.$this->negocio->sedes()->where('principal', true)->value('id'))->assertDontSee('Lunes, miércoles y viernes');

    // Una sede de otro negocio o un permiso apagado no se aceptan.
    $otro = User::factory()->create()->negocio()->create(['nombre' => 'Otro', 'direccion' => 'Calle 1', 'barrio' => 'Centro']);
    $ajena = $otro->sedes()->create(['nombre' => 'Ajena']);
    $this->put('/negocio/trabajadores/'.$this->trabajador->id, ['sede_id' => $ajena->id])->assertSessionHasErrors('sede_id');
    $this->put('/negocio/trabajadores/'.$this->trabajador->id, ['modulos' => ['facturacion.emitir']])->assertSessionHasErrors('modulos.0');
    $this->put('/negocio/trabajadores/'.$this->trabajador->id, ['dias' => [2], 'entrada' => [2 => '08:00']])->assertSessionHasErrors('horario');

    // Al dueño no se le tocan los permisos.
    $this->put('/negocio/trabajadores/'.$this->dueno->id, ['cargo' => 'Gerente', 'vitrina' => []])->assertSessionHas('ok');
    expect($this->negocio->administra($this->dueno))->toBeTrue();

    $tarea = $this->negocio->tareas()->create(['user_id' => $this->trabajador->id, 'titulo' => 'Barrer']);
    $this->delete('/negocio/trabajadores/'.$this->dueno->id)->assertSessionHas('error');
    $this->delete('/negocio/trabajadores/'.$this->trabajador->id)->assertSessionHas('ok');
    expect($this->negocio->miembros()->whereKey($this->trabajador->id)->exists())->toBeFalse()
        ->and(TareaTrabajo::find($tarea->id))->toBeNull();
});

test('un trabajador ve Trabajadores sin editar y solo marca sus propias tareas', function () {
    Gestion::activar($this->negocio);
    $suya = $this->negocio->tareas()->create(['user_id' => $this->trabajador->id, 'titulo' => 'Ordenar la bodega']);
    $ajena = $this->negocio->tareas()->create(['user_id' => $this->dueno->id, 'titulo' => 'Pagar el arriendo']);
    entrarAlPanel($this, $this->trabajador);

    $this->get('/negocio/trabajadores?pestana=tareas')->assertOk()->assertSee('Ordenar la bodega')->assertDontSee('+ Asociar trabajador')->assertDontSee('+ Asignar tarea');
    $this->put('/negocio/trabajadores/'.$this->trabajador->id, ['cargo' => 'Jefe'])->assertForbidden();
    $this->post('/negocio/trabajadores/invitar', ['codigo' => 'UABC23'])->assertForbidden();
    $this->post('/negocio/trabajadores/tareas', ['user_id' => $this->trabajador->id, 'titulo' => 'Algo'])->assertForbidden();
    $this->patch('/negocio/trabajadores/tareas/'.$ajena->id.'/estado', ['estado' => 'hecha'])->assertForbidden();
    $this->patch('/negocio/trabajadores/tareas/'.$suya->id.'/estado', ['estado' => 'hecha'])->assertSessionHas('ok');
    expect($suya->fresh()->estado)->toBe('hecha')->and($suya->fresh()->hecha_at)->not->toBeNull();

    // Con el permiso «Asignar tareas» ya asigna.
    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['equipo.tareas']);
    $this->post('/negocio/trabajadores/tareas', ['user_id' => $this->dueno->id, 'tipo' => 'tarea', 'titulo' => 'Llamar al proveedor'])->assertSessionHas('ok');
});

test('se asignan tareas y pedidos en curso, se cambian de estado y salen en Pedidos', function () {
    Gestion::activar($this->negocio);
    $cliente = User::factory()->create(['name' => 'Ana Cliente']);
    $enCurso = panelPedido($this->negocio, $cliente, 'aceptado', now());
    $entregado = panelPedido($this->negocio, $cliente, 'entregado', now()->subDay());
    entrarAlPanel($this, $this->dueno);

    $this->post('/negocio/trabajadores/tareas', [
        'user_id' => $this->trabajador->id, 'tipo' => 'tarea', 'titulo' => 'Pintar la reja', 'descripcion' => 'Color negro',
        'fecha' => today()->format('Y-m-d'), 'urgente' => 1,
    ])->assertRedirect('/negocio/trabajadores?pestana=tareas')->assertSessionHas('ok');
    $this->post('/negocio/trabajadores/tareas', ['user_id' => $this->trabajador->id, 'tipo' => 'pedido', 'pedido_id' => $enCurso->id])->assertSessionHas('ok');
    $this->post('/negocio/trabajadores/tareas', ['user_id' => $this->trabajador->id, 'tipo' => 'pedido', 'pedido_id' => $entregado->id])->assertSessionHasErrors('pedido_id');
    $this->post('/negocio/trabajadores/tareas', ['user_id' => $this->trabajador->id, 'tipo' => 'tarea'])->assertSessionHasErrors('titulo');
    $this->post('/negocio/trabajadores/tareas', ['user_id' => $this->trabajador->id, 'tipo' => 'tarea', 'titulo' => 'Ayer', 'fecha' => today()->subDay()->format('Y-m-d')])->assertSessionHasErrors('fecha');
    $this->post('/negocio/trabajadores/tareas', ['user_id' => User::factory()->create()->id, 'tipo' => 'tarea', 'titulo' => 'X'])->assertSessionHasErrors('user_id');

    $delPedido = $this->negocio->tareas()->whereNotNull('pedido_id')->firstOrFail();
    expect($delPedido->titulo)->toBe('Atender el pedido '.$enCurso->codigo)->and($delPedido->creada_por)->toBe($this->dueno->id);
    $this->get('/negocio/trabajadores?pestana=tareas')->assertSee('Pintar la reja')->assertSee('Urgente')->assertSee($enCurso->codigo)->assertSee('Hoy');
    $this->get('/negocio/pedidos')->assertSee('👤 Ayudante')->assertSee('Asignado a');

    $tarea = $this->negocio->tareas()->where('titulo', 'Pintar la reja')->firstOrFail();
    $this->put('/negocio/trabajadores/tareas/'.$tarea->id, ['user_id' => $this->dueno->id, 'tipo' => 'tarea', 'titulo' => 'Pintar la reja de negro'])->assertSessionHas('ok');
    expect($tarea->fresh()->user_id)->toBe($this->dueno->id)->and($tarea->fresh()->urgente)->toBeFalse();
    $this->patch('/negocio/trabajadores/tareas/'.$tarea->id.'/estado', ['estado' => 'hecha'])->assertSessionHas('ok');
    $this->get('/negocio/trabajadores?pestana=tareas')->assertDontSee('tarea-titulo">Pintar la reja de negro', false);
    $this->get('/negocio/trabajadores?pestana=tareas&estado=hechas')->assertSee('Pintar la reja de negro');
    $this->delete('/negocio/trabajadores/tareas/'.$tarea->id)->assertSessionHas('ok');
    expect(TareaTrabajo::find($tarea->id))->toBeNull();
});
