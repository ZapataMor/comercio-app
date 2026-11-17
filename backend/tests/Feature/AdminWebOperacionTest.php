<?php

use App\Events\CambioEnVivo;
use App\Models\Ajuste;
use App\Models\Barrio;
use App\Models\Resena;
use App\Models\User;
use App\Support\EnVivo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    Notification::fake();
    $this->operador = User::factory()->create();
    $this->operador->assignRole('administrador');
    $this->clienteWeb = User::factory()->create(['name' => 'Cliente visible']);
    $this->clienteWeb->assignRole('usuario');
    $this->tiendaWeb = $this->clienteWeb->negocio()->create(['nombre' => 'Tienda visible', 'horario' => ['lun' => ['abre' => '08:00', 'cierra' => '18:00'], 'dom' => null]]);
    $this->tiendaWeb->productos()->create(['nombre' => 'Pan visible', 'precio' => 3000]);
    $this->pedidoWeb = $this->tiendaWeb->pedidos()->create(['user_id' => $this->clienteWeb->id, 'estado' => 'listo', 'total' => 3000, 'metodo_pago' => 'efectivo', 'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567']);
    $this->pedidoWeb->items()->create(['nombre' => 'Pan visible', 'precio' => 3000, 'cantidad' => 1]);
});

test('panel web renderiza todos los módulos y fichas con datos', function () {
    $this->actingAs($this->operador);
    foreach (['', '/usuarios', '/negocios', '/pedidos', '/configuracion', '/mapa', '/resenas', '/reputacion', '/auditoria', '/reportes', '/usuarios/'.$this->clienteWeb->id, '/negocios/'.$this->tiendaWeb->id, '/pedidos/'.$this->pedidoWeb->id, '/reputacion/negocio/'.$this->tiendaWeb->id] as $ruta) {
        $this->get('/admin'.$ruta)->assertOk();
    }
    $this->get('/admin/pedidos/'.$this->pedidoWeb->id)->assertSee('Pan visible')->assertSee('3.000');
});

test('rutas administrativas rechazan visitantes y clientes', function () {
    $this->get('/admin/pedidos')->assertRedirect('/login');
    $this->actingAs($this->clienteWeb)->get('/admin/pedidos')->assertForbidden();
    $this->post('/admin/acciones/tarifa', ['tarifa_domicilio' => 5000])->assertForbidden();
    $this->get('/admin/pedidos/exportar')->assertForbidden();
});

test('sesión web suspendida pierde acceso', function () {
    $this->operador->forceFill(['suspendido_at' => now()])->save();
    $this->actingAs($this->operador)->get('/admin')->assertRedirect('/login');
    $this->assertGuest();
});

test('suspende y reactiva con auditoría sin contraseñas', function () {
    $this->actingAs($this->operador)->post('/admin/acciones/suspender/'.$this->clienteWeb->id, ['motivo' => 'Pedido falso', 'password' => 'NO_REGISTRAR'])->assertRedirect()->assertSessionHas('ok');
    expect($this->clienteWeb->fresh()->suspendido_at)->not->toBeNull();
    expect(DB::table('admin_acciones')->first()->detalle)->toContain('Pedido falso')->not->toContain('NO_REGISTRAR');
    $this->post('/admin/acciones/reactivar/'.$this->clienteWeb->id)->assertRedirect()->assertSessionHas('ok');
    expect($this->clienteWeb->fresh()->suspendido_at)->toBeNull();
    expect(DB::table('admin_acciones')->count())->toBe(2);
});

test('autoprotección y cierre inválido no registran éxito', function () {
    $this->actingAs($this->operador)->post('/admin/acciones/suspender/'.$this->operador->id, ['motivo' => 'Prueba'])->assertSessionHas('error');
    $this->get('/admin');
    $this->post('/admin/acciones/cerrar/'.$this->pedidoWeb->id, ['resultado' => 'entregado', 'motivo' => 'No recogido'])->assertSessionHas('error');
    expect($this->pedidoWeb->fresh()->estado)->toBe('listo');
    expect(DB::table('admin_acciones')->count())->toBe(0);
});

