<?php

use App\Events\CambioEnVivo;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\User;
use App\Support\EnVivo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Cambios en vivo: lo que alguien hace se avisa por WebSocket a los demás
// dispositivos que lo muestran (ver App\Support\EnVivo).

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['firebase.projects.app.credentials' => 'fake.json']);
    Notification::fake();
    EnVivo::olvidar();
});

function vivoUsuario(string $rol = 'usuario'): User
{
    $user = User::factory()->create();
    $user->assignRole($rol);

    return $user;
}

function vivoNegocio(?User $dueno = null, array $datos = []): Negocio
{
    return ($dueno ?? vivoUsuario())->negocio()->create(['nombre' => 'Tienda', 'activo' => true, 'tiempo_preparacion' => 20, ...$datos]);
}

function vivoPedido(Negocio $negocio, string $estado = 'pendiente', array $extra = []): Pedido
{
    return $negocio->pedidos()->create([
        'user_id' => vivoUsuario()->id,
        'estado' => $estado,
        'metodo_pago' => 'efectivo',
        'subtotal' => 10000,
        'costo_domicilio' => 4000,
        'total' => 14000,
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
        'minutos_preparacion' => 20,
        ...$extra,
    ]);
}

/** ¿Se emitió un aviso del tema a todos estos canales? */
function vivoEmitido(string $tema, array $canales): bool
{
    return Event::dispatched(CambioEnVivo::class, fn (CambioEnVivo $e) => $e->tema === $tema && ! array_diff($canales, $e->canales))->isNotEmpty();
}

test('toda ruta que cambia datos dice a quién avisar en vivo', function () {
    $acciones = EnVivo::acciones();
    $faltan = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($ruta) => array_diff($ruta->methods(), ['GET', 'HEAD', 'OPTIONS']))
        ->map(fn ($ruta) => $ruta->getActionName())
        ->filter(fn ($accion) => str_starts_with($accion, 'App\\Http\\Controllers\\'))
        ->reject(fn ($accion) => array_key_exists($accion, $acciones))
        ->values()
        ->all();

    // Si falla: agrega la acción a EnVivo::acciones() (null si no cambia nada que vean otros).
    expect($faltan)->toBe([]);
});

test('cerrar el negocio avisa al catálogo y al equipo al instante', function () {
    Event::fake([CambioEnVivo::class]);
    $dueno = vivoUsuario();
    $negocio = vivoNegocio($dueno);

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}", ['activo' => false])->assertOk();

    expect(vivoEmitido('negocio', ['catalogo', "negocio.{$negocio->id}"]))->toBeTrue();
    Event::assertDispatched(CambioEnVivo::class, fn (CambioEnVivo $e) => $e->broadcastWith() === ['tema' => 'negocio', 'negocio_id' => $negocio->id]
        && $e->broadcastAs() === 'cambio');
});

test('una acción que falla no avisa a nadie', function () {
    Event::fake([CambioEnVivo::class]);
    $negocio = vivoNegocio();

    // Un extraño no puede cerrar el negocio.
    Sanctum::actingAs(vivoUsuario());
    $this->putJson("/api/negocios/{$negocio->id}", ['activo' => false])->assertForbidden();

    Event::assertNotDispatched(CambioEnVivo::class);
});

test('aceptar un pedido avisa al cliente, al equipo y al admin', function () {
    Event::fake([CambioEnVivo::class]);
    $dueno = vivoUsuario();
    $negocio = vivoNegocio($dueno);
    $pedido = vivoPedido($negocio);

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/aceptar")->assertOk();

    expect(vivoEmitido('pedidos', ["usuario.{$pedido->user_id}", "negocio.{$negocio->id}", 'admin']))->toBeTrue()
        // Aceptado aún no se puede tomar: los domiciliarios no se enteran.
        ->and(vivoEmitido('disponibles', ['domiciliarios']))->toBeFalse();
});

test('un pedido listo sin domiciliario avisa a los domiciliarios', function () {
    Event::fake([CambioEnVivo::class]);
    $dueno = vivoUsuario();
    $negocio = vivoNegocio($dueno);
    $pedido = vivoPedido($negocio, 'aceptado', ['aceptado_at' => now()]);

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/listo")->assertOk();

    expect(vivoEmitido('disponibles', ['domiciliarios']))->toBeTrue()
        ->and(vivoEmitido('pedidos', ["usuario.{$pedido->user_id}"]))->toBeTrue();
});

test('cambiar el catálogo avisa a quien mira ese negocio', function () {
    Event::fake([CambioEnVivo::class]);
    $dueno = vivoUsuario();
    $negocio = vivoNegocio($dueno);

    Sanctum::actingAs($dueno);
    $this->postJson("/api/negocios/{$negocio->id}/categorias", ['nombre' => 'Panes'])->assertCreated();

    expect(vivoEmitido('catalogo', ['catalogo', "negocio.{$negocio->id}"]))->toBeTrue();
});

