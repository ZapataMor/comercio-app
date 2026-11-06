<?php

use App\Models\Negocio;
use App\Models\User;
use App\Support\Festivos;
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

test('el horario avisa solo en los últimos 10 minutos antes de cerrar', function () {
    $semana = ['lun' => ['abre' => '07:00', 'cierra' => '20:00']];
    $lunes = Carbon::parse('2026-11-09 19:49:30'); // no festivo

    expect(HorarioNegocio::minutosParaCerrar($semana, $lunes))->toBeNull()
        ->and(HorarioNegocio::minutosParaCerrar($semana, $lunes->copy()->setTime(19, 50)))->toBe(10)
        ->and(HorarioNegocio::minutosParaCerrar($semana, $lunes->copy()->setTime(19, 58, 30)))->toBe(2)
        ->and(HorarioNegocio::minutosParaCerrar($semana, $lunes->copy()->setTime(20, 0)))->toBeNull()
        ->and(HorarioNegocio::minutosParaCerrar(null, $lunes))->toBeNull();
});

test('el aviso de cierre funciona pasando la medianoche y sin falsas alarmas', function () {
    $bar = ['lun' => ['abre' => '18:00', 'cierra' => '02:00']];
    $martes = Carbon::parse('2026-11-10 01:55:00');
    expect(HorarioNegocio::minutosParaCerrar($bar, $martes))->toBe(5);

    // Sigue abierto al día siguiente: a medianoche no cierra de verdad.
    $seguido = [
        'lun' => ['abre' => '08:00', 'cierra' => '00:00'],
        'mar' => ['abre' => '00:00', 'cierra' => '12:00'],
    ];
    expect(HorarioNegocio::minutosParaCerrar($seguido, Carbon::parse('2026-11-09 23:55:00')))->toBeNull();
});

function negocioConCierre(User $dueno): Negocio
{
    return Negocio::forceCreate([
        'user_id' => $dueno->id,
        'nombre' => 'Tienda',
        'activo' => true,
        'activo_cambiado_at' => '2026-11-09 07:00:00',
        'horario' => ['lun' => ['abre' => '07:00', 'cierra' => '20:00']],
    ]);
}

test('al dueño se le pregunta solo en los últimos 20 minutos y una vez', function () {
    $dueno = usuarioRol('usuario');
    $negocio = negocioConCierre($dueno);
    Sanctum::actingAs($dueno);

    Carbon::setTestNow('2026-11-09 19:39:00');
    $this->getJson('/api/negocios/mios/por-cerrar')->assertOk()->assertJsonCount(0, 'cierres');

    Carbon::setTestNow('2026-11-09 19:40:00');
    $this->getJson('/api/negocios/mios/por-cerrar')
        ->assertJsonPath('cierres.0.id', $negocio->id)
        ->assertJsonPath('cierres.0.cierra_texto', '8:00 p. m.');

    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => null])->assertOk();
    $this->getJson('/api/negocios/mios/por-cerrar')->assertJsonCount(0, 'cierres');

    // Decir que sí no cambia nada: cierra a su hora.
    Carbon::setTestNow('2026-11-09 20:00:00');
    expect(HorarioNegocio::aplicar($negocio->fresh(), now()))->toBeTrue()
        ->and($negocio->fresh()->activo)->toBeFalse();

    Carbon::setTestNow();
});

test('otra hora vale solo ese día y no toca el horario', function () {
    $dueno = usuarioRol('usuario');
    $negocio = negocioConCierre($dueno);
    $horario = $negocio->fresh()->horario;
    Sanctum::actingAs($dueno);

    Carbon::setTestNow('2026-11-09 19:45:00');
    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => '21:30'])->assertOk();
    expect($negocio->fresh()->horario)->toBe($horario);

    // A la hora del horario no cierra, y al cliente se le dice la hora nueva.
    Carbon::setTestNow('2026-11-09 20:01:00');
    expect(HorarioNegocio::aplicar($negocio->fresh(), now()))->toBeFalse();
    $this->getJson("/api/negocios/{$negocio->id}")
        ->assertJsonPath('negocio.horario_hoy', 'Hoy cierra a las 9:30 p. m.')
        ->assertJsonPath('negocio.minutos_para_cerrar', null);

    // El aviso al cliente sigue la hora nueva.
    Carbon::setTestNow('2026-11-09 21:25:00');
    $this->getJson("/api/negocios/{$negocio->id}")->assertJsonPath('negocio.minutos_para_cerrar', 5);

    Carbon::setTestNow('2026-11-09 21:30:00');
    expect(HorarioNegocio::aplicar($negocio->fresh(), now()))->toBeTrue()
        ->and($negocio->fresh()->activo)->toBeFalse();

    // Otro lunes vuelve a cerrar a las 8:00 y se pregunta otra vez.
    $negocio->fresh()->update(['activo' => true]);
    Carbon::setTestNow('2026-11-23 19:45:00');
    $this->getJson('/api/negocios/mios/por-cerrar')->assertJsonPath('cierres.0.cierra_texto', '8:00 p. m.');
    $this->getJson("/api/negocios/{$negocio->id}")->assertJsonPath('negocio.horario_hoy', 'Hoy de 7:00 a. m. a 8:00 p. m.');

    Carbon::setTestNow('2026-11-23 20:00:00');
    expect(HorarioNegocio::aplicar($negocio->fresh(), now()))->toBeTrue();

    Carbon::setTestNow();
});

