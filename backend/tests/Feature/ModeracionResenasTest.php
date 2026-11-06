<?php

use App\Models\Negocio;
use App\Models\Producto;
use App\Models\Resena;
use App\Models\User;
use App\Support\EliminarCuenta;
use App\Support\Resenas;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('usuario', 'web');
    Role::findOrCreate('administrador', 'web');

    $this->admin = User::factory()->create(['name' => 'Ada', 'apellidos' => 'Admin']);
    $this->admin->assignRole('administrador');

    $this->dueno = User::factory()->create();
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'La Espiga', 'activo' => true]);
    $this->producto = $this->negocio->productos()->create(['nombre' => 'Pan', 'precio' => 5000]);

    $this->ana = User::factory()->create(['name' => 'Ana', 'apellidos' => 'Pérez']);
    $this->beto = User::factory()->create(['name' => 'Beto', 'apellidos' => 'Ruiz']);

    $this->mala = moderarResena($this->negocio, $this->ana, 1, 'Comentario grosero');
    $this->buena = moderarResena($this->negocio, $this->beto, 5, 'Muy bien');
});

function moderarResena(Negocio $negocio, User $cliente, int $estrellas, ?string $comentario, ?Producto $producto = null): Resena
{
    $pedido = $negocio->pedidos()->create([
        'user_id' => $cliente->id,
        'estado' => 'entregado',
        'metodo_pago' => 'efectivo',
        'total' => 12000,
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
        'entregado_at' => now(),
    ]);

    $datos = ['estrellas' => $estrellas, 'comentario' => $comentario];

    if ($producto) {
        Resenas::guardar($pedido, null, [array_merge($datos, ['producto_id' => $producto->id])]);
    } else {
        Resenas::guardar($pedido, $datos, []);
    }

    return Resena::where('pedido_id', $pedido->id)->firstOrFail();
}

function moderarPublicas(Negocio $negocio, ?int $productoId = null)
{
    return test()->getJson("/api/negocios/{$negocio->id}/resenas".($productoId ? "?producto_id={$productoId}" : ''))->assertOk();
}

// --- Ocultar y restaurar ---

test('una reseña oculta no sale en la lista pública ni cuenta en el promedio', function () {
    Sanctum::actingAs($this->admin);

    expect($this->negocio->fresh()->resenas_promedio)->toEqual(3.0);

    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => 'Insultos'])->assertOk();

    $negocio = $this->negocio->fresh();
    expect($negocio->resenas_promedio)->toEqual(5.0)
        ->and($negocio->resenas_total)->toBe(1);

    $lista = moderarPublicas($this->negocio)->json();
    expect(collect($lista['resenas'])->pluck('id')->all())->toBe([$this->buena->id])
        ->and($lista['resumen']['promedio'])->toEqual(5)
        ->and($lista['resumen']['total'])->toBe(1)
        ->and(collect($lista['resumen']['distribucion'])->firstWhere('estrellas', 1)['cantidad'])->toBe(0);
});

test('al restaurar vuelve a la lista y al promedio, y el historial guarda los motivos', function () {
    Sanctum::actingAs($this->admin);

    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => 'Insultos'])->assertOk();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/restaurar", ['motivo' => 'Era una queja válida'])->assertOk();

    expect($this->negocio->fresh()->resenas_promedio)->toEqual(3.0);
    expect(moderarPublicas($this->negocio)->json('resenas'))->toHaveCount(2);

    $item = collect($this->getJson('/api/admin/resenas?filtro=todas')->json('resenas'))->firstWhere('id', $this->mala->id);
    expect($item['oculta'])->toBeFalse()
        ->and(collect($item['historial'])->pluck('motivo')->all())->toContain('Insultos', 'Era una queja válida')
        ->and($item['historial'][0]['accion'])->toBe('restaurar')
        ->and($item['historial'][0]['admin'])->toBe('Ada Admin');
});