test('quitar a alguien del equipo le actualiza sus negocios en vivo', function () {
    Event::fake([CambioEnVivo::class]);
    $dueno = vivoUsuario();
    $negocio = vivoNegocio($dueno);
    $trabajador = vivoUsuario();
    $negocio->miembros()->attach($trabajador->id, ['rol' => Negocio::ROL_TRABAJADOR, 'activo' => true]);

    Sanctum::actingAs($dueno);
    $this->deleteJson("/api/negocios/{$negocio->id}/miembros/{$trabajador->id}")->assertOk();

    expect(vivoEmitido('equipo', ["negocio.{$negocio->id}"]))->toBeTrue()
        ->and(vivoEmitido('negocios', ["usuario.{$trabajador->id}"]))->toBeTrue();
});

test('el admin cambia el rol de alguien y su app se entera', function () {
    Event::fake([CambioEnVivo::class]);
    $usuario = vivoUsuario();

    Sanctum::actingAs(vivoUsuario('administrador'));
    $this->putJson("/api/admin/usuarios/{$usuario->id}/rol", ['rol' => 'domiciliario'])->assertSuccessful();

    expect(vivoEmitido('perfil', ["usuario.{$usuario->id}"]))->toBeTrue();
});

test('el horario automático avisa cuando abre o cierra el negocio', function () {
    $negocio = vivoNegocio(null, [
        'activo' => false,
        'horario' => ['lun' => ['abre' => '07:00', 'cierra' => '20:00']],
    ]);

    $this->travelTo(Carbon::parse('2026-11-09 07:01')); // lunes
    $this->artisan('negocios:aplicar-horario')->assertSuccessful();

    expect($negocio->fresh()->activo)->toBeTrue()
        ->and(collect(EnVivo::pendientes())->contains(fn ($p) => $p[1] === 'negocio' && in_array('catalogo', $p[0], true)))->toBeTrue();
});

test('un pedido vencido por el sistema también se avisa', function () {
    $negocio = vivoNegocio();
    $pedido = vivoPedido($negocio);

    $this->travel(6)->minutes();
    $this->artisan('pedidos:vencer')->assertSuccessful();

    expect($pedido->fresh()->estado)->toBe('cancelado')
        ->and(collect(EnVivo::pendientes())->contains(fn ($p) => $p[1] === 'pedidos' && in_array("usuario.{$pedido->user_id}", $p[0], true)))->toBeTrue();
});

test('los avisos repetidos en una misma petición salen una sola vez', function () {
    Event::fake([CambioEnVivo::class]);

    EnVivo::pedido(vivoPedido(vivoNegocio()));
    $pedido = Pedido::first();
    EnVivo::pedido($pedido);
    EnVivo::enviar();

    Event::assertDispatchedTimes(CambioEnVivo::class, 1);
});

test('si Reverb no está corriendo la acción igual funciona', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'x',
        'broadcasting.connections.reverb.secret' => 'x',
        'broadcasting.connections.reverb.app_id' => 'x',
        'broadcasting.connections.reverb.options' => ['host' => '127.0.0.1', 'port' => 1, 'scheme' => 'http', 'useTLS' => false],
    ]);
    $dueno = vivoUsuario();
    $negocio = vivoNegocio($dueno);

    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}", ['activo' => false])->assertOk();

    expect($negocio->fresh()->activo)->toBeFalse();
});

test('cada sesión recibe solo los canales que le corresponden', function () {
    $dueno = vivoUsuario('domiciliario');
    $negocio = vivoNegocio($dueno);
    vivoNegocio(); // de otro: no aparece

    Sanctum::actingAs($dueno);
    $this->getJson('/api/en-vivo/canales')
        ->assertOk()
        ->assertJsonPath('publicos', ['catalogo'])
        ->assertJsonPath('privados', ["usuario.{$dueno->id}", "negocio.{$negocio->id}", 'domiciliarios'])
        ->assertJsonPath('user.id', $dueno->id)
        ->assertJsonPath('user.roles', ['domiciliario']);
});

test('los canales privados solo los escucha quien debe', function () {
    config(['broadcasting.default' => 'reverb', 'broadcasting.connections.reverb.key' => 'k', 'broadcasting.connections.reverb.secret' => 's', 'broadcasting.connections.reverb.app_id' => 'a']);
    // Los tests arrancan con el broadcaster «null»: se registran los canales en el de Reverb.
    require base_path('routes/channels.php');
    $dueno = vivoUsuario();
    $negocio = vivoNegocio($dueno);
    $otro = vivoUsuario();
    $auth = fn (string $canal) => $this->postJson('/api/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => "private-{$canal}"]);

    Sanctum::actingAs($dueno);
    $auth("usuario.{$dueno->id}")->assertOk()->assertJsonStructure(['auth']);
    $auth("negocio.{$negocio->id}")->assertOk();
    $auth("usuario.{$otro->id}")->assertForbidden();
    $auth('admin')->assertForbidden();
    $auth('domiciliarios')->assertForbidden();

    Sanctum::actingAs($otro);
    $auth("negocio.{$negocio->id}")->assertForbidden();
});