test('también se puede cerrar más temprano y pasar de medianoche', function () {
    $dueno = usuarioRol('usuario');
    $negocio = negocioConCierre($dueno);
    Sanctum::actingAs($dueno);

    Carbon::setTestNow('2026-11-09 19:45:00');
    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => '19:50'])->assertOk();
    Carbon::setTestNow('2026-11-09 19:50:00');
    expect(HorarioNegocio::aplicar($negocio->fresh(), now()))->toBeTrue();

    $negocio->fresh()->forceFill(['activo' => true, 'cierre_original' => null, 'cierre_ajustado' => null, 'activo_cambiado_at' => '2026-11-09 07:00:00'])->save();
    Carbon::setTestNow('2026-11-09 19:45:00');
    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => '01:00'])->assertOk();
    expect($negocio->fresh()->cierre_ajustado->toDateTimeString())->toBe('2026-11-10 01:00:00');

    Carbon::setTestNow();
});

test('una hora que ya pasó o muy lejana se rechaza', function () {
    $dueno = usuarioRol('usuario');
    $negocio = negocioConCierre($dueno);
    Sanctum::actingAs($dueno);

    Carbon::setTestNow('2026-11-09 19:45:00');
    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => '19:00'])->assertUnprocessable();
    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => '25:00'])->assertUnprocessable();

    Carbon::setTestNow();
});

test('el cierre solo lo confirma el propietario y solo dentro de los 20 minutos', function () {
    $dueno = usuarioRol('usuario');
    $negocio = negocioConCierre($dueno);

    Sanctum::actingAs(usuarioRol('usuario'));
    Carbon::setTestNow('2026-11-09 19:45:00');
    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => null])->assertForbidden();
    $this->getJson('/api/negocios/mios/por-cerrar')->assertJsonCount(0, 'cierres');

    Sanctum::actingAs($dueno);
    Carbon::setTestNow('2026-11-09 15:00:00');
    $this->putJson("/api/negocios/mios/{$negocio->id}/cierre", ['hora' => null])->assertStatus(409);

    Carbon::setTestNow();
});

test('el catálogo dice cuánto falta para cerrar solo si está abierto', function () {
    Carbon::setTestNow('2026-11-09 19:55:00');
    $negocio = Negocio::forceCreate([
        'user_id' => usuarioRol('usuario')->id,
        'nombre' => 'Tienda',
        'activo' => true,
        'horario' => ['lun' => ['abre' => '07:00', 'cierra' => '20:00']],
    ]);

    Sanctum::actingAs(User::factory()->create());
    $this->getJson("/api/negocios/{$negocio->id}")->assertJsonPath('negocio.minutos_para_cerrar', 5);

    $negocio->update(['activo' => false]);
    $this->getJson("/api/negocios/{$negocio->id}")->assertJsonPath('negocio.minutos_para_cerrar', null);

    Carbon::setTestNow();
});

test('el horario dice si debe estar abierto, incluso pasando la medianoche', function () {
    $semana = horarioSemana();
    $lunes = Carbon::parse('2026-11-09 10:00'); // lunes (no festivo)

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

    $this->travelTo(Carbon::parse('2026-11-09 07:01'));
    $this->artisan('negocios:aplicar-horario')->assertSuccessful();
    expect($negocio->fresh()->activo)->toBeTrue();

    $this->travelTo(Carbon::parse('2026-11-09 20:01'));
    $this->artisan('negocios:aplicar-horario')->assertSuccessful();
    expect($negocio->fresh()->activo)->toBeFalse();
});

