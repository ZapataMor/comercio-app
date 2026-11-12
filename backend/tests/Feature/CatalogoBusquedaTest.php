<?php

use App\Models\Negocio;
use App\Models\TipoNegocio;
use App\Models\TipoProducto;
use App\Models\User;
use App\Support\Busqueda;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
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

    // La misma coincidencia debe permitir encontrar el negocio, tambien en MySQL.
    $negocios = $this->getJson('/api/negocios?buscar=GRIPA')->assertOk();
    expect(collect($negocios->json('negocios'))->pluck('nombre')->all())->toBe(['Droguería Salud']);
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

test('la normalizacion iguala las letras que suenan igual', function () {
    expect(Busqueda::normalizar('Pollo'))->toBe(Busqueda::normalizar('poyo'))
        ->and(Busqueda::normalizar('Cebolla'))->toBe(Busqueda::normalizar('sebolla'))
        ->and(Busqueda::normalizar('Arroz'))->toBe(Busqueda::normalizar('aros'))
        ->and(Busqueda::normalizar('Vino'))->toBe(Busqueda::normalizar('bino'))
        ->and(Busqueda::normalizar('Huevos'))->toBe(Busqueda::normalizar('uebos'))
        ->and(Busqueda::normalizar('Queso'))->toBe(Busqueda::normalizar('keso'))
        ->and(Busqueda::normalizar('Gelatina'))->toBe(Busqueda::normalizar('jelatina'))
        ->and(Busqueda::normalizar('Llanta'))->toBe(Busqueda::normalizar('yanta'))
        ->and(Busqueda::normalizar('Acetaminofén'))->toBe(Busqueda::normalizar('asetaminofen'))
        ->and(Busqueda::normalizar('Champú'))->toBe('champu');
});

function negocioConProductos(string $nombre, array $productos): Negocio
{
    $negocio = User::factory()->create()->negocio()->create(['nombre' => $nombre, 'activo' => true]);
    foreach ($productos as $producto) {
        $negocio->productos()->create(['nombre' => $producto, 'precio' => 1000]);
    }

    return $negocio;
}

test('un comodin de LIKE no devuelve todo el catalogo', function () {
    clienteAutenticado();
    negocioConProductos('Donde Pepe', ['Arroz', 'Pollo asado']);

    foreach (['%', '_', '%%', '...'] as $texto) {
        $this->getJson('/api/productos?buscar='.urlencode($texto))->assertOk()->assertExactJson(['productos' => []]);
        expect($this->getJson('/api/negocios?buscar='.urlencode($texto))->json('negocios'))->toBe([]);
    }

    // Un % junto al texto se ignora: no hace de comodín.
    $nombres = collect($this->getJson('/api/productos?buscar='.urlencode('pollo%'))->json('productos'))->pluck('nombre');
    expect($nombres->all())->toBe(['Pollo asado']);
});

test('la busqueda tolera errores de ortografia y de tecleo', function () {
    clienteAutenticado();
    negocioConProductos('Pollos Juancho', ['Pollo asado', 'Arroz con pollo', 'Cebolla cabezona', 'Gaseosa']);

    $buscar = fn (string $texto) => collect($this->getJson('/api/productos?buscar='.urlencode($texto))->json('productos'))->pluck('nombre')->all();

    // Por sonido.
    expect($buscar('poyo'))->toBe(['Pollo asado', 'Arroz con pollo'])
        ->and($buscar('sebolla'))->toBe(['Cebolla cabezona'])
        ->and($buscar('aros con poyo'))->toBe(['Arroz con pollo'])
        // Mayúsculas y tildes.
        ->and($buscar('POLLÓ'))->toBe(['Pollo asado', 'Arroz con pollo'])
        // Errores de tecleo: letra de menos, letras cambiadas, letra de más.
        ->and($buscar('pllo asado'))->toBe(['Pollo asado'])
        ->and($buscar('gaesosa'))->toBe(['Gaseosa'])
        ->and($buscar('cebollla'))->toBe(['Cebolla cabezona'])
        // El orden de las palabras no importa.
        ->and($buscar('asado pollo'))->toBe(['Pollo asado']);
});

