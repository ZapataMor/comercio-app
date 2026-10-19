<?php

use App\Models\Negocio;
use App\Models\TipoProducto;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Antes de cada test: crear los 4 roles (la BD se reinicia en cada test).
beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

/** Crea un usuario con un rol y lo deja autenticado vía Sanctum. */
function actuarComo(string $rol): User
{
    $user = User::factory()->create();
    $user->assignRole($rol);
    Sanctum::actingAs($user);

    return $user;
}

/**
 * Crea un usuario autenticado que YA tiene su negocio (queda como
 * propietario por el hook del modelo). Rol global 'usuario': en el modelo
 * unificado cualquier persona puede tener negocios.
 */
function comercianteConNegocio(): array
{
    $user = actuarComo('usuario');
    $negocio = $user->negocio()->create(['nombre' => 'Tienda Test']);

    return [$user, $negocio];
}

/** URL de la zona de gestión de un negocio. */
function urlNegocio(Negocio $negocio, string $resto = ''): string
{
    return "/api/negocios/{$negocio->id}{$resto}";
}

// ---------------------------------------------------------------------------
// Seguridad / acceso
// ---------------------------------------------------------------------------

test('sin token no se puede entrar a mis negocios', function () {
    $this->getJson('/api/negocios/mios')->assertStatus(401);
});

test('quien no es miembro no puede gestionar un negocio', function () {
    $dueno = User::factory()->create();
    $negocio = $dueno->negocio()->create(['nombre' => 'Ajeno']);

    actuarComo('usuario');

    $this->getJson(urlNegocio($negocio, '/productos'))->assertStatus(403);
    $this->getJson(urlNegocio($negocio, '/categorias'))->assertStatus(403);
    $this->getJson(urlNegocio($negocio, '/pedidos'))->assertStatus(403);
    $this->getJson("/api/negocios/mios/{$negocio->id}")->assertStatus(403);
});

test('un negocio inexistente devuelve 404', function () {
    actuarComo('usuario');

    $this->getJson('/api/negocios/999999/productos')->assertStatus(404);
});

test('un miembro suspendido pierde el acceso', function () {
    [$user, $negocio] = comercianteConNegocio();
    $negocio->miembros()->updateExistingPivot($user->id, ['activo' => false]);

    $this->getJson(urlNegocio($negocio, '/productos'))->assertStatus(403);
});

// ---------------------------------------------------------------------------
// Negocio
// ---------------------------------------------------------------------------

