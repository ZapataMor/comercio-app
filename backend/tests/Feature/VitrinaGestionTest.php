<?php

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Gestion\Modulos;
use App\Models\AccesoWeb;
use App\Models\Negocio;
use App\Models\PlantillaGestion;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
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
    $test->get('/negocio/entrar')->assertOk();
    $acceso = AccesoWeb::latest('id')->first();
    AccesosWeb::aprobar($acceso->codigo, $user);
    $test->getJson('/negocio/entrar/estado')->assertJsonPath('estado', 'listo');
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
    $this->get('/negocio')->assertRedirect('/negocio/entrar');
    $this->get('/negocio/entrar')->assertOk()->assertSee('Panel web del negocio');
    $acceso = AccesoWeb::latest('id')->first();
    $this->getJson('/negocio/entrar/estado')->assertJsonPath('estado', 'pendiente');

    // La app: consulta y aprueba (con guion y minúsculas también sirve).
    $codigo = strtolower($acceso->codigoVisible());
    $this->actingAs($this->dueno)->postJson('/api/acceso-web/consultar', ['codigo' => $codigo])->assertOk()->assertJsonStructure(['navegador', 'codigo']);
    $this->postJson('/api/acceso-web/aprobar', ['codigo' => $codigo])->assertOk();
    $this->postJson('/api/acceso-web/aprobar', ['codigo' => $codigo])->assertUnprocessable();
    comoNavegador($this);

    $this->getJson('/negocio/entrar/estado')->assertJsonPath('estado', 'listo');
    $this->get('/negocio')->assertOk()->assertSee('Inicio')->assertSee('Latonería');
    expect(auth()->id())->toBe($this->dueno->id);
    foreach (['tienda', 'catalogo', 'pedidos', 'equipo', 'agenda', 'resenas', 'sedes'] as $ruta) {
        $this->get('/negocio/'.$ruta)->assertOk();
    }
});

test('no aprueba códigos vencidos ni de quien no tiene panel web', function () {
    $this->get('/negocio/entrar');
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

    $this->get('/negocio')->assertRedirect('/negocio/entrar');
    $this->assertGuest();
});

test('la sesión web vence a las 12 horas y si se apaga el panel', function () {
    Gestion::activar($this->negocio);
    entrarAlPanel($this, $this->dueno);
    $this->travel(AccesosWeb::HORAS_SESION + 1)->hours();
    $this->get('/negocio')->assertRedirect('/negocio/entrar');
    $this->travelBack();

    entrarAlPanel($this, $this->dueno);
    Gestion::desactivar($this->negocio);
    $this->get('/negocio')->assertRedirect('/negocio/entrar')->assertSessionHas('error');
});

test('el super administrador con contraseña no pierde su sesión al visitar el panel del negocio', function () {
    $this->actingAs($this->super)->get('/negocio')->assertRedirect('/negocio/entrar');
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
    $this->put('/negocio/equipo/'.$this->trabajador->id.'/permisos', ['permisos' => ['caja.vender']])->assertForbidden();

    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['caja.vender']);
    $this->get('/negocio')->assertSee('/negocio/modulos/caja');
    $this->get('/negocio/modulos/caja')->assertOk()->assertSee('Vender en la caja');
    expect(Gestion::puede($this->trabajador, $this->negocio, 'caja.vender'))->toBeTrue()
        ->and(Gestion::puede($this->trabajador, $this->negocio, 'caja.cerrar'))->toBeFalse()
        ->and(Gestion::puede($this->dueno, $this->negocio, 'caja.cerrar'))->toBeTrue();

    // Si se apaga el módulo, el permiso se conserva pero deja de valer.
    Gestion::definirModulos($this->negocio, ['personal']);
    expect(Gestion::puede($this->trabajador, $this->negocio, 'caja.vender'))->toBeFalse();
    Gestion::guardarPermisos($this->negocio, $this->trabajador, ['personal.tareas']);
    Gestion::definirModulos($this->negocio, ['personal', 'caja']);
    expect(Gestion::permisosDe($this->trabajador, $this->negocio))->toEqualCanonicalizing(['caja.vender', 'personal.tareas']);
});

test('el dueño da permisos de módulos desde Equipo', function () {
    Gestion::activar($this->negocio);
    Gestion::definirModulos($this->negocio, ['personal']);
    entrarAlPanel($this, $this->dueno);
    $this->get('/negocio/equipo')->assertOk()->assertSee('Asignar tareas');
    $this->put('/negocio/equipo/'.$this->trabajador->id.'/permisos', ['permisos' => ['personal.tareas']])->assertSessionHas('ok');
    $this->put('/negocio/equipo/'.$this->trabajador->id.'/permisos', ['permisos' => ['caja.vender']])->assertSessionHasErrors('permisos');
    expect(Gestion::permisosDe($this->trabajador, $this->negocio))->toBe(['personal.tareas']);
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
