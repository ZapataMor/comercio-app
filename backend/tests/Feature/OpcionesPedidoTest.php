<?php

use App\Models\Negocio;
use App\Models\Producto;
use App\Models\TipoProducto;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Opciones por tipo de producto: la ropa se pide con talla y color, y a la
// comida se le quitan ingredientes o se piden más, solo de los que trae.

beforeEach(function () {
    Role::findOrCreate('usuario', 'web');
    Notification::fake();

    $this->dueno = User::factory()->create();
    $this->dueno->assignRole('usuario');
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);

    $this->hamburguesa = $this->negocio->productos()->create([
        'nombre' => 'Hamburguesa', 'precio' => 15000,
        'tipo_producto_id' => TipoProducto::where('slug', TipoProducto::SLUG_COMIDA)->value('id'),
        'atributos' => ['Pan', 'Carne', 'Lechuga', 'Tomate', 'Queso'],
    ]);
    $this->camisa = $this->negocio->productos()->create([
        'nombre' => 'Camisa', 'precio' => 40000,
        'tipo_producto_id' => TipoProducto::where('slug', TipoProducto::SLUG_ROPA)->value('id'),
        'atributos' => ['S', 'M'],
        'colores' => ['Negro', 'Blanco'],
    ]);
});

function pedir(Negocio $negocio, array ...$items)
{
    $cliente = User::factory()->create();
    $cliente->assignRole('usuario');
    Sanctum::actingAs($cliente);

    return test()->postJson('/api/pedidos', [
        'negocio_id' => $negocio->id,
        'items' => $items,
        'metodo_pago' => 'efectivo',
        'direccion_entrega' => 'Calle 1',
        'telefono_contacto' => '3001234567',
    ]);
}

test('la comida se pide sin ingredientes o con más de los que trae', function () {
    pedir($this->negocio, [
        'producto_id' => $this->hamburguesa->id,
        'cantidad' => 1,
        'sin' => ['Lechuga', 'Tomate'],
        'extra' => ['Queso'],
    ])->assertCreated();

    $item = $this->negocio->pedidos()->first()->items()->first();

    expect($item->opciones)->toBe(['sin' => ['Lechuga', 'Tomate'], 'extra' => ['Queso']]);
    expect($item->detalle())->toBe('Sin lechuga, tomate · Extra queso');
});

test('solo se aceptan ingredientes que vienen incluidos en el producto', function () {
    pedir($this->negocio, [
        'producto_id' => $this->hamburguesa->id,
        'cantidad' => 1,
        'sin' => ['Cebolla', 'Lechuga'],
        'extra' => ['Tocineta', 'Lechuga'],
    ])->assertCreated();

    $item = $this->negocio->pedidos()->first()->items()->first();

    // Cebolla y tocineta no vienen en la hamburguesa, y lechuga no puede ser las dos cosas.
    expect($item->opciones)->toBe(['sin' => ['Lechuga']]);
});

test('el mismo producto puede ir en dos líneas con opciones distintas', function () {
    pedir(
        $this->negocio,
        ['producto_id' => $this->hamburguesa->id, 'cantidad' => 1, 'sin' => ['Tomate']],
        ['producto_id' => $this->hamburguesa->id, 'cantidad' => 2],
    )->assertCreated();

    $pedido = $this->negocio->pedidos()->first();

    expect($pedido->items)->toHaveCount(2);
    expect($pedido->items[0]->detalle())->toBe('Sin tomate');
    expect($pedido->items[1]->detalle())->toBeNull();
    expect((float) $pedido->subtotal)->toBe(45000.0);
});

test('la ropa se pide con una talla y un color disponibles', function () {
    pedir($this->negocio, [
        'producto_id' => $this->camisa->id, 'cantidad' => 1, 'talla' => 'M', 'color' => 'Negro',
    ])->assertCreated();

    $item = $this->negocio->pedidos()->first()->items()->first();

    expect($item->detalle())->toBe('Talla M · Negro');
});

