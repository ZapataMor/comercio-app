<?php

use App\Models\TipoProducto;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

function clienteAutenticado(): User
{
    $user = User::factory()->create();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);

    return $user;
}

test('la busqueda de productos exige autenticacion', function () {
    $this->getJson('/api/productos?buscar=arroz')->assertStatus(401);
});

test('sin texto la busqueda de productos devuelve lista vacia', function () {
    clienteAutenticado();

    $this->getJson('/api/productos')
        ->assertOk()
        ->assertExactJson(['productos' => []]);
});

test('la busqueda devuelve productos disponibles con su negocio, por relevancia', function () {
    clienteAutenticado();

    $dueno = User::factory()->create();
    $negocio = $dueno->negocio()->create(['nombre' => 'Donde Pepe', 'activo' => true]);
    $negocio->productos()->createMany([
        ['nombre' => 'Arroz con pollo', 'precio' => 12000],
        ['nombre' => 'Arroz', 'precio' => 3000],
        ['nombre' => 'Arroz chino', 'precio' => 9000],
        ['nombre' => 'Pollo asado', 'precio' => 15000],
    ]);

    $resp = $this->getJson('/api/productos?buscar=Arroz')->assertOk();

    $nombres = collect($resp->json('productos'))->pluck('nombre')->all();

    expect($nombres)->toBe(['Arroz', 'Arroz chino', 'Arroz con pollo']);
    expect($resp->json('productos.0.negocio.nombre'))->toBe('Donde Pepe');
    expect($resp->json('productos.0.negocio.abierto'))->toBeTrue();
});

test('la busqueda encuentra productos por sus atributos (ingredientes, usos...)', function () {
    clienteAutenticado();

    $dueno = User::factory()->create();
    $negocio = $dueno->negocio()->create(['nombre' => 'Droguería Salud', 'activo' => true]);
    $medicamento = TipoProducto::where('slug', 'medicamento')->firstOrFail();
    $negocio->productos()->create([
        'nombre' => 'Acetaminofén 500mg',
        'precio' => 4500,
        'tipo_producto_id' => $medicamento->id,
        'atributos' => ['Dolor de cabeza', 'Gripa', 'Fiebre'],
    ]);
    $negocio->productos()->create(['nombre' => 'Alcohol', 'precio' => 6000]);

    $resp = $this->getJson('/api/productos?buscar=gripa')->assertOk();
    $productos = collect($resp->json('productos'));

    expect($productos->pluck('nombre')->all())->toBe(['Acetaminofén 500mg']);
    expect($productos[0]['atributos'])->toContain('Gripa');
});

test('la busqueda incluye cerrados despues de abiertos e ignora productos no disponibles', function () {
    clienteAutenticado();

    $dueno = User::factory()->create();
    $abierto = $dueno->negocio()->create(['nombre' => 'Abierto', 'activo' => true]);
    $abierto->productos()->create(['nombre' => 'Pan blanco', 'precio' => 1000]);
    $abierto->productos()->create(['nombre' => 'Pan dulce', 'precio' => 1000, 'disponible' => false]);

    $otroDueno = User::factory()->create();
    $cerrado = $otroDueno->negocio()->create(['nombre' => 'Cerrado', 'activo' => false]);
    $cerrado->productos()->create(['nombre' => 'Pan salado', 'precio' => 1000]);

    $resp = $this->getJson('/api/productos?buscar=Pan')->assertOk();
    $productos = collect($resp->json('productos'));

    expect($productos->pluck('nombre')->all())->toBe(['Pan blanco', 'Pan salado']);
    expect($productos[0]['negocio']['abierto'])->toBeTrue();
    expect($productos[1]['negocio']['abierto'])->toBeFalse();
});
