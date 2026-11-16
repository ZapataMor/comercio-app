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
        ...direccionPedidoPrueba(null, 'Calle 1 #10-20'),
        'telefono_contacto' => '3001234567',
    ]);
}

test('los productos por peso conservan decimales, unidad y precio proporcional', function ($unidad, $cantidad) {
    $producto = $this->negocio->productos()->create([
        'nombre' => 'Arroz', 'precio' => 10000, 'tipo_venta' => 'peso', 'unidad_medida' => $unidad,
    ]);
    $id = pedir($this->negocio, ['producto_id' => $producto->id, 'cantidad' => $cantidad])->assertCreated()->json('id');
    $item = $this->negocio->pedidos()->findOrFail($id)->items()->first();
    expect($item->cantidad)->toBe((float) $cantidad)
        ->and($item->unidad_medida)->toBe($unidad)
        ->and($item->subtotal())->toBe(round(10000 * $cantidad, 2));
    $this->getJson("/api/pedidos/{$id}")->assertOk()
        ->assertJsonPath('items.0.cantidad', $cantidad)
        ->assertJsonPath('items.0.unidad_medida', $unidad);
})->with([['kg', 0.5], ['kg', 0.001], ['kg', 1.275], ['libra', 0.25]]);

test('no se aceptan fracciones en productos por unidad', function () {
    pedir($this->negocio, ['producto_id' => $this->hamburguesa->id, 'cantidad' => 0.5])
        ->assertUnprocessable()->assertJsonValidationErrors('items');
});

test('el domiciliario recibe la direccion real y el peso pero no el nombre privado', function () {
    Role::findOrCreate('domiciliario', 'web');
    $producto = $this->negocio->productos()->create([
        'nombre' => 'Arroz', 'precio' => 10000, 'tipo_venta' => 'peso', 'unidad_medida' => 'kg',
    ]);
    $id = pedir($this->negocio, ['producto_id' => $producto->id, 'cantidad' => 0.5])->assertCreated()->json('id');
    $pedido = $this->negocio->pedidos()->findOrFail($id);
    $direccion = $pedido->cliente->clienteDirecciones()->create([
        'direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro', 'nombre' => 'Mi-casa-privada',
    ]);
    $this->putJson("/api/cliente/direcciones/{$direccion->id}", [...fotosReferenciaPrueba(), 'lat' => 11.379, 'lng' => -72.24,
        'direccion' => 'Calle 20 #10-20', 'barrio' => 'Centro', 'nombre' => 'Trabajo-privado',
    ])->assertOk();
    $domiciliario = User::factory()->create();
    $domiciliario->assignRole('domiciliario');
    $pedido->update(['estado' => 'tomado', 'domiciliario_id' => $domiciliario->id, 'tomado_at' => now()]);
    Sanctum::actingAs($domiciliario);
    $resp = $this->getJson('/api/domiciliario/entregas')->assertOk()
        ->assertJsonPath('pedidos.0.direccion_entrega', 'Calle 1 #10-20 - Barrio Centro')
        ->assertJsonPath('pedidos.0.items.0.cantidad', 0.5)
        ->assertJsonPath('pedidos.0.items.0.unidad_medida', 'kg');
    expect($resp->getContent())->not->toContain('Mi-casa-privada')->not->toContain('Trabajo-privado');
});

test('el ajuste por faltantes conserva cantidades decimales y recalcula el total', function () {
    $producto = $this->negocio->productos()->create([
        'nombre' => 'Arroz', 'precio' => 10000, 'tipo_venta' => 'peso', 'unidad_medida' => 'kg',
    ]);
    $id = pedir($this->negocio, ['producto_id' => $producto->id, 'cantidad' => 1])->assertCreated()->json('id');
    $pedido = $this->negocio->pedidos()->findOrFail($id);
    $pedido->update(['estado' => 'aceptado', 'faltante_motivo' => 'Queda menos arroz', 'faltante_version' => 'peso-1']);
    $this->putJson("/api/pedidos/{$id}/ajuste", [
        'items' => [['producto_id' => $producto->id, 'cantidad' => 0.375]],
        'total_esperado' => 3750 + (float) $pedido->costo_domicilio, 'faltante_version' => 'peso-1',
    ])->assertOk();
    expect($pedido->fresh()->items->first()->cantidad)->toBe(0.375)
        ->and((float) $pedido->fresh()->subtotal)->toBe(3750.0);
});

