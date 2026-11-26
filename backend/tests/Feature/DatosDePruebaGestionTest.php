<?php

use App\Console\Commands\GrumarDePrueba;
use App\Gestion\Gestion;
use App\Models\Negocio;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    Notification::fake();
    Storage::fake('public');
});

test('el comando crea Grumar completo y con --rehacer lo vuelve a crear', function () {
    $this->artisan('vitrina:grumar-de-prueba')->assertSuccessful();

    $grumar = Negocio::where('nombre', 'Grumar')->sole();
    $ismael = $grumar->user;
    expect($ismael->name)->toBe('Ismael')
        ->and($ismael->telefono)->toBe(GrumarDePrueba::CELULAR_DUENO)
        ->and($grumar->administra($ismael))->toBeTrue()
        ->and($grumar->telefono)->toBe('3008000279')
        ->and($grumar->direccion)->toBe('Calle 17 con Carrera 9, esquina')
        ->and($grumar->sedes()->count())->toBe(3)
        ->and($grumar->sedes()->where('tipo', 'fabrica')->count())->toBe(1)
        ->and($grumar->miembrosActivos()->wherePivot('rol', 'trabajador')->count())->toBe(21)
        ->and($grumar->productos()->count())->toBeGreaterThanOrEqual(20)
        ->and($grumar->productos()->whereNull('imagen')->count())->toBe(0)
        ->and($grumar->productos()->whereDoesntHave('materiales')->count())->toBe(0)
        ->and($grumar->servicios()->count())->toBeGreaterThanOrEqual(5)
        ->and($grumar->articulosInventario()->whereNull('imagen')->count())->toBe(0)
        ->and($grumar->cuentasPago()->count())->toBe(4)
        ->and($grumar->producciones()->count())->toBeGreaterThan(5)
        ->and(Gestion::tieneModulo($grumar, 'produccion'))->toBeTrue()
        ->and(Gestion::tieneModulo($grumar, 'sedes'))->toBeTrue();
    Storage::disk('public')->assertExists($grumar->imagen);
    Storage::disk('public')->assertExists($grumar->productos()->first()->imagen);

    // Cada sede tiene 7 trabajadores.
    foreach ($grumar->sedes as $sede) {
        expect($grumar->miembrosActivos()->wherePivot('sede_id', $sede->id)->count())->toBe(7);
    }

    // Sin --rehacer no toca nada; con --rehacer queda uno solo, sin trabajadores repetidos.
    $this->artisan('vitrina:grumar-de-prueba')->assertSuccessful();
    expect(Negocio::where('nombre', 'Grumar')->count())->toBe(1);
    $this->artisan('vitrina:grumar-de-prueba', ['--rehacer' => true])->assertSuccessful();
    expect(Negocio::where('nombre', 'Grumar')->count())->toBe(1)
        ->and(User::where('telefono', 'like', '33000000%')->count())->toBe(21)
        ->and(Negocio::where('nombre', 'Grumar')->sole()->id)->not->toBe($grumar->id);
});

test('las recetas del restaurante se descuentan cuando un pedido queda listo', function () {
    $dueno = User::factory()->create();
    $negocio = $dueno->negocio()->create(['nombre' => 'El Rincón Paisa', 'activo' => true, 'tiempo_preparacion' => 20]);
    $bandeja = $negocio->productos()->create(['nombre' => 'Bandeja paisa', 'precio' => 28000, 'disponible' => true]);
    $negocio->productos()->create(['nombre' => 'Limonada de panela', 'precio' => 5000, 'disponible' => true]);
    $negocio->productos()->create(['nombre' => 'Plato sin receta', 'precio' => 1000, 'disponible' => true]);

    $this->artisan('vitrina:recetas-restaurante-de-prueba', ['negocio' => $negocio->id])->assertSuccessful();
    expect($negocio->productos()->whereHas('materiales')->count())->toBe(2)
        ->and($bandeja->fresh()->materiales_al)->toBe('pedido');

    $huevos = $negocio->articulosInventario()->where('nombre', 'Huevo AA')->sole();
    $antes = $huevos->cantidad;
    $pedido = $negocio->pedidos()->create([
        'user_id' => User::factory()->create()->id, 'estado' => 'aceptado', 'metodo_pago' => 'efectivo',
        'subtotal' => 56000, 'costo_domicilio' => 4000, 'total' => 60000,
        'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567', 'minutos_preparacion' => 20,
    ]);
    $pedido->items()->create(['producto_id' => $bandeja->id, 'nombre' => 'Bandeja paisa', 'precio' => 28000, 'cantidad' => 2]);
    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}/pedidos/{$pedido->id}/listo")->assertOk();
    expect($huevos->fresh()->cantidad)->toBe($antes - 2.0);

    $this->artisan('vitrina:recetas-restaurante-de-prueba', ['negocio' => $negocio->id, '--quitar' => true])->assertSuccessful();
    expect($negocio->articulosInventario()->count())->toBe(0)->and($negocio->productos()->whereHas('materiales')->count())->toBe(0);
});
