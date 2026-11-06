<?php

use App\Models\Calificacion;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Resena;
use App\Models\User;
use App\Support\EliminarCuenta;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('usuario', 'web');

    $this->cliente = User::factory()->create(['name' => 'Ana María', 'apellidos' => 'Pérez Gómez']);
    $this->negocio = User::factory()->create()->negocio()->create(['nombre' => 'La Espiga', 'activo' => true]);
    $this->producto = resenaProducto($this->negocio, 'Pan');
    $this->otro = resenaProducto($this->negocio, 'Café');
    $this->pedido = resenaPedido($this->negocio, $this->cliente, [$this->producto, $this->otro]);

    Sanctum::actingAs($this->cliente);
});

function resenaProducto(Negocio $negocio, string $nombre): Producto
{
    return $negocio->productos()->create(['nombre' => $nombre, 'precio' => 5000]);
}

/** @param  Producto[]  $productos */
function resenaPedido(Negocio $negocio, User $cliente, array $productos, array $extra = []): Pedido
{
    $pedido = $negocio->pedidos()->create(array_merge([
        'user_id' => $cliente->id,
        'estado' => 'entregado',
        'metodo_pago' => 'efectivo',
        'total' => 12000,
        'direccion_entrega' => 'Calle 1 #2-3',
        'telefono_contacto' => '3001234567',
        'entregado_at' => now(),
    ], $extra));

    foreach ($productos as $p) {
        $pedido->items()->create(['producto_id' => $p->id, 'nombre' => $p->nombre, 'precio' => $p->precio, 'cantidad' => 1]);
    }

    return $pedido;
}

test('el cliente reseña la tienda y un producto, y el promedio queda visible en el catálogo', function () {
    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", [
        'tienda' => ['estrellas' => 4, 'comentario' => '  Muy buena atención  '],
        'productos' => [['producto_id' => $this->producto->id, 'estrellas' => 5]],
    ])->assertCreated();

    $this->assertDatabaseHas('resenas', [
        'pedido_id' => $this->pedido->id, 'producto_id' => null, 'estrellas' => 4, 'comentario' => 'Muy buena atención',
    ]);

    $catalogo = $this->getJson("/api/negocios/{$this->negocio->id}")->assertOk();
    $catalogo->assertJsonPath('negocio.resenas', ['promedio' => 4, 'total' => 1]);
    expect(collect($catalogo->json('productos'))->firstWhere('id', $this->producto->id)['resenas'])
        ->toBe(['promedio' => 5, 'total' => 1]);
    expect(collect($catalogo->json('productos'))->firstWhere('id', $this->otro->id)['resenas'])
        ->toBe(['promedio' => null, 'total' => 0]);

    $this->getJson('/api/negocios')->assertJsonPath('negocios.0.resenas.total', 1);
});

test('se puede reseñar por partes y corregir sin duplicar la reseña', function () {
    $url = "/api/pedidos/{$this->pedido->id}/resenas";

    $this->postJson($url, ['tienda' => ['estrellas' => 2]])->assertCreated();
    $this->postJson($url, ['tienda' => ['estrellas' => 5, 'comentario' => 'Cambié de opinión']])->assertCreated();
    $this->postJson($url, ['productos' => [['producto_id' => $this->otro->id, 'estrellas' => 3]]])->assertCreated();

    expect(Resena::count())->toBe(2);
    expect($this->negocio->fresh()->resenas_total)->toBe(1);
    expect((float) $this->negocio->fresh()->resenas_promedio)->toBe(5.0);
});

test('el promedio junta las reseñas de varios pedidos con un decimal', function () {
    $otroCliente = User::factory()->create();
    $segundo = resenaPedido($this->negocio, $otroCliente, [$this->producto]);
    $tercero = resenaPedido($this->negocio, $this->cliente, [$this->producto]);

    foreach ([[$this->pedido, $this->cliente, 5], [$segundo, $otroCliente, 4], [$tercero, $this->cliente, 4]] as [$pedido, $quien, $n]) {
        Sanctum::actingAs($quien);
        $this->postJson("/api/pedidos/{$pedido->id}/resenas", [
            'productos' => [['producto_id' => $this->producto->id, 'estrellas' => $n]],
        ])->assertCreated();
    }

    expect((float) $this->producto->fresh()->resenas_promedio)->toBe(4.3);
    expect($this->producto->fresh()->resenas_total)->toBe(3);
});

