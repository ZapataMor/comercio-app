<?php

use App\Models\Propiedad;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

// Propiedades: casas en venta o alquiler y patios para eventos que publica una persona.

beforeEach(fn () => Storage::fake('public'));

function datosCasa(array $cambios = []): array
{
    return $cambios + [
        'tipo' => 'venta',
        'titulo' => 'Casa esquinera en el centro',
        'descripcion' => 'Casa de dos plantas, recién pintada.',
        'precio' => 250000000,
        'negociable' => true,
        'direccion' => 'Calle 12 # 10-20',
        'barrio' => 'Centro',
        'lat' => 11.3826,
        'lng' => -72.2432,
        'habitaciones' => 3,
        'banos' => 2,
        'area_m2' => 120,
        'estrato' => 3,
        'caracteristicas' => ['Garaje', 'Patio'],
        'contacto_nombre' => 'Ana Pérez',
        'contacto_telefono' => '3001234567',
        'imagenes' => [UploadedFile::fake()->image('frente.jpg')],
    ];
}

function publicarPropiedad(User $dueno, array $cambios = []): Propiedad
{
    $propiedad = $dueno->propiedades()->make(collect(datosCasa($cambios))->except('imagenes')->all());
    $propiedad->galeria = ['/storage/propiedades/demo.jpg'];
    $propiedad->save();

    return $propiedad;
}

it('publica una casa con fotos, ubicación y contacto', function () {
    $dueno = User::factory()->create();
    Sanctum::actingAs($dueno);

    $res = $this->post('/api/propiedades', datosCasa(), ['Accept' => 'application/json'])->assertCreated();

    $res->assertJsonPath('propiedad.tipo', 'venta')
        ->assertJsonPath('propiedad.habitaciones', 3)
        ->assertJsonPath('propiedad.es_mia', true)
        ->assertJsonPath('propiedad.caracteristicas', ['Garaje', 'Patio'])
        ->assertJsonCount(1, 'propiedad.galeria');
    $foto = $res->json('propiedad.galeria.0');
    Storage::disk('public')->assertExists(substr($foto, strlen('/storage/')));
    $this->getJson('/api/propiedades/mias')->assertOk()->assertJsonCount(1, 'propiedades');
});

it('valida lo que el cliente necesita saber de cada tipo', function () {
    Sanctum::actingAs(User::factory()->create());

    // Sin ubicación, sin contacto válido y sin habitaciones: no se publica.
    $this->post('/api/propiedades', datosCasa([
        'lat' => null, 'lng' => null, 'contacto_telefono' => '123', 'habitaciones' => null,
    ]), ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['lat', 'contacto_telefono', 'habitaciones']);

    // Un patio exige la capacidad y solo admite sus propias características.
    $this->post('/api/propiedades', datosCasa([
        'tipo' => 'eventos', 'habitaciones' => null, 'banos' => null, 'caracteristicas' => ['Garaje'],
    ]), ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['capacidad', 'caracteristicas.0']);

    // Sin ninguna foto tampoco.
    $this->post('/api/propiedades', datosCasa(['imagenes' => []]), ['Accept' => 'application/json'])
        ->assertUnprocessable();
});