test('ocultar la reseña de un producto solo recalcula ese producto', function () {
    $delProducto = moderarResena($this->negocio, $this->ana, 2, 'Malo', $this->producto);
    moderarResena($this->negocio, $this->beto, 4, 'Bueno', $this->producto);
    Sanctum::actingAs($this->admin);

    expect($this->producto->fresh()->resenas_promedio)->toEqual(3.0);

    $this->putJson("/api/admin/resenas/{$delProducto->id}/ocultar", ['motivo' => 'Spam'])->assertOk();

    expect($this->producto->fresh()->resenas_promedio)->toEqual(4.0)
        ->and($this->producto->fresh()->resenas_total)->toBe(1)
        ->and($this->negocio->fresh()->resenas_total)->toBe(2);
    expect(moderarPublicas($this->negocio, $this->producto->id)->json('resenas'))->toHaveCount(1);
});

test('se puede ocultar la reseña de un producto borrado del catálogo', function () {
    $delProducto = moderarResena($this->negocio, $this->ana, 2, 'Malo', $this->producto);
    $this->producto->delete();
    Sanctum::actingAs($this->admin);

    $this->putJson("/api/admin/resenas/{$delProducto->id}/ocultar", ['motivo' => 'Spam'])->assertOk();

    expect(Producto::withTrashed()->find($this->producto->id)->resenas_total)->toBe(0);
    expect($this->getJson('/api/admin/resenas?filtro=ocultas')->json('resenas.0.producto'))->toBe('Pan');
});

test('ocultar y restaurar piden motivo y no se repiten', function () {
    Sanctum::actingAs($this->admin);

    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => ''])->assertUnprocessable();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => str_repeat('x', 201)])->assertUnprocessable();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/restaurar", ['motivo' => 'Nada que restaurar'])->assertConflict();

    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => 'Insultos'])->assertOk();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => 'Otra vez'])->assertConflict();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/restaurar", ['motivo' => ''])->assertUnprocessable();

    $this->assertDatabaseCount('resena_moderaciones', 1);
    $this->putJson('/api/admin/resenas/999999/ocultar', ['motivo' => 'Nada'])->assertNotFound();
});

test('si el cliente corrige una reseña oculta sigue oculta y sin contar', function () {
    Sanctum::actingAs($this->admin);
    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => 'Insultos'])->assertOk();

    Sanctum::actingAs($this->ana);
    $this->postJson("/api/pedidos/{$this->mala->pedido_id}/resenas", [
        'tienda' => ['estrellas' => 2, 'comentario' => 'Otro insulto'],
    ])->assertCreated();

    expect($this->mala->fresh()->oculta_at)->not->toBeNull()
        ->and($this->negocio->fresh()->resenas_promedio)->toEqual(5.0);
    expect(moderarPublicas($this->negocio)->json('resenas'))->toHaveCount(1);
});

// --- Reportar ---

test('cualquier usuario reporta una reseña y el reporte llega al admin', function () {
    $tercero = User::factory()->create();

    Sanctum::actingAs($this->beto);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'ofensiva'])->assertCreated();
    Sanctum::actingAs($tercero);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'ofensiva'])->assertCreated();
    Sanctum::actingAs($this->dueno);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'falsa'])->assertCreated();

    Sanctum::actingAs($this->admin);
    $r = $this->getJson('/api/admin/resenas')->assertOk()->json();

    expect($r['filtro'])->toBe('reportadas')
        ->and($r['reportadas'])->toBe(1)
        ->and($r['resenas'])->toHaveCount(1)
        ->and($r['resenas'][0]['id'])->toBe($this->mala->id)
        ->and($r['resenas'][0]['autor'])->toBe('Ana Pérez')
        ->and($r['resenas'][0]['negocio'])->toBe('La Espiga')
        ->and($r['resenas'][0]['reportes'])->toContain(['motivo' => 'Ofensiva o irrespetuosa', 'cantidad' => 2])
        ->and($r['resenas'][0]['reportes'])->toContain(['motivo' => 'Falsa o engañosa', 'cantidad' => 1]);

    $this->getJson('/api/admin/stats')->assertOk()->assertJsonPath('resenas_reportadas', 1);
});