test('la busqueda de negocios tambien tolera errores y marca si coincide por nombre', function () {
    clienteAutenticado();
    negocioConProductos('Pollos Juancho', ['Pollo asado']);
    negocioConProductos('Donde Pepe', ['Arroz con pollo']);
    negocioConProductos('Ferretería Central', ['Martillo']);

    $negocios = collect($this->getJson('/api/negocios?buscar=poyo')->assertOk()->json('negocios'));

    expect($negocios->pluck('nombre')->sort()->values()->all())->toBe(['Donde Pepe', 'Pollos Juancho'])
        ->and($negocios->firstWhere('nombre', 'Pollos Juancho')['coincide_nombre'])->toBeTrue()
        ->and($negocios->firstWhere('nombre', 'Donde Pepe')['coincide_nombre'])->toBeFalse();

    expect(collect($this->getJson('/api/negocios?buscar=ferreteria')->json('negocios'))->pluck('nombre')->all())
        ->toBe(['Ferretería Central']);
    expect($this->getJson('/api/negocios')->json('negocios.0.coincide_nombre'))->toBeNull();
});

test('la columna de busqueda no sale en las respuestas', function () {
    clienteAutenticado();
    $negocio = negocioConProductos('Donde Pepe', ['Arroz']);
    $negocio->servicios()->create(['nombre' => 'Domicilio', 'descripcion' => 'A todo Maicao', 'precio' => 2000, 'disponible' => true]);

    $resp = $this->getJson("/api/negocios/{$negocio->id}")->assertOk();
    expect($resp->json('servicios.0'))->not->toHaveKey('busqueda');
    expect($resp->json('productos.0'))->not->toHaveKey('busqueda');
});

test('los productos con categoria solo coinciden si la palabra esta en ellos o en su categoria', function () {
    clienteAutenticado();
    $negocio = negocioConProductos('Pollos Juancho', []);
    $bebidas = $negocio->categorias()->create(['nombre' => 'Bebidas']);
    $lubricantes = $negocio->categorias()->create(['nombre' => 'Lubricantes']);
    $negocio->productos()->create(['nombre' => 'Gaseosa', 'precio' => 3000, 'categoria_id' => $bebidas->id]);
    $negocio->productos()->create(['nombre' => 'Aceite 2 tiempos', 'precio' => 9000, 'categoria_id' => $lubricantes->id]);

    $negocio->productos()->create(['nombre' => 'Combo personal', 'descripcion' => 'Con gaseosa', 'precio' => 15000]);

    $buscar = fn (string $texto) => collect($this->getJson('/api/productos?buscar='.urlencode($texto))->json('productos'))->pluck('nombre')->all();

    // Corregida la palabra, primero lo que la tiene en el nombre.
    expect($buscar('gasiosa'))->toBe(['Gaseosa', 'Combo personal'])
        ->and($buscar('bebida'))->toBe(['Gaseosa'])
        ->and($buscar('lubrikante'))->toBe(['Aceite 2 tiempos'])
        ->and($buscar('poyo'))->toBe([]);

    // Igual para los negocios con tipo: el tipo no hace coincidir a todos.
    $tipo = TipoNegocio::firstOrCreate(['nombre' => 'Restaurante'], ['slug' => 'restaurante']);
    $negocio->tiposNegocio()->attach($tipo);
    expect(collect($this->getJson('/api/negocios?buscar=martiyo')->json('negocios'))->all())->toBe([])
        ->and(collect($this->getJson('/api/negocios?buscar=restorante')->json('negocios'))->pluck('nombre')->all())->toBe(['Pollos Juancho']);
});