it('un patio para eventos guarda la capacidad y descarta los datos de casa', function () {
    Sanctum::actingAs(User::factory()->create());

    $this->post('/api/propiedades', datosCasa([
        'tipo' => 'eventos', 'titulo' => 'Patio La Ceiba', 'capacidad' => 150, 'estrato' => 4,
        'caracteristicas' => ['Sonido', 'Mesas y sillas'],
    ]), ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('propiedad.capacidad', 150)
        ->assertJsonPath('propiedad.habitaciones', null)
        ->assertJsonPath('propiedad.estrato', null);
});

it('el cliente ve el listado, el mapa y el detalle con filtros', function () {
    $dueno = User::factory()->create();
    publicarPropiedad($dueno, ['titulo' => 'Casa grande', 'precio' => 300000000, 'habitaciones' => 4]);
    publicarPropiedad($dueno, ['tipo' => 'alquiler', 'titulo' => 'Casa en arriendo', 'precio' => 900000, 'habitaciones' => 2]);
    $patio = publicarPropiedad($dueno, ['tipo' => 'eventos', 'titulo' => 'Patio Los Mangos', 'precio' => 500000, 'habitaciones' => null, 'capacidad' => 80]);
    publicarPropiedad($dueno, ['titulo' => 'Vendida', 'disponible' => false]);
    $suspendido = User::factory()->create(['suspendido_at' => now()]);
    publicarPropiedad($suspendido, ['titulo' => 'De cuenta suspendida']);

    Sanctum::actingAs(User::factory()->create());
    $this->getJson('/api/propiedades')->assertOk()->assertJsonCount(3, 'propiedades');
    $this->getJson('/api/propiedades?tipo=alquiler')->assertOk()
        ->assertJsonCount(1, 'propiedades')->assertJsonPath('propiedades.0.titulo', 'Casa en arriendo');
    $this->getJson('/api/propiedades?habitaciones=3')->assertOk()->assertJsonCount(1, 'propiedades');
    $this->getJson('/api/propiedades?precio_max=1000000')->assertOk()->assertJsonCount(2, 'propiedades');
    // Tolerante a errores: «mangoz» encuentra «Mangos».
    $this->getJson('/api/propiedades?buscar=mangoz')->assertOk()->assertJsonCount(1, 'propiedades');
    $this->getJson('/api/propiedades?tipo=oficina')->assertUnprocessable();

    $this->getJson('/api/propiedades/mapa')->assertOk()->assertJsonCount(3, 'propiedades')
        ->assertJsonStructure(['propiedades' => [['id', 'tipo', 'precio', 'lat', 'lng', 'foto']]]);

    $this->getJson("/api/propiedades/{$patio->id}")->assertOk()
        ->assertJsonPath('propiedad.contacto_telefono', '3001234567')
        ->assertJsonPath('propiedad.es_mia', false);
    $oculta = Propiedad::where('titulo', 'Vendida')->first();
    $this->getJson("/api/propiedades/{$oculta->id}")->assertNotFound();

    $this->getJson('/api/propiedades/opciones')->assertOk()->assertJsonPath('max_fotos', 10);
});

it('solo el dueño edita, oculta o elimina su propiedad', function () {
    $dueno = User::factory()->create();
    $propiedad = publicarPropiedad($dueno);

    Sanctum::actingAs(User::factory()->create());
    $this->putJson("/api/propiedades/{$propiedad->id}", datosCasa())->assertNotFound();
    $this->putJson("/api/propiedades/{$propiedad->id}/disponibilidad", ['disponible' => false])->assertNotFound();
    $this->deleteJson("/api/propiedades/{$propiedad->id}")->assertNotFound();

    Sanctum::actingAs($dueno);
    // Cambia el precio, conserva la foto que tenía y añade otra.
    $this->post("/api/propiedades/{$propiedad->id}", datosCasa([
        '_method' => 'PUT', 'precio' => 240000000, 'conservar_imagenes' => json_encode(['/storage/propiedades/demo.jpg']),
    ]), ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('propiedad.precio', 240000000)
        ->assertJsonCount(2, 'propiedad.galeria');

    $this->putJson("/api/propiedades/{$propiedad->id}/disponibilidad", ['disponible' => false])
        ->assertOk()->assertJsonPath('propiedad.disponible', false);
    // Oculta, el dueño la sigue viendo.
    $this->getJson("/api/propiedades/{$propiedad->id}")->assertOk();

    $this->deleteJson("/api/propiedades/{$propiedad->id}")->assertOk();
    $this->assertDatabaseMissing('propiedades', ['id' => $propiedad->id]);
});

it('al eliminar la cuenta sus propiedades dejan de publicarse', function () {
    $dueno = User::factory()->conClave()->create(['password' => 'secreta123']);
    publicarPropiedad($dueno);
    Sanctum::actingAs($dueno);

    $this->deleteJson('/api/cuenta', ['pin' => '2468'])->assertOk();

    expect(Propiedad::count())->toBe(0);
});

it('exige iniciar sesión', function () {
    $this->getJson('/api/propiedades')->assertUnauthorized();
    $this->postJson('/api/propiedades', [])->assertUnauthorized();
});

it('el seeder demo publica casas y patios con las fotos del grupo, sin duplicar', function () {
    $dueno = User::factory()->create(['email' => 'cliente@demo.co']);
    // Sin fotos del grupo: igual publica, sin fotos.
    $this->seed(\Database\Seeders\PropiedadesDemoSeeder::class);
    expect(Propiedad::count())->toBe(9)->and(Propiedad::first()->galeria)->toBeEmpty();

    foreach (['casa-01', 'casa-02', 'casa-03', 'interior-01', 'patio-01', 'patio-02'] as $f) {
        Storage::disk('public')->put("propiedades/tematico-{$f}.jpg", 'x');
    }
    // Una demo con fotos de otra prueba también recibe las del grupo; una del usuario no se toca.
    Propiedad::where('titulo', 'Patio La Ceiba')->first()->forceFill(['galeria' => ['/storage/propiedades/dibujo.jpg']])->save();
    $propia = publicarPropiedad($dueno, ['titulo' => 'Mi casa']);
    $this->seed(\Database\Seeders\PropiedadesDemoSeeder::class);

    $casa = Propiedad::where('tipo', 'venta')->where('titulo', '!=', 'Mi casa')->first();
    expect(Propiedad::count())->toBe(10)
        ->and(Propiedad::where('tipo', 'eventos')->whereNull('capacidad')->count())->toBe(0)
        ->and($casa->galeria)->toHaveCount(3)
        ->and($casa->galeria[2])->toBe('/storage/propiedades/tematico-interior-01.jpg')
        ->and(Propiedad::where('titulo', 'Patio La Ceiba')->first()->galeria)
        ->toBe(['/storage/propiedades/tematico-patio-01.jpg', '/storage/propiedades/tematico-patio-02.jpg'])
        ->and($propia->fresh()->galeria)->toBe(['/storage/propiedades/demo.jpg']);
});

it('las fotos se suben de a una hasta el máximo, solo por el dueño', function () {
    $dueno = User::factory()->create();
    $propiedad = publicarPropiedad($dueno);

    Sanctum::actingAs(User::factory()->create());
    $this->post("/api/propiedades/{$propiedad->id}/fotos", ['foto' => UploadedFile::fake()->image('sala.jpg')], ['Accept' => 'application/json'])
        ->assertNotFound();

    Sanctum::actingAs($dueno);
    $this->post("/api/propiedades/{$propiedad->id}/fotos", ['foto' => UploadedFile::fake()->create('nota.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['foto']);
    $this->post("/api/propiedades/{$propiedad->id}/fotos", ['foto' => UploadedFile::fake()->image('grande.jpg')->size(11000)], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['foto']);

    for ($i = 2; $i <= 10; $i++) {
        $res = $this->post("/api/propiedades/{$propiedad->id}/fotos", ['foto' => UploadedFile::fake()->image("f{$i}.jpg")], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonCount($i, 'propiedad.galeria');
    }
    // La primera sigue siendo la portada.
    expect($res->json('propiedad.foto'))->toBe('/storage/propiedades/demo.jpg');
    $this->post("/api/propiedades/{$propiedad->id}/fotos", ['foto' => UploadedFile::fake()->image('once.jpg')], ['Accept' => 'application/json'])
        ->assertUnprocessable();
});