test('las reportadas salen primero las que tienen más reportes', function () {
    $tercero = User::factory()->create();

    Sanctum::actingAs($this->ana);
    $this->postJson("/api/resenas/{$this->buena->id}/reporte", ['motivo' => 'spam'])->assertCreated();
    Sanctum::actingAs($this->beto);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'spam'])->assertCreated();
    Sanctum::actingAs($tercero);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'spam'])->assertCreated();

    Sanctum::actingAs($this->admin);
    expect(collect($this->getJson('/api/admin/resenas')->json('resenas'))->pluck('id')->all())
        ->toBe([$this->mala->id, $this->buena->id]);
});

test('reportar dos veces no suma, y quien reportó lo ve en la lista', function () {
    Sanctum::actingAs($this->beto);

    expect(collect(moderarPublicas($this->negocio)->json('resenas'))->firstWhere('id', $this->mala->id)['reportada'])->toBeFalse();

    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'ofensiva'])->assertCreated();
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'spam'])->assertCreated();

    $this->assertDatabaseCount('resena_reportes', 1);
    $this->assertDatabaseHas('resena_reportes', ['resena_id' => $this->mala->id, 'motivo' => 'ofensiva']);
    expect(collect(moderarPublicas($this->negocio)->json('resenas'))->firstWhere('id', $this->mala->id)['reportada'])->toBeTrue();
});

test('no se reporta la propia reseña, ni una oculta, ni sin motivo válido', function () {
    Sanctum::actingAs($this->ana);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'spam'])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'No puedes reportar tu propia reseña.');

    $this->postJson("/api/resenas/{$this->buena->id}/reporte", ['motivo' => 'porque sí'])->assertUnprocessable();
    $this->postJson("/api/resenas/{$this->buena->id}/reporte", [])->assertUnprocessable();

    $this->mala->forceFill(['oculta_at' => now()])->save();
    Sanctum::actingAs($this->beto);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'spam'])->assertNotFound();
    $this->postJson('/api/resenas/999999/reporte', ['motivo' => 'spam'])->assertNotFound();

    $this->assertDatabaseCount('resena_reportes', 0);
});

test('ocultar atiende los reportes y la reseña pasa a ocultas', function () {
    Sanctum::actingAs($this->beto);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'ofensiva'])->assertCreated();

    Sanctum::actingAs($this->admin);
    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => 'Insultos'])->assertOk();

    $r = $this->getJson('/api/admin/resenas')->json();
    expect($r['resenas'])->toBe([])->and($r['reportadas'])->toBe(0)->and($r['ocultas'])->toBe(1);

    $ocultas = $this->getJson('/api/admin/resenas?filtro=ocultas')->json('resenas');
    expect($ocultas)->toHaveCount(1)->and($ocultas[0]['oculta'])->toBeTrue();
});

test('descartar deja la reseña publicada y la saca de reportadas', function () {
    Sanctum::actingAs($this->beto);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'falsa'])->assertCreated();

    Sanctum::actingAs($this->admin);
    $this->putJson("/api/admin/resenas/{$this->mala->id}/descartar-reportes")->assertOk();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/descartar-reportes")->assertConflict();

    expect($this->getJson('/api/admin/resenas')->json('resenas'))->toBe([]);
    expect($this->mala->fresh()->oculta_at)->toBeNull();
    expect(moderarPublicas($this->negocio)->json('resenas'))->toHaveCount(2);
    $this->assertDatabaseHas('resena_moderaciones', ['resena_id' => $this->mala->id, 'accion' => 'descartar']);
});

test('otra persona puede reportar después de que se descartaron los reportes', function () {
    Sanctum::actingAs($this->beto);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'falsa'])->assertCreated();

    Sanctum::actingAs($this->admin);
    $this->putJson("/api/admin/resenas/{$this->mala->id}/descartar-reportes")->assertOk();

    Sanctum::actingAs(User::factory()->create());
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'ofensiva'])->assertCreated();

    Sanctum::actingAs($this->admin);
    expect($this->getJson('/api/admin/resenas')->json('resenas.0.reportes'))
        ->toBe([['motivo' => 'Ofensiva o irrespetuosa', 'cantidad' => 1]]);
});