test('cierra un pedido con motivo y conserva responsable', function () {
    $this->actingAs($this->operador)->post('/admin/acciones/cerrar/'.$this->pedidoWeb->id, ['resultado' => 'cancelado', 'motivo' => 'Cliente solicitó cancelación'])->assertSessionHas('ok');
    expect($this->pedidoWeb->fresh()->estado)->toBe('cancelado');
    expect($this->pedidoWeb->fresh()->cerrado_por_admin_id)->toBe($this->operador->id);
    expect(DB::table('admin_acciones')->count())->toBe(1);
});

test('filtros de pedidos y CSV coinciden y neutralizan fórmulas', function () {
    $this->tiendaWeb->update(['nombre' => '=SUM(1,2)']);
    $this->actingAs($this->operador);
    $this->get('/admin/pedidos?estado=entregado')->assertDontSee($this->pedidoWeb->codigo);
    $this->get('/admin/pedidos?buscar='.$this->pedidoWeb->codigo)->assertSee($this->pedidoWeb->codigo);
    $csv = $this->get('/admin/pedidos/exportar?estado=listo')->assertOk()->streamedContent();
    expect($csv)->toContain($this->pedidoWeb->codigo)->toContain("'=SUM(1,2)");
    expect($this->get('/admin/pedidos/exportar?estado=entregado')->streamedContent())->not->toContain($this->pedidoWeb->codigo);
    $this->get('/admin/pedidos?hasta='.now()->toDateString())->assertOk();
    $this->get('/admin/pedidos?desde=2026-11-10&hasta=2026-11-01')->assertSessionHasErrors('hasta');
});

test('usuarios y negocios se buscan y paginan', function () {
    $this->actingAs($this->operador)->get('/admin/usuarios?rol=usuario&buscar=Cliente')->assertSee('Cliente visible');
    $this->get('/admin/usuarios?rol=usuario&buscar=Inexistente')->assertDontSee('Cliente visible');
    $this->get('/admin/negocios?buscar=Inexistente')->assertDontSee('Tienda visible');
    User::factory()->count(26)->create()->each(fn ($u) => $u->assignRole('usuario'));
    $this->get('/admin/usuarios?rol=usuario')->assertViewHas('usuarios', fn ($p) => $p->count() === 25 && $p->total() === 27);
});

test('tarifa y barrios validan y persisten cambios', function () {
    $b = Barrio::create(['nombre' => 'Nuevo barrio', 'aprobado' => false]);
    $this->actingAs($this->operador)->post('/admin/acciones/tarifa', ['tarifa_domicilio' => -1])->assertSessionHasErrors('tarifa_domicilio');
    $this->get('/admin/configuracion');
    $this->post('/admin/acciones/tarifa', ['tarifa_domicilio' => 4500])->assertSessionHas('ok');
    expect(Ajuste::tarifaDomicilio())->toBe(4500);
    $this->post('/admin/acciones/aprobar-barrio/'.$b->id)->assertSessionHas('ok');
    expect($b->fresh()->aprobado)->toBeTrue();
    $this->post('/admin/acciones/rechazar-barrio/'.$b->id)->assertNotFound();
});

test('moderación y reputación web ejecutan reglas existentes', function () {
    $r = Resena::create(['user_id' => $this->clienteWeb->id, 'negocio_id' => $this->tiendaWeb->id, 'pedido_id' => $this->pedidoWeb->id, 'objeto' => 'negocio', 'estrellas' => 1, 'comentario' => 'Comentario de prueba']);
    $this->actingAs($this->operador)->get('/admin/resenas?filtro=todas')->assertOk()->assertSee('Comentario de prueba');
    $this->post('/admin/acciones/ocultar/'.$r->id, ['motivo' => 'Insultos'])->assertSessionHas('ok');
    expect($r->fresh()->oculta_at)->not->toBeNull();
    $this->post('/admin/acciones/restaurar/'.$r->id, ['motivo' => 'Revisión corregida'])->assertSessionHas('ok');
    expect($r->fresh()->oculta_at)->toBeNull();
    $this->post('/admin/acciones/vetar/'.$this->tiendaWeb->id, ['tipo' => 'negocio', 'motivo' => 'Incumplimientos'])->assertSessionHas('ok');
    expect($this->tiendaWeb->fresh()->vetado_at)->not->toBeNull();
    $this->get('/admin/reputacion/negocio/'.$this->tiendaWeb->id)->assertOk()->assertSee('Incumplimientos');
    $this->post('/admin/acciones/levantar-veto/'.$this->tiendaWeb->id, ['tipo' => 'negocio'])->assertSessionHas('ok');
    expect($this->tiendaWeb->fresh()->vetado_at)->toBeNull();
});

