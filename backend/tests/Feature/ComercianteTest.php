<?php

use App\Models\Negocio;
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

/** Crea un comerciante autenticado que YA tiene su negocio. */
function comercianteConNegocio(): array
{
    $user = actuarComo('comerciante');
    $negocio = $user->negocio()->create(['nombre' => 'Tienda Test']);

    return [$user, $negocio];
}

// ---------------------------------------------------------------------------
// Seguridad / acceso
// ---------------------------------------------------------------------------

test('sin token no se puede entrar a la zona comerciante', function () {
    $this->getJson('/api/comerciante/negocio')->assertStatus(401);
});

test('un usuario cliente no puede entrar a la zona comerciante', function () {
    actuarComo('usuario');

    $this->getJson('/api/comerciante/negocio')->assertStatus(403);
});

// ---------------------------------------------------------------------------
// Negocio
// ---------------------------------------------------------------------------

test('un comerciante crea su negocio', function () {
    actuarComo('comerciante');

    $this->postJson('/api/comerciante/negocio', ['nombre' => 'Donde Pepe'])
        ->assertStatus(201)
        ->assertJsonPath('negocio.nombre', 'Donde Pepe')
        ->assertJsonPath('negocio.activo', true);

    $this->assertDatabaseHas('negocios', ['nombre' => 'Donde Pepe']);
});

test('un comerciante no puede tener dos negocios', function () {
    comercianteConNegocio();

    $this->postJson('/api/comerciante/negocio', ['nombre' => 'Otro'])
        ->assertStatus(409);
});

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

test('crear producto sin tener negocio devuelve 409', function () {
    actuarComo('comerciante');

    $this->postJson('/api/comerciante/productos', ['nombre' => 'X', 'precio' => 100])
        ->assertStatus(409);
});

test('un comerciante crea un producto en su negocio', function () {
    comercianteConNegocio();

    $this->postJson('/api/comerciante/productos', [
        'nombre' => 'Empanada',
        'precio' => 2500,
    ])
        ->assertStatus(201)
        ->assertJsonPath('producto.nombre', 'Empanada')
        ->assertJsonPath('producto.precio', 2500);
});

test('el precio no puede ser negativo', function () {
    comercianteConNegocio();

    $this->postJson('/api/comerciante/productos', ['nombre' => 'X', 'precio' => -5])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('precio');
});

test('el listado de productos viene paginado', function () {
    [$user, $negocio] = comercianteConNegocio();
    $negocio->productos()->createMany(
        collect(range(1, 20))->map(fn ($i) => ['nombre' => "Prod $i", 'precio' => 1000])->all()
    );

    $this->getJson('/api/comerciante/productos')
        ->assertOk()
        ->assertJsonCount(15, 'data')          // 15 por página por defecto
        ->assertJsonPath('meta.total', 20);
});

test('se puede buscar productos por nombre', function () {
    [$user, $negocio] = comercianteConNegocio();
    $negocio->productos()->create(['nombre' => 'Jugo de corozo', 'precio' => 3000]);
    $negocio->productos()->create(['nombre' => 'Empanada', 'precio' => 2500]);

    $this->getJson('/api/comerciante/productos?buscar=corozo')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.nombre', 'Jugo de corozo');
});

test('un comerciante no puede ver el producto de otro comerciante', function () {
    // Comerciante A con su producto.
    $otro = User::factory()->create();
    $otro->assignRole('comerciante');
    $negocioOtro = $otro->negocio()->create(['nombre' => 'Tienda Ajena']);
    $productoAjeno = $negocioOtro->productos()->create(['nombre' => 'Secreto', 'precio' => 9999]);

    // Comerciante B autenticado.
    comercianteConNegocio();

    $this->getJson("/api/comerciante/productos/{$productoAjeno->id}")->assertStatus(404);
    $this->deleteJson("/api/comerciante/productos/{$productoAjeno->id}")->assertStatus(404);
});

test('borrar un producto es borrado suave (soft delete)', function () {
    [$user, $negocio] = comercianteConNegocio();
    $producto = $negocio->productos()->create(['nombre' => 'Temporal', 'precio' => 1000]);

    $this->deleteJson("/api/comerciante/productos/{$producto->id}")->assertOk();

    // Ya no aparece en el listado...
    $this->getJson('/api/comerciante/productos')->assertJsonCount(0, 'data');
    // ...pero sigue en la BD con deleted_at (recuperable, no rompe historial).
    $this->assertSoftDeleted('productos', ['id' => $producto->id]);
});

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

test('un comerciante crea una categoría', function () {
    comercianteConNegocio();

    $this->postJson('/api/comerciante/categorias', ['nombre' => 'Bebidas'])
        ->assertStatus(201)
        ->assertJsonPath('categoria.nombre', 'Bebidas');
});

test('no se permite una categoría duplicada en el mismo negocio', function () {
    [$user, $negocio] = comercianteConNegocio();
    $negocio->categorias()->create(['nombre' => 'Bebidas']);

    $this->postJson('/api/comerciante/categorias', ['nombre' => 'Bebidas'])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('nombre');
});

test('no se puede asignar a un producto la categoría de otro negocio', function () {
    // Categoría de otro comerciante.
    $otro = User::factory()->create();
    $otro->assignRole('comerciante');
    $negocioOtro = $otro->negocio()->create(['nombre' => 'Ajena']);
    $catAjena = $negocioOtro->categorias()->create(['nombre' => 'Ajena']);

    comercianteConNegocio();

    $this->postJson('/api/comerciante/productos', [
        'nombre' => 'Producto',
        'precio' => 1000,
        'categoria_id' => $catAjena->id,
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('categoria_id');
});

test('al borrar una categoría sus productos quedan sin categoría', function () {
    [$user, $negocio] = comercianteConNegocio();
    $categoria = $negocio->categorias()->create(['nombre' => 'Bebidas']);
    $producto = $negocio->productos()->create([
        'nombre' => 'Jugo',
        'precio' => 3000,
        'categoria_id' => $categoria->id,
    ]);

    $this->deleteJson("/api/comerciante/categorias/{$categoria->id}")->assertOk();

    // El producto sigue existiendo, pero sin categoría.
    $this->assertDatabaseHas('productos', [
        'id' => $producto->id,
        'categoria_id' => null,
    ]);
});
