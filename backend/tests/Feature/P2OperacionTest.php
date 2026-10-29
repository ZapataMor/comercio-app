<?php

use App\Models\Negocio;
use App\Models\User;
use App\Support\HorarioNegocio;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

// Operación del piloto: horario de los negocios, suspensión de cuentas desde
// el admin y listas paginadas.

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

function usuarioRol(string $rol): User
{
    $user = User::factory()->create();
    $user->assignRole($rol);

    return $user;
}

/** Lunes a sábado de 07:00 a 20:00; domingo cerrado. */
function horarioSemana(): array
{
    $h = ['abre' => '07:00', 'cierra' => '20:00'];

    return ['lun' => $h, 'mar' => $h, 'mie' => $h, 'jue' => $h, 'vie' => $h, 'sab' => $h, 'dom' => null];
}

// ---------------------------------------------------------------------------
// Horario
// ---------------------------------------------------------------------------

test('el horario dice si debe estar abierto, incluso pasando la medianoche', function () {
    $semana = horarioSemana();
    $lunes = Carbon::parse('2026-11-02 10:00'); // lunes

    expect(HorarioNegocio::deberiaEstarAbierto($semana, $lunes))->toBeTrue()
        ->and(HorarioNegocio::deberiaEstarAbierto($semana, $lunes->copy()->setTime(21, 0)))->toBeFalse()
        ->and(HorarioNegocio::deberiaEstarAbierto($semana, Carbon::parse('2026-11-01 10:00')))->toBeFalse(); // domingo

    $bar = ['vie' => ['abre' => '18:00', 'cierra' => '02:00']];
    expect(HorarioNegocio::deberiaEstarAbierto($bar, Carbon::parse('2026-11-06 23:30')))->toBeTrue()
        ->and(HorarioNegocio::deberiaEstarAbierto($bar, Carbon::parse('2026-11-07 01:30')))->toBeTrue()
        ->and(HorarioNegocio::deberiaEstarAbierto($bar, Carbon::parse('2026-11-07 02:30')))->toBeFalse();
});

test('la tarea abre y cierra el negocio a sus horas', function () {
    $negocio = usuarioRol('usuario')->negocio()->create([
        'nombre' => 'Panadería', 'activo' => false, 'horario' => horarioSemana(),
    ]);

    $this->travelTo(Carbon::parse('2026-11-02 07:01'));
    $this->artisan('negocios:aplicar-horario')->assertSuccessful();
    expect($negocio->fresh()->activo)->toBeTrue();

    $this->travelTo(Carbon::parse('2026-11-02 20:01'));
    $this->artisan('negocios:aplicar-horario')->assertSuccessful();
    expect($negocio->fresh()->activo)->toBeFalse();
});

test('abrir a mano fuera de horario se respeta hasta la siguiente hora del horario', function () {
    $dueno = usuarioRol('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Panadería', 'activo' => false, 'horario' => horarioSemana()]);

    // Lunes 21:00 (ya cerró): el dueño abre a mano.
    $this->travelTo(Carbon::parse('2026-11-02 21:00'));
    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}", ['activo' => true])->assertOk();

    $this->travelTo(Carbon::parse('2026-11-02 22:00'));
    $this->artisan('negocios:aplicar-horario');
    expect($negocio->fresh()->activo)->toBeTrue();

    // El martes a las 07:00 manda el horario (abierto) y a las 20:00 cierra.
    $this->travelTo(Carbon::parse('2026-11-03 20:05'));
    $this->artisan('negocios:aplicar-horario');
    expect($negocio->fresh()->activo)->toBeFalse();
});

test('el propietario guarda el horario y el cliente ve el de hoy', function () {
    $dueno = usuarioRol('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Panadería', 'activo' => true]);
    Sanctum::actingAs($dueno);

    // Desde la app llega como JSON dentro del formulario multipart.
    $this->putJson("/api/negocios/{$negocio->id}", ['horario' => json_encode(horarioSemana())])
        ->assertOk()
        ->assertJsonPath('negocio.horario.lun.abre', '07:00')
        ->assertJsonPath('negocio.horario.dom', null);

    $this->travelTo(Carbon::parse('2026-11-02 10:00'));
    Sanctum::actingAs(usuarioRol('usuario'));
    $this->getJson("/api/negocios/{$negocio->id}")
        ->assertJsonPath('negocio.horario_hoy', 'Hoy de 7:00 a. m. a 8:00 p. m.');
});