test('cambios web avisan a la app y errores no emiten cambios', function () {
    EnVivo::olvidar();
    Event::fake([CambioEnVivo::class]);
    $this->actingAs($this->operador)->post('/admin/acciones/tarifa', ['tarifa_domicilio' => 5000])->assertSessionHas('ok');
    Event::assertDispatched(CambioEnVivo::class, fn ($e) => $e->tema === 'ajustes' && in_array('catalogo', $e->canales));
    Event::fake([CambioEnVivo::class]);
    $this->post('/admin/acciones/cerrar/'.$this->pedidoWeb->id, ['resultado' => 'entregado', 'motivo' => 'Inválido'])->assertSessionHas('error');
    Event::assertNotDispatched(CambioEnVivo::class);
});

test('cambio de rol exige motivo y queda en auditoría', function () {
    $this->actingAs($this->operador)->put('/admin/usuarios/'.$this->clienteWeb->id.'/rol', ['rol' => 'domiciliario'])->assertSessionHasErrors('motivo');
    $this->get('/admin/usuarios');
    $this->put('/admin/usuarios/'.$this->clienteWeb->id.'/rol', ['rol' => 'domiciliario', 'motivo' => 'Alta de repartidor'])->assertSessionHas('ok');
    expect($this->clienteWeb->fresh()->hasRole('domiciliario'))->toBeTrue();
    expect(DB::table('admin_acciones')->sole()->detalle)->toContain('Alta de repartidor')->toContain('domiciliario');
});

test('filtro de demoras y fecha de resultado reflejan la operación', function () {
    $this->pedidoWeb->forceFill(['updated_at' => now()->subHour()])->save();
    $this->actingAs($this->operador)->get('/admin/pedidos?demorados=1')->assertSee($this->pedidoWeb->codigo);
    $this->pedidoWeb->forceFill(['estado' => 'entregado', 'created_at' => now()->subDays(3), 'entregado_at' => now()])->save();
    $this->get('/admin/pedidos?demorados=1')->assertDontSee($this->pedidoWeb->codigo);
    $this->get('/admin/pedidos?estado=entregado&fecha=resultado&desde='.now()->toDateString())->assertSee($this->pedidoWeb->codigo);
    $this->get('/admin/pedidos?estado=entregado&fecha=creacion&desde='.now()->toDateString())->assertDontSee($this->pedidoWeb->codigo);
});

test('mapa descarta ubicaciones vencidas y escapa nombres', function () {
    $d = User::factory()->create(['name' => 'Repartidor reciente']);
    $d->assignRole('domiciliario');
    $d->forceFill(['en_turno' => true, 'ubicacion_at' => now(), 'ubicacion_lat' => 11.38, 'ubicacion_lng' => -72.24])->save();
    $this->actingAs($this->operador)->get('/admin/mapa')->assertOk()->assertSee('Repartidor reciente');
    $d->forceFill(['ubicacion_at' => now()->subMinutes(6)])->save();
    $this->get('/admin/mapa')->assertDontSee('Repartidor reciente');
});

test('mapa de negocios incluye todas las páginas y respeta filtros', function () {
    for ($i = 0; $i < 26; $i++) {
        $this->clienteWeb->negocio()->create(['nombre' => 'Mapa '.$i, 'lat' => 11.38, 'lng' => -72.24, 'activo' => $i === 0]);
    }
    $this->actingAs($this->operador)->get('/admin/negocios')
        ->assertOk()->assertViewHas('ubicaciones', fn ($p) => $p->count() === 26)
        ->assertViewHas('negocios', fn ($p) => $p->count() === 25 && $p->total() === 27)
        ->assertSee('mapa-negocios')->assertSee('negocios-cards');
    $this->get('/admin/negocios?buscar=Mapa&abiertos=1')
        ->assertOk()->assertViewHas('ubicaciones', fn ($p) => $p->count() === 1)
        ->assertViewHas('negocios', fn ($p) => $p->total() === 1);
    $this->get('/admin/negocios?buscar=Tienda')->assertSee('Sin ubicación')
        ->assertViewHas('ubicaciones', fn ($p) => $p->isEmpty());
});