test('una consulta sin sentido no devuelve productos sin relacion', function () {
    clienteAutenticado();
    $negocio = negocioConProductos('Donde Pepe', ['Trago de whisky', 'Cazuela de mariscos', 'Churrasco', 'Roscón de arequipe', 'Arroz']);
    // Con categoría: un término sin alternativas tampoco debe pasar por ella.
    $categoria = $negocio->categorias()->create(['nombre' => 'Mariscos']);
    $negocio->productos()->create(['nombre' => 'Langostinos', 'precio' => 30000, 'categoria_id' => $categoria->id]);

    $buscar = fn (string $texto) => collect($this->getJson('/api/productos?buscar='.urlencode($texto))->assertOk()->json('productos'))->pluck('nombre')->all();

    // «zzzzqqq» suena «sk», que está dentro de «uiski», «mariskos», «churasko»...
    foreach (['zzzzqqq', 'zq', 'qqqq', 'jjjjjjj', 'kkkkaaa', 'asdfgh', 'zzzzqqq arroz'] as $texto) {
        expect($buscar($texto))->toBe([], "«{$texto}» no debería encontrar nada");
        expect($this->getJson('/api/negocios?buscar='.urlencode($texto))->json('negocios'))->toBe([]);
    }
    expect(Busqueda::terminos('zzzzqqq'))->toBe([[]]);

    // Una palabra con letras estiradas sigue valiendo si es del catálogo.
    expect($buscar('arrrrrroz'))->toBe(['Arroz']);
});

test('las busquedas cortas solo coinciden con palabras completas o con su comienzo', function () {
    clienteAutenticado();
    negocioConProductos('La Tienda', ['Té verde', 'Aceite', 'Pan blanco', 'Empanada', 'Sal marina', 'Salchicha', 'Ron viejo', 'Jugo de toronja']);

    $buscar = fn (string $texto) => collect($this->getJson('/api/productos?buscar='.urlencode($texto))->assertOk()->json('productos'))->pluck('nombre')->all();

    expect($buscar('té'))->toBe(['Té verde'])
        ->and($buscar('TE'))->toBe(['Té verde'])
        ->and($buscar('pan'))->toBe(['Pan blanco'])
        ->and($buscar('sal'))->toBe(['Sal marina', 'Salchicha'])
        ->and($buscar('ron'))->toBe(['Ron viejo'])
        ->and($buscar('toronja'))->toBe(['Jugo de toronja'])
        ->and($buscar('empa'))->toBe(['Empanada']);

    // También al decidir si un negocio coincide por su nombre.
    negocioConProductos('Rondón Licores', ['Aguardiente']);
    $negocios = collect($this->getJson('/api/negocios?buscar=ron')->json('negocios'));
    expect($negocios->pluck('nombre')->sort()->values()->all())->toBe(['La Tienda', 'Rondón Licores'])
        ->and($negocios->firstWhere('nombre', 'Rondón Licores')['coincide_nombre'])->toBeTrue()
        ->and($negocios->firstWhere('nombre', 'La Tienda')['coincide_nombre'])->toBeFalse();
});

test('la correccion de errores sigue funcionando con palabras partidas o mal escritas', function () {
    clienteAutenticado();
    negocioConProductos('Pollos Juancho', ['Arroz con pollo', 'Pollo asado', 'Gaseosa']);
    negocioConProductos('Droguería Salud', ['Acetaminofén 500mg']);

    $buscar = fn (string $texto) => collect($this->getJson('/api/productos?buscar='.urlencode($texto))->assertOk()->json('productos'))->pluck('nombre')->all();

    expect($buscar('arrz con pllo'))->toBe(['Arroz con pollo'])
        ->and($buscar('gasiosa'))->toBe(['Gaseosa'])
        ->and($buscar('asetaminofen'))->toBe(['Acetaminofén 500mg'])
        ->and($buscar('asetamim'))->toBe(['Acetaminofén 500mg'])
        // Las cifras no se juntan como las letras dobles: «50» no es «500».
        ->and($buscar('500'))->toBe(['Acetaminofén 500mg'])
        ->and($buscar('50'))->toBe([]);
});