test('solo el admin ve y modera las reseñas', function () {
    Sanctum::actingAs($this->dueno);

    $this->getJson('/api/admin/resenas')->assertForbidden();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/ocultar", ['motivo' => 'Me cae mal'])->assertForbidden();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/restaurar", ['motivo' => 'x'])->assertForbidden();
    $this->putJson("/api/admin/resenas/{$this->mala->id}/descartar-reportes")->assertForbidden();

    expect($this->mala->fresh()->oculta_at)->toBeNull();
});

// --- Respuesta del negocio ---

test('el propietario responde y la respuesta se ve bajo la reseña', function () {
    Sanctum::actingAs($this->dueno);

    $item = fn () => collect(moderarPublicas($this->negocio)->json('resenas'))->firstWhere('id', $this->mala->id);
    expect($item()['puede_responder'])->toBeTrue()->and($item()['respuesta'])->toBeNull();

    $this->postJson("/api/resenas/{$this->mala->id}/respuesta", ['respuesta' => '  Lo sentimos mucho  '])
        ->assertCreated()
        ->assertJsonPath('respuesta.texto', 'Lo sentimos mucho');

    expect($item()['puede_responder'])->toBeFalse()->and($item()['respuesta']['texto'])->toBe('Lo sentimos mucho');

    Sanctum::actingAs($this->beto);
    expect($item()['respuesta']['texto'])->toBe('Lo sentimos mucho')->and($item()['puede_responder'])->toBeFalse();
});

test('solo se responde una vez', function () {
    Sanctum::actingAs($this->dueno);

    $this->postJson("/api/resenas/{$this->mala->id}/respuesta", ['respuesta' => 'Primera'])->assertCreated();
    $this->postJson("/api/resenas/{$this->mala->id}/respuesta", ['respuesta' => 'Segunda'])->assertConflict();

    expect($this->mala->fresh()->respuesta)->toBe('Primera');
});

test('un cliente, otra tienda o un trabajador no pueden responder', function () {
    $otraTienda = User::factory()->create();
    $otraTienda->negocio()->create(['nombre' => 'Otra', 'activo' => true]);
    $trabajador = User::factory()->create();
    $this->negocio->miembros()->attach($trabajador->id, ['rol' => 'trabajador']);

    foreach ([$this->ana, $otraTienda, $trabajador] as $usuario) {
        Sanctum::actingAs($usuario);
        $this->postJson("/api/resenas/{$this->mala->id}/respuesta", ['respuesta' => 'Hola'])->assertForbidden();
        expect(collect(moderarPublicas($this->negocio)->json('resenas'))->firstWhere('id', $this->mala->id)['puede_responder'])->toBeFalse();
    }

    expect($this->mala->fresh()->respuesta)->toBeNull();
});

test('la respuesta no va vacía ni pasa de 500 caracteres, y una reseña oculta no se responde', function () {
    Sanctum::actingAs($this->dueno);

    $this->postJson("/api/resenas/{$this->mala->id}/respuesta", ['respuesta' => '   '])->assertUnprocessable();
    $this->postJson("/api/resenas/{$this->mala->id}/respuesta", ['respuesta' => str_repeat('x', 501)])->assertUnprocessable();

    $this->mala->forceFill(['oculta_at' => now()])->save();
    $this->postJson("/api/resenas/{$this->mala->id}/respuesta", ['respuesta' => 'Hola'])->assertNotFound();
});

test('el propietario también responde las reseñas de sus productos', function () {
    $delProducto = moderarResena($this->negocio, $this->ana, 4, 'Rico', $this->producto);
    Sanctum::actingAs($this->dueno);

    $this->postJson("/api/resenas/{$delProducto->id}/respuesta", ['respuesta' => 'Gracias'])->assertCreated();

    expect(moderarPublicas($this->negocio, $this->producto->id)->json('resenas.0.respuesta.texto'))->toBe('Gracias');
});

test('si el autor elimina su cuenta, un reporte pendiente sigue llegando al admin sin el comentario', function () {
    Sanctum::actingAs($this->beto);
    $this->postJson("/api/resenas/{$this->mala->id}/reporte", ['motivo' => 'ofensiva'])->assertCreated();

    EliminarCuenta::ejecutar($this->ana);

    Sanctum::actingAs($this->admin);
    expect($this->getJson('/api/admin/resenas')->assertOk()->json('resenas.0.comentario'))->toBeNull();
});