test('abrir a mano fuera de horario se respeta hasta la siguiente hora del horario', function () {
    $dueno = usuarioRol('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Panadería', 'activo' => false, 'horario' => horarioSemana()]);

    // Lunes 21:00 (ya cerró): el dueño abre a mano.
    $this->travelTo(Carbon::parse('2026-11-09 21:00'));
    Sanctum::actingAs($dueno);
    $this->putJson("/api/negocios/{$negocio->id}", ['activo' => true])->assertOk();

    $this->travelTo(Carbon::parse('2026-11-09 22:00'));
    $this->artisan('negocios:aplicar-horario');
    expect($negocio->fresh()->activo)->toBeTrue();

    // El martes a las 07:00 manda el horario (abierto) y a las 20:00 cierra.
    $this->travelTo(Carbon::parse('2026-11-10 20:05'));
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

    $this->travelTo(Carbon::parse('2026-11-09 10:00'));
    Sanctum::actingAs(usuarioRol('usuario'));
    $this->getJson("/api/negocios/{$negocio->id}")
        ->assertJsonPath('negocio.horario_hoy', 'Hoy de 7:00 a. m. a 8:00 p. m.');
});

// ---------------------------------------------------------------------------
// Festivos
// ---------------------------------------------------------------------------

test('conoce los festivos de Colombia, con los que se corren al lunes', function () {
    expect(array_keys(Festivos::delAnio(2026)))->toEqualCanonicalizing([
        '01-01', '01-12', '03-23', '04-02', '04-03', '05-01', '05-18', '06-08', '06-15',
        '06-29', '07-20', '08-07', '08-17', '10-12', '11-02', '11-16', '12-08', '12-25',
    ]);
    expect(Festivos::esFestivo(Carbon::parse('2026-11-16')))->toBeTrue()
        ->and(Festivos::esFestivo(Carbon::parse('2026-11-11')))->toBeFalse(); // se corrió al lunes 16
});

test('en festivo rige el horario de festivos', function () {
    $semana = horarioSemana() + ['fes' => ['abre' => '08:00', 'cierra' => '13:00']];
    $festivo = Carbon::parse('2026-11-16 10:00'); // lunes festivo

    expect(HorarioNegocio::deberiaEstarAbierto($semana, $festivo))->toBeTrue()
        ->and(HorarioNegocio::deberiaEstarAbierto($semana, $festivo->copy()->setTime(15, 0)))->toBeFalse()
        ->and(HorarioNegocio::textoHoy($semana, $festivo))->toBe('Hoy es festivo: de 8:00 a. m. a 1:00 p. m.');

    $cierraFestivos = horarioSemana() + ['fes' => null];
    expect(HorarioNegocio::deberiaEstarAbierto($cierraFestivos, $festivo))->toBeFalse()
        ->and(HorarioNegocio::textoHoy($cierraFestivos, $festivo))->toBe('Hoy es festivo y no abre');
});

test('un horario de antes de los festivos abre en festivo como el domingo', function () {
    $semana = horarioSemana(); // sin 'fes'; el domingo no abre
    $semana['dom'] = ['abre' => '09:00', 'cierra' => '12:00'];

    expect(HorarioNegocio::normalizar($semana)['fes'])->toBe(['abre' => '09:00', 'cierra' => '12:00'])
        ->and(HorarioNegocio::deberiaEstarAbierto($semana, Carbon::parse('2026-11-16 10:00')))->toBeTrue()
        ->and(HorarioNegocio::deberiaEstarAbierto($semana, Carbon::parse('2026-11-16 15:00')))->toBeFalse();
});

test('el propietario guarda el horario de festivos', function () {
    $dueno = usuarioRol('usuario');
    $negocio = $dueno->negocio()->create(['nombre' => 'Panadería', 'activo' => true]);
    Sanctum::actingAs($dueno);

    $horario = horarioSemana() + ['fes' => ['abre' => '08:00', 'cierra' => '13:00']];
    $this->putJson("/api/negocios/{$negocio->id}", ['horario' => json_encode($horario)])
        ->assertOk()
        ->assertJsonPath('negocio.horario.fes.abre', '08:00')
        ->assertJsonPath('negocio.horario.fes.cierra', '13:00');

    $this->putJson("/api/negocios/{$negocio->id}", ['horario' => ['fes' => ['abre' => '8am', 'cierra' => '13:00']]])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['horario.fes.abre']);
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
