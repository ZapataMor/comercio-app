<?php

use App\Models\Negocio;
use App\Models\Producto;
use App\Models\TipoProducto;
use App\Models\User;
use App\Support\HorarioNegocio;
use Database\Seeders\NegociosDemoSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Storage;

// Los 30 negocios demo salen completos: en el mapa, con horario y con al
// menos 10 productos; la comida trae ingredientes y el resto varía de tipo.

beforeEach(function () {
    Storage::fake('public');
    $this->seed(RoleSeeder::class);
    $this->seed(NegociosDemoSeeder::class);
});

it('crea 30 negocios con ubicación, barrio, horario válido y al menos 10 productos', function () {
    $negocios = Negocio::withCount('productos')->get();

    expect($negocios)->toHaveCount(30);

    foreach ($negocios as $negocio) {
        expect($negocio->tieneUbicacion())->toBeTrue($negocio->nombre)
            ->and($negocio->barrio)->not->toBeEmpty()
            ->and($negocio->direccion)->not->toBeEmpty()
            ->and($negocio->telefono)->toMatch('/^3\d{9}$/')
            ->and($negocio->productos_count)->toBeGreaterThanOrEqual(10, $negocio->nombre)
            ->and(array_keys($negocio->horario))->toEqualCanonicalizing(HorarioNegocio::CLAVES);

        foreach ($negocio->horario as $dia) {
            expect(HorarioNegocio::almuerzoValido($dia))->toBeTrue($negocio->nombre);
        }
    }
});

it('le pone ingredientes a todo lo que venden los negocios de comida', function () {
    $comida = TipoProducto::where('slug', TipoProducto::SLUG_COMIDA)->value('id');
    $deComida = Negocio::whereHas('productos', fn ($q) => $q->where('tipo_producto_id', $comida))->get();

    expect($deComida->count())->toBeGreaterThanOrEqual(10);

    foreach ($deComida as $negocio) {
        foreach ($negocio->productos as $producto) {
            expect($producto->tipo_producto_id)->toBe($comida, "{$negocio->nombre}: {$producto->nombre}")
                ->and(count($producto->atributos))->toBeGreaterThanOrEqual(2);
        }
    }
});

it('los demás negocios son variados y sus productos traen tallas, colores o para qué sirven', function () {
    $tipos = Negocio::with('tiposNegocio')->get()->flatMap->tiposNegocio->pluck('nombre')->unique();

    expect($tipos)->toContain('Ferretería', 'Ropa', 'Calzado', 'Droguería', 'Papelería', 'Tecnología', 'Mascotas', 'Barbería');

    Producto::with('tipoProducto')->get()->each(function (Producto $producto) {
        expect($producto->atributos)->not->toBeEmpty($producto->nombre);
        if ($producto->tipoProducto->slug === TipoProducto::SLUG_ROPA) {
            expect($producto->colores)->not->toBeEmpty($producto->nombre);
        }
    });
});

it('ofrece servicios con cita y deja a comerciante@demo.co en sus dos negocios', function () {
    expect(Negocio::has('servicios')->count())->toBeGreaterThanOrEqual(5);

    $demo = User::where('email', 'comerciante@demo.co')->firstOrFail();
    expect($demo->negociosActivos()->pluck('nombre'))
        ->toContain('Panaderia La Espiga', 'El Rincón Paisa');
});

it('no duplica ni revive productos borrados al sembrar otra vez', function () {
    $total = Producto::count();
    Producto::where('nombre', 'Bandeja paisa')->firstOrFail()->delete();

    $this->seed(NegociosDemoSeeder::class);

    expect(Negocio::count())->toBe(30)
        ->and(Producto::count())->toBe($total - 1);
});