test('la ropa no se puede pedir sin elegir talla o color', function () {
    pedir($this->negocio, ['producto_id' => $this->camisa->id, 'cantidad' => 1, 'color' => 'Negro'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Falta elegir la talla de "Camisa". Quítalo del carrito y agrégalo de nuevo desde el catálogo.');

    pedir($this->negocio, ['producto_id' => $this->camisa->id, 'cantidad' => 1, 'talla' => 'M'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Falta elegir el color de "Camisa". Quítalo del carrito y agrégalo de nuevo desde el catálogo.');
});

test('la ropa no se puede pedir en una talla que ya no está disponible', function () {
    pedir($this->negocio, [
        'producto_id' => $this->camisa->id, 'cantidad' => 1, 'talla' => 'XL', 'color' => 'Negro',
    ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'La talla XL de "Camisa" ya no está disponible. Elige otra opción en tu carrito.');

    expect($this->negocio->pedidos()->count())->toBe(0);
});

test('la ropa que no maneja tallas ni colores se pide sin elegir nada', function () {
    $this->camisa->update(['atributos' => [], 'colores' => []]);

    pedir($this->negocio, ['producto_id' => $this->camisa->id, 'cantidad' => 1])->assertCreated();

    expect($this->negocio->pedidos()->first()->items()->first()->opciones)->toBeNull();
});

test('los demás tipos de producto ignoran las opciones', function () {
    $pastilla = $this->negocio->productos()->create([
        'nombre' => 'Acetaminofén', 'precio' => 2000,
        'tipo_producto_id' => TipoProducto::where('slug', 'medicamento')->value('id'),
        'atributos' => ['Dolor de cabeza'],
    ]);

    pedir($this->negocio, [
        'producto_id' => $pastilla->id, 'cantidad' => 1, 'talla' => 'M', 'sin' => ['Dolor de cabeza'],
    ])->assertCreated();

    expect($this->negocio->pedidos()->first()->items()->first()->opciones)->toBeNull();
});

test('el negocio y el cliente ven lo que se pidió en cada línea', function () {
    $id = pedir($this->negocio, [
        'producto_id' => $this->hamburguesa->id, 'cantidad' => 1, 'sin' => ['Tomate'],
    ])->json('id');

    test()->getJson("/api/pedidos/{$id}")
        ->assertJsonPath('items.0.detalle', 'Sin tomate');

    Sanctum::actingAs($this->dueno);
    test()->getJson("/api/negocios/{$this->negocio->id}/pedidos/{$id}")
        ->assertJsonPath('items.0.detalle', 'Sin tomate');
});

test('el catálogo trae el tipo, las tallas y los colores de cada producto', function () {
    Sanctum::actingAs($this->dueno);

    $productos = collect(test()->getJson("/api/negocios/{$this->negocio->id}")->json('productos'));
    $camisa = $productos->firstWhere('nombre', 'Camisa');

    expect($camisa['tipo_producto']['slug'])->toBe('ropa-y-calzado');
    expect($camisa['atributos'])->toBe(['S', 'M']);
    expect($camisa['colores'])->toBe(['Negro', 'Blanco']);
});

test('el comerciante guarda los colores limpios, sin vacíos ni repetidos', function () {
    Sanctum::actingAs($this->dueno);

    test()->putJson("/api/negocios/{$this->negocio->id}/productos/{$this->camisa->id}", [
        'colores' => ['Negro', ' Negro ', '', 'Azul'],
    ])
        ->assertOk()
        ->assertJsonPath('producto.colores', ['Negro', 'Azul']);
});

test('el tipo ropa ofrece sugerencias de talla y de color', function () {
    Sanctum::actingAs($this->dueno);

    $ropa = collect(test()->getJson('/api/tipos-producto')->json('tipos_producto'))
        ->firstWhere('slug', TipoProducto::SLUG_ROPA);

    expect($ropa['atributo_label'])->toBe('Tallas disponibles');
    expect($ropa['sugerencias'])->toContain('M', '38');
    expect($ropa['sugerencias_colores'])->toContain('Negro');
});

test('la migración separa las tallas y los colores que estaban mezclados', function () {
    $migracion = require database_path('migrations/2026_11_03_300000_add_opciones_de_producto_y_pedido.php');
    $migracion->down();

    $ropa = TipoProducto::where('slug', TipoProducto::SLUG_ROPA)->value('id');
    $id = DB::table('productos')->insertGetId([
        'negocio_id' => $this->negocio->id,
        'nombre' => 'Tenis',
        'precio' => 90000,
        'tipo_producto_id' => $ropa,
        'atributos' => json_encode(['S', 'xl', '38', 'Talla única', 'Azul marino', 'Negro']),
    ]);

    $migracion->up();

    $producto = Producto::find($id);
    expect($producto->atributos)->toBe(['S', 'xl', '38', 'Talla única']);
    expect($producto->colores)->toBe(['Azul marino', 'Negro']);
});
