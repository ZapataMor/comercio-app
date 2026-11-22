<?php

use App\Models\CategoriaCatalogo;
use App\Models\TipoNegocio;
use App\Models\TipoProducto;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

function catCliente(): User
{
    $user = User::factory()->create();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);

    return $user;
}

function catNegocio(string $nombre, bool $abierto = true, array $extra = [])
{
    return User::factory()->create()->negocio()->create(['nombre' => $nombre, 'activo' => $abierto] + $extra);
}

function catCategoria(string $nombre): CategoriaCatalogo
{
    return CategoriaCatalogo::where('nombre', $nombre)->firstOrFail();
}

test('la migracion siembra categorias con otros nombres', function () {
    expect(CategoriaCatalogo::count())->toBeGreaterThan(10);
    expect(catCategoria('Medicamentos')->nombres_alternos)->toContain('Droguería');
});

test('el comerciante guarda varias categorias y otros nombres en un producto', function () {
    $dueno = User::factory()->create();
    $dueno->assignRole('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Papelería Luna', 'activo' => true]);
    Sanctum::actingAs($dueno);
    $otro = TipoProducto::where('slug', 'otro')->value('id');
    $papeleria = catCategoria('Papelería');
    $hogar = catCategoria('Hogar');

    $resp = $this->postJson("/api/negocios/{$negocio->id}/productos", [
        'nombre' => 'Lapicero',
        'precio' => 1500,
        'tipo_producto_id' => $otro,
        'categorias_catalogo' => [$papeleria->id, $hogar->id],
        'nombres_alternos' => [' Bolígrafo ', 'boligrafo', 'Esfero', 'lapicero', ''],
    ])->assertCreated();

    expect($resp->json('producto.nombres_alternos'))->toBe(['Bolígrafo', 'Esfero']);
    expect(collect($resp->json('producto.categorias_catalogo'))->pluck('nombre')->sort()->values()->all())->toBe(['Hogar', 'Papelería']);

    $id = $resp->json('producto.id');
    // Quitar todas (null desde un formulario con foto).
    $this->putJson("/api/negocios/{$negocio->id}/productos/{$id}", ['categorias_catalogo' => null])->assertOk()
        ->assertJsonPath('producto.categorias_catalogo', []);
    // Una categoría que no existe se rechaza.
    $this->putJson("/api/negocios/{$negocio->id}/productos/{$id}", ['categorias_catalogo' => [999999]])->assertUnprocessable();
});

test('la busqueda encuentra productos y negocios por sus otros nombres', function () {
    catCliente();
    $negocio = catNegocio('Peluquería Juancho', extra: ['nombres_alternos' => ['Barbería']]);
    $negocio->productos()->create(['nombre' => 'Lapicero', 'precio' => 1500, 'nombres_alternos' => ['Bolígrafo']]);

    $this->getJson('/api/productos?buscar=boligrafo')->assertOk()->assertJsonPath('productos.0.nombre', 'Lapicero');

    $negocios = $this->getJson('/api/negocios?buscar=barberia')->assertOk();
    expect($negocios->json('negocios.0.nombre'))->toBe('Peluquería Juancho');
    expect($negocios->json('negocios.0.coincide_nombre'))->toBeTrue();
});

test('la busqueda de negocios por nombre ignora lo que venden', function () {
    catCliente();
    catNegocio('Arroces Doña Ana');
    catNegocio('Donde Pepe')->productos()->create(['nombre' => 'Arroz chino', 'precio' => 9000]);

    $todos = collect($this->getJson('/api/negocios?buscar=arroz')->json('negocios'))->pluck('nombre')->sort()->values()->all();
    expect($todos)->toBe(['Arroces Doña Ana', 'Donde Pepe']);

    $porNombre = collect($this->getJson('/api/negocios?buscar=arroz&por=nombre')->json('negocios'))->pluck('nombre')->all();
    expect($porNombre)->toBe(['Arroces Doña Ana']);
});

test('abierto ahora deja fuera los negocios cerrados y sus productos', function () {
    catCliente();
    catNegocio('Abierto')->productos()->create(['nombre' => 'Pan blanco', 'precio' => 500]);
    catNegocio('Cerrado', abierto: false)->productos()->create(['nombre' => 'Pan integral', 'precio' => 800]);

    expect(collect($this->getJson('/api/negocios?abierto=1')->json('negocios'))->pluck('nombre')->all())->toBe(['Abierto']);
    expect(collect($this->getJson('/api/productos?buscar=pan&abierto=1')->json('productos'))->pluck('nombre')->all())->toBe(['Pan blanco']);
    expect($this->getJson('/api/productos?buscar=pan')->json('productos'))->toHaveCount(2);
});

