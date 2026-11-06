<?php

use App\Models\Producto;
use App\Models\TipoProducto;
use App\Models\User;
use Database\Seeders\MenusRestaurantesDemoSeeder;
use Spatie\Permission\Models\Role;

// La carta de demostración trae comida real con ingredientes y se puede
// sembrar varias veces sin duplicar ni revivir lo que el comerciante borró.

beforeEach(function () {
    Role::findOrCreate('usuario', 'web');

    $dueno = User::factory()->create();
    $dueno->assignRole('usuario');
    $this->negocio = $dueno->negocio()->create(['nombre' => 'El Rincón Paisa', 'activo' => true]);
});

it('siembra platos de comida con descripción e ingredientes', function () {
    $this->seed(MenusRestaurantesDemoSeeder::class);

    $platos = Producto::where('negocio_id', $this->negocio->id)->get();
    $comida = TipoProducto::where('slug', TipoProducto::SLUG_COMIDA)->value('id');

    expect($platos->pluck('nombre'))->toContain('Hamburguesa sencilla', 'Salchipapa especial', 'Picada para dos');

    foreach ($platos as $plato) {
        expect($plato->tipo_producto_id)->toBe($comida)
            ->and($plato->descripcion)->not->toBeEmpty()
            ->and(count($plato->atributos))->toBeGreaterThanOrEqual(3)->toBeLessThanOrEqual(30);
    }
});

it('no duplica platos ni revive los borrados al sembrar otra vez', function () {
    $this->seed(MenusRestaurantesDemoSeeder::class);
    $total = Producto::where('negocio_id', $this->negocio->id)->count();
    Producto::where('nombre', 'Picada familiar')->first()->delete();

    $this->seed(MenusRestaurantesDemoSeeder::class);

    expect(Producto::where('negocio_id', $this->negocio->id)->count())->toBe($total - 1);
});