test('reseñar no toca el nivel de confiabilidad', function () {
    $antes = $this->negocio->fresh()->reputacion;

    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", ['tienda' => ['estrellas' => 1]])->assertCreated();

    expect($this->negocio->fresh()->reputacion)->toBe($antes);
    $this->assertDatabaseCount('reputacion_eventos', 0);
});

test('un producto repetido en el pedido se reseña una sola vez', function () {
    $this->pedido->items()->create([
        'producto_id' => $this->producto->id, 'nombre' => 'Pan', 'precio' => 5000, 'cantidad' => 2,
    ]);

    $ids = collect($this->getJson("/api/pedidos/{$this->pedido->id}")->json('resenas.productos'))->pluck('producto_id');

    expect($ids->sort()->values()->all())->toBe([$this->producto->id, $this->otro->id]);
});

test('solo se reseña lo que está en el pedido', function () {
    $ajeno = resenaProducto($this->negocio, 'Torta');

    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", [
        'productos' => [['producto_id' => $ajeno->id, 'estrellas' => 5]],
    ])->assertUnprocessable();

    expect(Resena::count())->toBe(0);
});

test('hay que reseñar algo y las estrellas van de 1 a 5', function () {
    $url = "/api/pedidos/{$this->pedido->id}/resenas";

    $this->postJson($url, [])->assertUnprocessable();
    $this->postJson($url, ['tienda' => ['estrellas' => 6]])->assertUnprocessable();
    $this->postJson($url, ['tienda' => ['comentario' => 'Sin estrellas']])->assertUnprocessable();
    $this->postJson($url, ['productos' => [['producto_id' => $this->producto->id, 'estrellas' => 0]]])->assertUnprocessable();
});

test('no se reseña un pedido ajeno', function () {
    Sanctum::actingAs(User::factory()->create());

    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", ['tienda' => ['estrellas' => 1]])->assertNotFound();
});

test('solo se reseña un pedido entregado y dentro del plazo', function (array $extra, int $status) {
    $pedido = resenaPedido($this->negocio, $this->cliente, [$this->producto], $extra);

    $this->postJson("/api/pedidos/{$pedido->id}/resenas", ['tienda' => ['estrellas' => 5]])->assertStatus($status);
})->with([
    'en camino' => [['estado' => 'en_camino', 'entregado_at' => null], 409],
    'cancelado' => [['estado' => 'cancelado', 'entregado_at' => null], 409],
    'día 30' => [fn () => ['entregado_at' => now()->subDays(29)], 201],
    'día 31' => [fn () => ['entregado_at' => now()->subDays(31)], 409],
]);

test('si el cliente reportó que nunca le llegó, no puede reseñarlo', function () {
    Calificacion::create([
        'pedido_id' => $this->pedido->id,
        'user_id' => $this->cliente->id,
        'negocio_ok' => true,
        'domiciliario_problemas' => ['no_llego'],
    ]);

    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", ['tienda' => ['estrellas' => 5]])->assertStatus(409);
    $this->getJson("/api/pedidos/{$this->pedido->id}")
        ->assertJsonPath('puede_resenar', false)
        ->assertJsonPath('resenas', null);
});

test('el seguimiento trae lo reseñado y lo que falta, y Mis pedidos avisa solo si no ha reseñado nada', function () {
    $this->getJson('/api/pedidos')->assertJsonPath('pedidos.0.por_resenar', true);

    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", [
        'productos' => [['producto_id' => $this->producto->id, 'estrellas' => 5, 'comentario' => 'Rico']],
    ])->assertCreated();

    $this->getJson('/api/pedidos')->assertJsonPath('pedidos.0.por_resenar', false);

    $resp = $this->getJson("/api/pedidos/{$this->pedido->id}")
        ->assertJsonPath('puede_resenar', true)
        ->assertJsonPath('resenas.tienda', null);
    $productos = collect($resp->json('resenas.productos'));
    expect($productos->firstWhere('producto_id', $this->producto->id))
        ->toMatchArray(['nombre' => 'Pan', 'estrellas' => 5, 'comentario' => 'Rico']);
    expect($productos->firstWhere('producto_id', $this->otro->id)['estrellas'])->toBeNull();
});