test('el peso rechaza cantidades fuera del rango o con precisión excesiva', function ($cantidad) {
    $producto = $this->negocio->productos()->create([
        'nombre' => 'Arroz', 'precio' => 10000, 'tipo_venta' => 'peso', 'unidad_medida' => 'kg',
    ]);
    pedir($this->negocio, ['producto_id' => $producto->id, 'cantidad' => $cantidad])->assertUnprocessable();
})->with([0, -0.5, 0.0001, 0.1234, 100]);

test('la comida se pide sin ingredientes y con extras que suman su precio', function () {
    $this->hamburguesa->update([
        'ingredientes_fijos' => ['Pan', 'Carne'],
        'extras' => [['nombre' => 'Queso', 'precio' => 2500], ['nombre' => 'Salsa', 'precio' => 0]],
    ]);

    pedir($this->negocio, [
        'producto_id' => $this->hamburguesa->id,
        'cantidad' => 2,
        'sin' => ['Lechuga', 'Tomate'],
        'extras' => [['nombre' => 'Queso', 'cantidad' => 2], ['nombre' => 'Salsa', 'cantidad' => 1]],
    ])->assertCreated();

    $pedido = $this->negocio->pedidos()->first();
    $item = $pedido->items()->first();

    expect($item->opciones)->toBe([
        'sin' => ['Lechuga', 'Tomate'],
        'extras' => [
            ['nombre' => 'Queso', 'cantidad' => 2, 'precio' => 2500],
            ['nombre' => 'Salsa', 'cantidad' => 1, 'precio' => 0],
        ],
    ]);
    // Cada hamburguesa: 15.000 + 2 quesos de 2.500.
    expect((float) $item->precio)->toBe(20000.0)
        ->and((float) $pedido->subtotal)->toBe(40000.0)
        ->and($item->detalle())->toBe('Sin lechuga, tomate · Extras: queso x2, salsa');
});

test('no se quitan ingredientes fijos ni se cobran extras que el producto no ofrece', function () {
    $this->hamburguesa->update([
        'ingredientes_fijos' => ['Carne'],
        'extras' => [['nombre' => 'Queso', 'precio' => 2500]],
    ]);

    pedir($this->negocio, [
        'producto_id' => $this->hamburguesa->id,
        'cantidad' => 1,
        'sin' => ['Carne', 'Cebolla', 'Lechuga'],
        // El precio lo pone el producto, no la app.
        'extras' => [['nombre' => 'Tocineta', 'cantidad' => 1], ['nombre' => 'Queso', 'cantidad' => 10, 'precio' => 1]],
        'extra' => ['Lechuga'],
    ])->assertCreated();

    $item = $this->negocio->pedidos()->first()->items()->first();

    // Carne es fija, cebolla no viene en la hamburguesa y `extra` es de la app anterior.
    expect($item->opciones)->toBe([
        'sin' => ['Lechuga'],
        'extras' => [['nombre' => 'Queso', 'cantidad' => 10, 'precio' => 2500]],
    ])->and((float) $item->precio)->toBe(40000.0);
});

test('un extra no pasa del tope de porciones', function () {
    $this->hamburguesa->update(['extras' => [['nombre' => 'Queso', 'precio' => 2500]]]);

    pedir($this->negocio, [
        'producto_id' => $this->hamburguesa->id, 'cantidad' => 1,
        'extras' => [['nombre' => 'Queso', 'cantidad' => 11]],
    ])->assertUnprocessable()->assertJsonValidationErrors('items.0.extras.0.cantidad');
});