test('ficha reúne imágenes y secciones sin mezclar negocios', function () {
    $this->tiendaWeb->forceFill(['imagen' => 'negocios/portada.jpg'])->save();
    $this->tiendaWeb->productos()->first()->forceFill(['imagen' => 'productos/pan.jpg'])->save();
    $otra = $this->clienteWeb->negocio()->create(['nombre' => 'Negocio ajeno']);
    $otroPedido = $otra->pedidos()->create(['user_id' => $this->clienteWeb->id, 'estado' => 'entregado', 'total' => 99000, 'metodo_pago' => 'efectivo', 'direccion_entrega' => 'Calle 2', 'telefono_contacto' => '3001234567']);
    Resena::create(['user_id' => $this->clienteWeb->id, 'pedido_id' => $this->pedidoWeb->id, 'negocio_id' => $this->tiendaWeb->id, 'objeto' => 'negocio', 'estrellas' => 5, 'comentario' => 'Reseña propia']);
    Resena::create(['user_id' => $this->clienteWeb->id, 'pedido_id' => $otroPedido->id, 'negocio_id' => $otra->id, 'objeto' => 'negocio', 'estrellas' => 1, 'comentario' => 'Reseña ajena']);
    $url = '/admin/negocios/'.$this->tiendaWeb->id;
    $this->actingAs($this->operador)->get($url)->assertOk()->assertSee('/storage/negocios/portada.jpg')->assertSee('Secciones del negocio');
    $this->get($url.'?seccion=productos')->assertOk()->assertSee('Pan visible')->assertSee('/storage/productos/pan.jpg');
    foreach (['servicios', 'equipo', 'reputacion'] as $seccion) {
        $this->get($url.'?seccion='.$seccion)->assertOk();
    }
    $this->get($url.'?seccion=pedidos&negocio='.$otra->id)->assertOk()->assertSee($this->pedidoWeb->codigo)->assertDontSee($otroPedido->codigo);
    $this->get($url.'?seccion=resenas')->assertOk()->assertSee('Reseña propia')->assertDontSee('Reseña ajena');
    $this->get($url.'/pedidos/'.$otroPedido->id)->assertNotFound();
    $this->get($url.'/pedidos/'.$this->pedidoWeb->id)->assertOk()->assertSee('Tienda visible');
    $csv = $this->get($url.'/pedidos/exportar?negocio='.$otra->id)->assertOk()->streamedContent();
    expect($csv)->toContain($this->pedidoWeb->codigo)->not->toContain($otroPedido->codigo);
});

test('reseñas del negocio conservan filtro y paginación al moderar', function () {
    for ($i = 0; $i < 21; $i++) {
        $pedido = $this->tiendaWeb->pedidos()->create(['user_id' => $this->clienteWeb->id, 'estado' => 'entregado', 'total' => 3000, 'metodo_pago' => 'efectivo', 'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567']);
        Resena::create(['user_id' => $this->clienteWeb->id, 'pedido_id' => $pedido->id, 'negocio_id' => $this->tiendaWeb->id, 'objeto' => 'negocio', 'estrellas' => 5, 'comentario' => 'Opinión '.$i]);
    }
    $url = '/admin/negocios/'.$this->tiendaWeb->id.'?seccion=resenas&filtro=todas&page=2';
    $this->actingAs($this->operador)->get($url)->assertOk()->assertSee('Opinión 0')->assertDontSee('Opinión 20');
    $r = Resena::oldest('id')->first();
    $this->from($url)->post('/admin/acciones/ocultar/'.$r->id, ['motivo' => 'Revisión administrativa'])->assertRedirect($url)->assertSessionHas('ok');
    $this->get('/admin/negocios/'.$this->tiendaWeb->id.'?seccion=resenas&filtro=ocultas')->assertOk()->assertSee('Opinión 0')->assertDontSee('Opinión 20');
});