test('filtrar por categoria trae sus productos y los negocios que la venden o se llaman como ella', function () {
    catCliente();
    $medicamentos = catCategoria('Medicamentos');

    $tienda = catNegocio('Tienda La Esquina');
    $tienda->productos()->create(['nombre' => 'Acetaminofén', 'precio' => 4500])->categoriasCatalogo()->attach($medicamentos);
    $tienda->productos()->create(['nombre' => 'Gaseosa', 'precio' => 3000]);

    // Sin productos de la categoría, pero su tipo es un otro nombre de ella.
    $drogueria = catNegocio('Droguería Salud');
    $drogueria->tiposNegocio()->attach(TipoNegocio::firstOrCreate(['slug' => 'drogueria'], ['nombre' => 'Droguería']));

    catNegocio('Ferretería El Clavo');

    $productos = $this->getJson("/api/productos?categoria_catalogo_id={$medicamentos->id}")->assertOk();
    expect(collect($productos->json('productos'))->pluck('nombre')->all())->toBe(['Acetaminofén']);

    $negocios = collect($this->getJson("/api/negocios?categoria_catalogo_id={$medicamentos->id}")->json('negocios'))->pluck('nombre')->sort()->values()->all();
    expect($negocios)->toBe(['Droguería Salud', 'Tienda La Esquina']);

    // Para los filtros solo salen las categorías que encuentran algo.
    $filtros = collect($this->getJson('/api/categorias-catalogo?uso=filtro')->json('categorias'))->pluck('nombre');
    expect($filtros->all())->toContain('Medicamentos')->not->toContain('Ferretería');
    // Para el formulario, todas las visibles.
    expect($this->getJson('/api/categorias-catalogo')->json('categorias'))->toHaveCount(CategoriaCatalogo::count());

    // Una categoría oculta no filtra ni se ofrece.
    $medicamentos->update(['activa' => false]);
    expect($this->getJson("/api/productos?categoria_catalogo_id={$medicamentos->id}")->json('productos'))->toBe([]);
    expect(collect($this->getJson('/api/categorias-catalogo')->json('categorias'))->pluck('nombre'))->not->toContain('Medicamentos');
});

test('la busqueda por texto tambien encuentra los productos por su categoria global', function () {
    catCliente();
    $producto = catNegocio('Donde Pepe')->productos()->create(['nombre' => 'Combo especial', 'precio' => 15000]);
    $producto->categoriasCatalogo()->attach(catCategoria('Comidas rápidas'));

    // «Hamburguesas» es otro nombre de Comidas rápidas.
    expect(collect($this->getJson('/api/productos?buscar=hamburguesas')->json('productos'))->pluck('nombre')->all())->toBe(['Combo especial']);
});

test('el administrador gestiona las categorias desde el panel web', function () {
    $admin = User::factory()->create();
    $admin->assignRole('administrador');
    $this->actingAs($admin);

    $this->get('/admin/categorias')->assertOk()->assertSee('Comidas rápidas');

    $this->post('/admin/acciones/crear-categoria', ['nombre' => 'Útiles de oficina', 'otros_nombres' => 'Oficina, Grapadoras, oficina'])
        ->assertRedirect()->assertSessionHas('ok');
    $nueva = CategoriaCatalogo::where('nombre', 'Útiles de oficina')->firstOrFail();
    expect($nueva->nombres_alternos)->toBe(['Oficina', 'Grapadoras']);

    $this->post('/admin/acciones/crear-categoria', ['nombre' => 'útiles de oficina'])->assertSessionHasErrors('nombre');

    $this->post("/admin/acciones/editar-categoria/{$nueva->id}", ['nombre' => 'Oficina', 'otros_nombres' => '', 'orden' => 3, 'activa' => '0'])
        ->assertSessionHas('ok');
    expect($nueva->fresh())->nombre->toBe('Oficina')->activa->toBeFalse()->orden->toBe(3)->nombres_alternos->toBe([]);

    $producto = catNegocio('Papelería')->productos()->create(['nombre' => 'Grapadora', 'precio' => 9000]);
    $producto->categoriasCatalogo()->attach($nueva);
    $this->post("/admin/acciones/eliminar-categoria/{$nueva->id}")->assertSessionHas('ok');
    expect(CategoriaCatalogo::find($nueva->id))->toBeNull();
    expect($producto->fresh())->not->toBeNull();
});

test('un cliente no puede gestionar categorias', function () {
    catCliente();
    $this->postJson('/api/admin/categorias-catalogo', ['nombre' => 'Nueva'])->assertForbidden();
});