test('cualquier usuario crea un negocio y queda como propietario', function () {
    $user = actuarComo('usuario');

    $this->postJson('/api/negocios', [
        'nombre' => 'Donde Pepe',
        'categorias' => ['Restaurante', 'Comidas rápidas'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('negocio.nombre', 'Donde Pepe')
        ->assertJsonPath('negocio.categoria', 'Restaurante')
        ->assertJsonPath('negocio.categorias.0', 'Restaurante')
        ->assertJsonPath('negocio.categorias.1', 'Comidas rápidas')
        ->assertJsonPath('negocio.activo', true)
        ->assertJsonPath('negocio.rol', Negocio::ROL_PROPIETARIO);

    $this->assertDatabaseHas('negocios', ['nombre' => 'Donde Pepe', 'categoria' => 'Restaurante']);
    $this->assertDatabaseHas('tipos_negocio', ['nombre' => 'Comidas rápidas']);

    $negocio = Negocio::where('nombre', 'Donde Pepe')->firstOrFail();
    expect($negocio->esPropietario($user))->toBeTrue();
});

test('crear un negocio exige la categoría (tipo de negocio)', function () {
    actuarComo('usuario');

    $this->postJson('/api/negocios', ['nombre' => 'Sin Tipo'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('categoria');
});

test('una persona puede tener varios negocios', function () {
    comercianteConNegocio();

    $this->postJson('/api/negocios', ['nombre' => 'Otro', 'categorias' => ['Farmacia']])
        ->assertStatus(201);

    $this->getJson('/api/negocios/mios')
        ->assertOk()
        ->assertJsonCount(2, 'negocios')
        ->assertJsonPath('negocios.0.rol', Negocio::ROL_PROPIETARIO);
});

test('mis negocios incluye mi código público', function () {
    $user = actuarComo('usuario');

    $this->getJson('/api/negocios/mios')
        ->assertOk()
        ->assertJsonPath('codigo_publico', $user->codigo_publico)
        ->assertJsonCount(0, 'negocios');
});

test('el propietario ve y edita su negocio', function () {
    [, $negocio] = comercianteConNegocio();

    $this->getJson("/api/negocios/mios/{$negocio->id}")
        ->assertOk()
        ->assertJsonPath('negocio.nombre', 'Tienda Test')
        ->assertJsonPath('negocio.rol', Negocio::ROL_PROPIETARIO);

    $this->putJson(urlNegocio($negocio), ['activo' => false])
        ->assertOk()
        ->assertJsonPath('negocio.activo', false);
});

test('un trabajador no puede editar los datos del negocio', function () {
    $dueno = User::factory()->create();
    $negocio = $dueno->negocio()->create(['nombre' => 'Con Equipo']);
    $trabajador = actuarComo('usuario');
    $negocio->miembros()->attach($trabajador->id, ['rol' => Negocio::ROL_TRABAJADOR, 'activo' => true]);

    $this->putJson(urlNegocio($negocio), ['nombre' => 'Hackeado'])->assertStatus(403);
    // ...pero sí gestiona el catálogo.
    $this->getJson(urlNegocio($negocio, '/productos'))->assertOk();
});

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

test('un propietario crea un producto en su negocio', function () {
    [, $negocio] = comercianteConNegocio();
    $comida = TipoProducto::where('slug', 'comida')->firstOrFail();

    $this->postJson(urlNegocio($negocio, '/productos'), [
        'nombre' => 'Empanada',
        'precio' => 2500,
        'tipo_producto_id' => $comida->id,
        'atributos' => ['Carne', 'Papa', '  Carne ', ''],
    ])
        ->assertStatus(201)
        ->assertJsonPath('producto.nombre', 'Empanada')
        ->assertJsonPath('producto.precio', 2500)
        ->assertJsonPath('producto.tipo_producto.nombre', 'Comida')
        // Los atributos se limpian: sin vacíos ni duplicados.
        ->assertJsonPath('producto.atributos', ['Carne', 'Papa']);
});

test('crear un producto exige el tipo de producto', function () {
    [, $negocio] = comercianteConNegocio();

    $this->postJson(urlNegocio($negocio, '/productos'), ['nombre' => 'X', 'precio' => 100])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('tipo_producto_id');
});

test('el precio debe ser un entero sin puntos ni comas', function () {
    [, $negocio] = comercianteConNegocio();
    $comida = TipoProducto::where('slug', 'comida')->firstOrFail();

    $this->postJson(urlNegocio($negocio, '/productos'), [
        'nombre' => 'X',
        'precio' => '12.500',
        'tipo_producto_id' => $comida->id,
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('precio');
});

test('los tipos de producto vienen con su configuración de atributos', function () {
    actuarComo('usuario');

    $respuesta = $this->getJson('/api/tipos-producto')->assertOk();

    $tipos = collect($respuesta->json('tipos_producto'));
    expect($tipos->pluck('nombre'))->toContain('Comida', 'Medicamento', 'Otro');

    $medicamento = $tipos->firstWhere('slug', 'medicamento');
    expect($medicamento['atributo_label'])->toBe('¿Para qué sirve?')
        ->and($medicamento['sugerencias'])->toContain('Gripa');

    $comida = $tipos->firstWhere('slug', 'comida');
    expect($comida['atributo_label'])->toBe('Ingredientes')
        ->and($comida['atributo_boton'])->toBe('Añadir ingrediente');
});

test('el precio no puede ser negativo', function () {
    [, $negocio] = comercianteConNegocio();

    $this->postJson(urlNegocio($negocio, '/productos'), ['nombre' => 'X', 'precio' => -5])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('precio');
});

test('el listado de productos viene paginado', function () {
    [, $negocio] = comercianteConNegocio();
    $negocio->productos()->createMany(
        collect(range(1, 20))->map(fn ($i) => ['nombre' => "Prod $i", 'precio' => 1000])->all()
    );

    $this->getJson(urlNegocio($negocio, '/productos'))
        ->assertOk()
        ->assertJsonCount(15, 'data')          // 15 por página por defecto
        ->assertJsonPath('meta.total', 20);
});

test('se puede buscar productos por nombre', function () {
    [, $negocio] = comercianteConNegocio();
    $negocio->productos()->create(['nombre' => 'Jugo de corozo', 'precio' => 3000]);
    $negocio->productos()->create(['nombre' => 'Empanada', 'precio' => 2500]);

    $this->getJson(urlNegocio($negocio, '/productos?buscar=corozo'))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.nombre', 'Jugo de corozo');
});

test('no se puede tocar el producto de otro negocio', function () {
    // Negocio A con su producto.
    $otro = User::factory()->create();
    $negocioOtro = $otro->negocio()->create(['nombre' => 'Tienda Ajena']);
    $productoAjeno = $negocioOtro->productos()->create(['nombre' => 'Secreto', 'precio' => 9999]);

    // Propietario de B autenticado.
    [, $negocio] = comercianteConNegocio();

    // Por su propio negocio: el producto no está ahí.
    $this->getJson(urlNegocio($negocio, "/productos/{$productoAjeno->id}"))->assertStatus(404);
    $this->deleteJson(urlNegocio($negocio, "/productos/{$productoAjeno->id}"))->assertStatus(404);
    // Por el negocio ajeno: no es miembro.
    $this->getJson(urlNegocio($negocioOtro, "/productos/{$productoAjeno->id}"))->assertStatus(403);
});

test('borrar un producto es borrado suave (soft delete)', function () {
    [, $negocio] = comercianteConNegocio();
    $producto = $negocio->productos()->create(['nombre' => 'Temporal', 'precio' => 1000]);

    $this->deleteJson(urlNegocio($negocio, "/productos/{$producto->id}"))->assertOk();

    // Ya no aparece en el listado...
    $this->getJson(urlNegocio($negocio, '/productos'))->assertJsonCount(0, 'data');
    // ...pero sigue en la BD con deleted_at (recuperable, no rompe historial).
    $this->assertSoftDeleted('productos', ['id' => $producto->id]);
});

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

test('un propietario crea una categoría', function () {
    [, $negocio] = comercianteConNegocio();

    $this->postJson(urlNegocio($negocio, '/categorias'), ['nombre' => 'Bebidas'])
        ->assertStatus(201)
        ->assertJsonPath('categoria.nombre', 'Bebidas');
});

test('no se permite una categoría duplicada en el mismo negocio', function () {
    [, $negocio] = comercianteConNegocio();
    $negocio->categorias()->create(['nombre' => 'Bebidas']);

    $this->postJson(urlNegocio($negocio, '/categorias'), ['nombre' => 'Bebidas'])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('nombre');
});

test('no se puede asignar a un producto la categoría de otro negocio', function () {
    // Categoría de otro negocio.
    $otro = User::factory()->create();
    $negocioOtro = $otro->negocio()->create(['nombre' => 'Ajena']);
    $catAjena = $negocioOtro->categorias()->create(['nombre' => 'Ajena']);

    [, $negocio] = comercianteConNegocio();

    $this->postJson(urlNegocio($negocio, '/productos'), [
        'nombre' => 'Producto',
        'precio' => 1000,
        'categoria_id' => $catAjena->id,
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('categoria_id');
});

test('al borrar una categoría sus productos quedan sin categoría', function () {
    [, $negocio] = comercianteConNegocio();
    $categoria = $negocio->categorias()->create(['nombre' => 'Bebidas']);
    $producto = $negocio->productos()->create([
        'nombre' => 'Jugo',
        'precio' => 3000,
        'categoria_id' => $categoria->id,
    ]);

    $this->deleteJson(urlNegocio($negocio, "/categorias/{$categoria->id}"))->assertOk();

    // El producto sigue existiendo, pero sin categoría.
    $this->assertDatabaseHas('productos', [
        'id' => $producto->id,
        'categoria_id' => null,
    ]);
});

test('el listado de categorías incluye el conteo de productos', function () {
    [, $negocio] = comercianteConNegocio();
    $cat = $negocio->categorias()->create(['nombre' => 'Comida']);
    $negocio->productos()->create(['nombre' => 'Arroz con pollo', 'precio' => 12000, 'categoria_id' => $cat->id]);
    $negocio->productos()->create(['nombre' => 'Sancocho', 'precio' => 15000, 'categoria_id' => $cat->id]);

    $this->getJson(urlNegocio($negocio, '/categorias'))
        ->assertOk()
        ->assertJsonPath('data.0.nombre', 'Comida')
        ->assertJsonPath('data.0.productos', 2);
});

test('se pueden listar solo los productos sin categoría', function () {
    [, $negocio] = comercianteConNegocio();
    $cat = $negocio->categorias()->create(['nombre' => 'Comida']);
    $negocio->productos()->create(['nombre' => 'Con categoría', 'precio' => 1000, 'categoria_id' => $cat->id]);
    $negocio->productos()->create(['nombre' => 'Suelto', 'precio' => 1000]);

    $this->getJson(urlNegocio($negocio, '/productos?sin_categoria=1'))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.nombre', 'Suelto');
});