test('si un extra subió de precio el pedido espera a que el cliente vea el nuevo total', function () {
    $this->hamburguesa->update(['extras' => [['nombre' => 'Queso', 'precio' => 3000]]]);
    $cliente = User::factory()->create();
    $cliente->assignRole('usuario');
    Sanctum::actingAs($cliente);

    test()->postJson('/api/pedidos', [
        'negocio_id' => $this->negocio->id,
        'items' => [['producto_id' => $this->hamburguesa->id, 'cantidad' => 1, 'extras' => [['nombre' => 'Queso', 'cantidad' => 1]]]],
        'metodo_pago' => 'efectivo',
        ...direccionPedidoPrueba(null, 'Calle 1 #10-20'),
        'telefono_contacto' => '3001234567',
        // Lo que vio el cliente cuando el queso costaba 2.500.
        'total_esperado' => 17500 + App\Models\Ajuste::tarifaDomicilio(),
    ])->assertStatus(409)->assertJsonPath('codigo', 'total_cambio')->assertJsonPath('subtotal', 18000);

    expect($this->negocio->pedidos()->count())->toBe(0);
});

test('el ajuste por faltantes respeta el precio del plato y cobra los extras nuevos', function () {
    $this->hamburguesa->update(['extras' => [['nombre' => 'Queso', 'precio' => 2500], ['nombre' => 'Papas', 'precio' => 3000]]]);
    $id = pedir($this->negocio, [
        'producto_id' => $this->hamburguesa->id, 'cantidad' => 1, 'extras' => [['nombre' => 'Queso', 'cantidad' => 1]],
    ])->assertCreated()->json('id');
    $pedido = $this->negocio->pedidos()->findOrFail($id);
    $pedido->update(['estado' => 'aceptado', 'faltante_motivo' => 'Se acabó el queso', 'faltante_version' => 'v1']);
    // El negocio sube el plato después del pedido: el cliente conserva su precio.
    $this->hamburguesa->update(['precio' => 18000]);

    $this->putJson("/api/pedidos/{$id}/ajuste", [
        'items' => [['producto_id' => $this->hamburguesa->id, 'cantidad' => 1, 'extras' => [['nombre' => 'Papas', 'cantidad' => 2]]]],
        'total_esperado' => 21000 + (float) $pedido->costo_domicilio, 'faltante_version' => 'v1',
    ])->assertOk();

    $item = $pedido->fresh()->items->first();
    expect((float) $item->precio)->toBe(21000.0)
        ->and($item->detalle())->toBe('Extras: papas x2');
});

test('el comerciante guarda ingredientes fijos y extras limpios', function () {
    Sanctum::actingAs($this->dueno);

    test()->putJson("/api/negocios/{$this->negocio->id}/productos/{$this->hamburguesa->id}", [
        'atributos' => ['Pan', 'Carne', 'Tomate'],
        'ingredientes_fijos' => ['Carne', ' Carne ', 'Tocineta'],
        'extras' => [
            ['nombre' => ' Queso ', 'precio' => 2500],
            ['nombre' => 'queso', 'precio' => 1000],
            ['nombre' => '', 'precio' => 500],
            ['nombre' => 'Salsa', 'precio' => 0],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('producto.ingredientes_fijos', ['Carne'])
        ->assertJsonPath('producto.extras', [['nombre' => 'Queso', 'precio' => 2500], ['nombre' => 'Salsa', 'precio' => 0]]);

    test()->putJson("/api/negocios/{$this->negocio->id}/productos/{$this->hamburguesa->id}", [
        'extras' => [['nombre' => 'Queso', 'precio' => -1]],
    ])->assertUnprocessable()->assertJsonValidationErrors('extras.0.precio');
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
