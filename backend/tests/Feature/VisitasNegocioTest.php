<?php

use App\Http\Controllers\Api\VisitaNegocioController;
use App\Models\Negocio;
use App\Models\NegocioVisita;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->dueno = User::factory()->create();
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Tienda']);
    $this->url = '/api/negocios/'.$this->negocio->id;
});

test('cada entrada cuenta una visita y las personas distintas se cuentan una vez', function () {
    [$ana, $beto] = User::factory()->count(2)->create();

    Sanctum::actingAs($ana);
    $this->postJson($this->url.'/visita')->assertCreated()->assertJsonPath('contada', true);
    // Volver enseguida (ir al carrito y regresar) no infla el número.
    $this->postJson($this->url.'/visita')->assertOk()->assertJsonPath('contada', false);

    $this->travel(VisitaNegocioController::MINUTOS_ENTRE_VISITAS + 1)->minutes();
    $this->postJson($this->url.'/visita')->assertCreated();

    Sanctum::actingAs($beto);
    $this->postJson($this->url.'/visita')->assertCreated();

    Sanctum::actingAs($this->dueno);
    $this->getJson($this->url.'/visitas')->assertOk()
        ->assertJsonPath('visitas.total', ['visitas' => 3, 'personas' => 2])
        ->assertJsonPath('visitas.hoy.visitas', 3);
});

test('el equipo del negocio mirando su tienda no suma visitas', function () {
    $empleado = User::factory()->create();
    $this->negocio->miembros()->attach($empleado->id, ['rol' => 'trabajador', 'activo' => true]);

    foreach ([$this->dueno, $empleado] as $miembro) {
        Sanctum::actingAs($miembro);
        $this->postJson($this->url.'/visita')->assertOk()->assertJsonPath('contada', false);
    }

    expect(NegocioVisita::count())->toBe(0);
});

test('hoy, semana y mes solo cuentan las visitas de ese periodo', function () {
    $cliente = User::factory()->create();
    foreach ([0, 3, 20, 60] as $dias) {
        NegocioVisita::create(['negocio_id' => $this->negocio->id, 'user_id' => $cliente->id])
            ->forceFill(['created_at' => now()->subDays($dias)])->save();
    }

    Sanctum::actingAs($this->dueno);
    $this->getJson($this->url.'/visitas')->assertOk()
        ->assertJsonPath('visitas.hoy', ['visitas' => 1, 'personas' => 1])
        ->assertJsonPath('visitas.semana.visitas', 2)
        ->assertJsonPath('visitas.mes.visitas', 3)
        ->assertJsonPath('visitas.total.visitas', 4);
});

test('solo el administrador del negocio ve las visitas', function () {
    $empleado = User::factory()->create();
    $this->negocio->miembros()->attach($empleado->id, [
        'rol' => 'trabajador', 'activo' => true, ...array_fill_keys(Negocio::PERMISOS, false),
    ]);

    Sanctum::actingAs(User::factory()->create());
    $this->getJson($this->url.'/visitas')->assertForbidden();

    Sanctum::actingAs($empleado);
    $this->getJson($this->url.'/visitas')->assertForbidden();

    $this->negocio->miembros()->updateExistingPivot($empleado->id, ['administrador' => true]);
    $this->getJson($this->url.'/visitas')->assertOk();
});

test('no se registran visitas a un negocio desactivado', function () {
    $this->negocio->forceFill(['desactivado_at' => now()])->save();
    Sanctum::actingAs(User::factory()->create());
    $this->postJson($this->url.'/visita')->assertNotFound();
});