test('un horario con horas inválidas no se guarda', function () {
    $dueno = usuarioRol('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Panadería']);
    Sanctum::actingAs($dueno);

    $this->putJson("/api/negocios/{$negocio->id}", ['horario' => ['lun' => ['abre' => '7am', 'cierra' => '20:00']]])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['horario.lun.abre']);
});

// ---------------------------------------------------------------------------
// Suspensión de cuentas (admin)
// ---------------------------------------------------------------------------

test('el admin suspende y reactiva una cuenta', function () {
    $cliente = usuarioRol('usuario');
    $cliente->createToken('api');
    Sanctum::actingAs(usuarioRol('administrador'));

    $this->putJson("/api/admin/usuarios/{$cliente->id}/suspender", ['motivo' => 'Pedidos falsos'])->assertOk();
    expect($cliente->fresh()->suspendido_at)->not->toBeNull()
        ->and($cliente->tokens()->count())->toBe(0);

    $this->getJson('/api/admin/usuarios?rol=usuario')
        ->assertJsonPath('usuarios.0.suspendido', true)
        ->assertJsonPath('usuarios.0.motivo_suspension', 'Pedidos falsos');

    $this->putJson("/api/admin/usuarios/{$cliente->id}/reactivar")->assertOk();
    expect($cliente->fresh()->suspendido_at)->toBeNull();
});

test('el admin no puede suspenderse a sí mismo y un cliente no puede suspender', function () {
    $admin = usuarioRol('administrador');
    Sanctum::actingAs($admin);
    $this->putJson("/api/admin/usuarios/{$admin->id}/suspender", ['motivo' => 'x'])->assertStatus(422);

    Sanctum::actingAs(usuarioRol('usuario'));
    $this->putJson("/api/admin/usuarios/{$admin->id}/suspender", ['motivo' => 'x'])->assertForbidden();
});

// ---------------------------------------------------------------------------
// Listas paginadas
// ---------------------------------------------------------------------------

test('las listas del admin se paginan y se buscan', function () {
    foreach (range(1, 35) as $i) {
        usuarioRol('usuario');
    }
    $ana = User::factory()->create(['name' => 'Ana Buscable']);
    $ana->assignRole('usuario');
    Sanctum::actingAs(usuarioRol('administrador'));

    $this->getJson('/api/admin/usuarios?rol=usuario')
        ->assertJsonCount(30, 'usuarios')
        ->assertJsonPath('ultima_pagina', 2);
    $this->getJson('/api/admin/usuarios?rol=usuario&buscar=Buscable')
        ->assertJsonCount(1, 'usuarios')
        ->assertJsonPath('usuarios.0.id', $ana->id);

    usuarioRol('usuario')->negocio()->create(['nombre' => 'Ferretería El Tornillo']);
    $this->getJson('/api/admin/negocios?buscar=Tornillo')->assertJsonCount(1, 'negocios');
});

test('mis pedidos y el historial del domiciliario se paginan', function () {
    $cliente = usuarioRol('usuario');
    $domi = usuarioRol('domiciliario');
    $negocio = usuarioRol('usuario')->negocio()->create(['nombre' => 'Tienda']);
    foreach (range(1, 25) as $i) {
        $negocio->pedidos()->create([
            'user_id' => $cliente->id, 'domiciliario_id' => $domi->id, 'estado' => 'entregado',
            'metodo_pago' => 'efectivo', 'total' => 1000, 'direccion_entrega' => 'Calle 1',
        ]);
    }

    Sanctum::actingAs($cliente);
    $this->getJson('/api/pedidos')->assertJsonCount(20, 'pedidos')->assertJsonPath('ultima_pagina', 2);
    $this->getJson('/api/pedidos?page=2')->assertJsonCount(5, 'pedidos');

    Sanctum::actingAs($domi);
    $this->getJson('/api/domiciliario/historial')
        ->assertJsonCount(20, 'pedidos')
        ->assertJsonPath('ultima_pagina', 2)
        ->assertJsonPath('total', 25);
});
