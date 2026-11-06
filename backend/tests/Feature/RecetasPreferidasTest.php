<?php

use App\Models\Negocio;
use App\Models\Producto;
use App\Models\TipoProducto;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Un plato pedido más de una vez con los mismos ajustes se vuelve receta
// preferida del cliente, y se le recomienda solo a él y solo en esa tienda.

beforeEach(function () {
    Role::findOrCreate('usuario', 'web');

    $this->cliente = User::factory()->create();
    $this->cliente->assignRole('usuario');
    Sanctum::actingAs($this->cliente);

    $this->negocio = nuevoNegocio();
    $this->hamburguesa = platoDe($this->negocio);
});

function nuevoNegocio(): Negocio
{
    return User::factory()->create()->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
}

function platoDe(Negocio $negocio, array $cambios = []): Producto
{
    return $negocio->productos()->create([
        'nombre' => 'Hamburguesa',
        'precio' => 15000,
        'tipo_producto_id' => TipoProducto::where('slug', TipoProducto::SLUG_COMIDA)->value('id'),
        'atributos' => ['Pan', 'Carne', 'Lechuga', 'Tomate', 'Queso'],
        ...$cambios,
    ]);
}

/** Pedido del cliente con una línea por cada `[producto, opciones]`. */
function pedidoDe(User $cliente, Negocio $negocio, array $lineas, string $estado = 'entregado'): void
{
    $pedido = $negocio->pedidos()->create([
        'user_id' => $cliente->id,
        'estado' => $estado,
        'metodo_pago' => 'efectivo',
        'subtotal' => 15000,
        'total' => 15000,
        'direccion_entrega' => 'Calle 1',
        'telefono_contacto' => '3001234567',
    ]);

    foreach ($lineas as [$producto, $opciones]) {
        $pedido->items()->create([
            'producto_id' => $producto->id,
            'nombre' => $producto->nombre,
            'precio' => $producto->precio,
            'cantidad' => 1,
            'opciones' => $opciones,
        ]);
    }
}

function recetasEn(Negocio $negocio)
{
    return test()->getJson("/api/negocios/{$negocio->id}/recetas-preferidas")->assertOk();
}

test('pedir dos veces el plato con los mismos ajustes lo vuelve receta preferida', function () {
    $ajustes = ['sin' => ['Lechuga'], 'extra' => ['Queso']];
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, $ajustes]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, $ajustes]]);

    recetasEn($this->negocio)
        ->assertJsonCount(1, 'recetas')
        ->assertJsonPath('recetas.0.producto.id', $this->hamburguesa->id)
        ->assertJsonPath('recetas.0.producto.tipo_producto.slug', 'comida')
        ->assertJsonPath('recetas.0.opciones', $ajustes)
        ->assertJsonPath('recetas.0.veces', 2);
});

test('una sola vez no es receta preferida', function () {
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
});

test('dos líneas iguales en el mismo pedido cuentan una vez', function () {
    $sinTomate = ['sin' => ['Tomate']];
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, $sinTomate], [$this->hamburguesa, $sinTomate]]);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
});

test('el orden en que marcó los ingredientes no cambia la receta', function () {
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate', 'Lechuga']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Lechuga', 'Tomate']]]]);

    recetasEn($this->negocio)
        ->assertJsonCount(1, 'recetas')
        ->assertJsonPath('recetas.0.opciones.sin', ['Lechuga', 'Tomate']);
});

test('ajustes distintos del mismo plato no se suman', function () {
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Lechuga']]]]);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
});

test('el plato tal como viene no es una receta', function () {
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, null]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, null]]);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
});

test('solo cuentan los pedidos entregados', function (string $estado) {
    $sinTomate = ['sin' => ['Tomate']];
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, $sinTomate]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, $sinTomate]], $estado);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
})->with(['cancelado', 'pendiente']);

test('las recetas de otro cliente no se ven', function () {
    $otro = User::factory()->create();
    pedidoDe($otro, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);
    pedidoDe($otro, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
});

test('la receta de una tienda no se recomienda en otra', function () {
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);

    recetasEn(nuevoNegocio())->assertJsonCount(0, 'recetas');
});

test('un plato que ya no se vende no se recomienda', function (string $como) {
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);

    $como === 'agotado' ? $this->hamburguesa->update(['disponible' => false]) : $this->hamburguesa->delete();

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
})->with(['agotado', 'eliminado']);

test('un ingrediente que el negocio quitó deja de contar', function () {
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate'], 'extra' => ['Queso']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate'], 'extra' => ['Queso']]]]);

    $this->hamburguesa->update(['atributos' => ['Pan', 'Carne', 'Queso']]);

    recetasEn($this->negocio)->assertJsonPath('recetas.0.opciones', ['extra' => ['Queso']]);

    $this->hamburguesa->update(['atributos' => ['Pan', 'Carne']]);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
});

test('la ropa con la misma talla no es una receta', function () {
    $camisa = $this->negocio->productos()->create([
        'nombre' => 'Camisa',
        'precio' => 40000,
        'tipo_producto_id' => TipoProducto::where('slug', TipoProducto::SLUG_ROPA)->value('id'),
        'atributos' => ['S', 'M'],
        'colores' => ['Negro'],
    ]);
    pedidoDe($this->cliente, $this->negocio, [[$camisa, ['talla' => 'M', 'color' => 'Negro']]]);
    pedidoDe($this->cliente, $this->negocio, [[$camisa, ['talla' => 'M', 'color' => 'Negro']]]);

    recetasEn($this->negocio)->assertJsonCount(0, 'recetas');
});

test('primero va la receta que más ha pedido', function () {
    $pizza = platoDe($this->negocio, ['nombre' => 'Pizza']);

    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$this->hamburguesa, ['sin' => ['Tomate']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$pizza, ['extra' => ['Queso']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$pizza, ['extra' => ['Queso']]]]);
    pedidoDe($this->cliente, $this->negocio, [[$pizza, ['extra' => ['Queso']]]]);

    recetasEn($this->negocio)
        ->assertJsonPath('recetas.0.producto.nombre', 'Pizza')
        ->assertJsonPath('recetas.0.veces', 3)
        ->assertJsonPath('recetas.1.producto.nombre', 'Hamburguesa');
});

test('una tienda vetada no da recetas', function () {
    $this->negocio->forceFill(['vetado_at' => now()])->save();

    $this->getJson("/api/negocios/{$this->negocio->id}/recetas-preferidas")->assertNotFound();
});