test('vencido el plazo se sigue viendo lo reseñado, sin lo que quedó pendiente', function () {
    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", [
        'productos' => [['producto_id' => $this->producto->id, 'estrellas' => 5]],
    ])->assertCreated();

    $this->pedido->forceFill(['entregado_at' => now()->subDays(40)])->save();

    $resp = $this->getJson("/api/pedidos/{$this->pedido->id}")->assertJsonPath('puede_resenar', false);
    expect(collect($resp->json('resenas.productos'))->pluck('producto_id')->all())->toBe([$this->producto->id]);
});

test('un producto borrado del catálogo ya no se puede reseñar', function () {
    $this->producto->delete();

    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", [
        'productos' => [['producto_id' => $this->producto->id, 'estrellas' => 5]],
    ])->assertUnprocessable();
});

test('la lista separa las reseñas de la tienda y las de cada producto y protege el nombre', function () {
    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", [
        'tienda' => ['estrellas' => 5, 'comentario' => 'Excelente'],
        'productos' => [['producto_id' => $this->producto->id, 'estrellas' => 2, 'comentario' => 'Duro']],
    ])->assertCreated();

    $tienda = $this->getJson("/api/negocios/{$this->negocio->id}/resenas")->assertOk();
    $tienda->assertJsonCount(1, 'resenas')
        ->assertJsonPath('resenas.0.comentario', 'Excelente')
        ->assertJsonPath('resenas.0.autor', 'Ana M.')
        ->assertJsonPath('resumen.promedio', 5)
        ->assertJsonPath('resumen.total', 1)
        ->assertJsonPath('resumen.distribucion.0', ['estrellas' => 5, 'cantidad' => 1]);
    expect(json_encode($tienda->json()))->not->toContain('Gómez');

    $this->getJson("/api/negocios/{$this->negocio->id}/resenas?producto_id={$this->producto->id}")
        ->assertJsonCount(1, 'resenas')
        ->assertJsonPath('resenas.0.comentario', 'Duro')
        ->assertJsonPath('resumen.distribucion.3', ['estrellas' => 2, 'cantidad' => 1]);
});

test('las reseñas se paginan de la más reciente a la más antigua', function () {
    foreach (range(1, 21) as $n) {
        $pedido = resenaPedido($this->negocio, $this->cliente, [$this->producto]);
        Resena::create([
            'pedido_id' => $pedido->id, 'user_id' => $this->cliente->id, 'negocio_id' => $this->negocio->id,
            'objeto' => 'tienda', 'estrellas' => 4, 'comentario' => "Reseña {$n}",
        ]);
    }

    $this->getJson("/api/negocios/{$this->negocio->id}/resenas")
        ->assertJsonCount(20, 'resenas')
        ->assertJsonPath('resenas.0.comentario', 'Reseña 21')
        ->assertJsonPath('ultima_pagina', 2);
    $this->getJson("/api/negocios/{$this->negocio->id}/resenas?page=2")->assertJsonCount(1, 'resenas');
});

test('las reseñas de un negocio vetado no se muestran', function () {
    $this->negocio->forceFill(['vetado_at' => now()])->save();

    $this->getJson("/api/negocios/{$this->negocio->id}/resenas")->assertNotFound();
});

test('al eliminar la cuenta se borra lo que escribió y las estrellas siguen contando', function () {
    $this->postJson("/api/pedidos/{$this->pedido->id}/resenas", [
        'tienda' => ['estrellas' => 4, 'comentario' => 'Me llamo Ana y vivo aquí'],
    ])->assertCreated();

    EliminarCuenta::ejecutar($this->cliente);

    expect($this->negocio->fresh()->resenas_total)->toBe(1);
    $this->getJson("/api/negocios/{$this->negocio->id}/resenas")
        ->assertJsonPath('resenas.0.comentario', null)
        ->assertJsonPath('resenas.0.autor', 'Cliente de Vitrina')
        ->assertJsonPath('resenas.0.estrellas', 4);
});
