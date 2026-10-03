<?php

use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use App\Models\User;
use App\Notifications\InvitacionTrabajoRecibida;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'comerciante', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    Notification::fake();
});

/** Usuario 'usuario' (sin autenticar). */
function persona(): User
{
    $user = User::factory()->create();
    $user->assignRole('usuario');

    return $user;
}

/** Negocio con su propietario. */
function negocioDe(User $dueno, string $nombre = 'La Espiga'): Negocio
{
    return $dueno->negocio()->create(['nombre' => $nombre]);
}

/** Vincula a alguien como trabajador activo (atajo para los tests). */
function hacerTrabajador(Negocio $negocio, User $user): void
{
    $negocio->miembros()->attach($user->id, ['rol' => Negocio::ROL_TRABAJADOR, 'activo' => true]);
}

// ---------------------------------------------------------------------------
// Código público e invitaciones (lado del propietario)
// ---------------------------------------------------------------------------

test('todo usuario nuevo recibe un código público único', function () {
    $a = persona();
    $b = persona();

    expect($a->codigo_publico)->toMatch('/^U[2-9A-HJKMNP-Z]{5}$/')
        ->and($a->codigo_publico)->not->toBe($b->codigo_publico);
});

test('resolver un código muestra solo el nombre de la persona', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $invitado = persona();
    Sanctum::actingAs($dueno);

    // Acepta '#', espacios y minúsculas.
    $this->postJson("/api/negocios/{$negocio->id}/resolver-codigo", ['codigo' => ' #'.strtolower($invitado->codigo_publico)])
        ->assertOk()
        ->assertJsonPath('usuario.name', $invitado->name)
        ->assertJsonMissingPath('usuario.email');

    $this->postJson("/api/negocios/{$negocio->id}/resolver-codigo", ['codigo' => 'UZZZZZ'])
        ->assertStatus(404);
});

test('el propietario invita por código y el invitado recibe un push', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $invitado = persona();
    Sanctum::actingAs($dueno);

    $this->postJson("/api/negocios/{$negocio->id}/invitar", ['codigo' => $invitado->codigo_publico])
        ->assertStatus(201);

    $this->assertDatabaseHas('invitaciones_trabajo', [
        'negocio_id' => $negocio->id,
        'user_id' => $invitado->id,
        'estado' => InvitacionTrabajo::PENDIENTE,
    ]);
    // La invitación NO lo vincula todavía.
    expect($negocio->esMiembroActivo($invitado))->toBeFalse();
    Notification::assertSentTo($invitado, InvitacionTrabajoRecibida::class);
});

test('no se puede invitar dos veces ni a uno mismo ni a un miembro', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $invitado = persona();
    $miembro = persona();
    hacerTrabajador($negocio, $miembro);
    Sanctum::actingAs($dueno);

    $url = "/api/negocios/{$negocio->id}/invitar";
    $this->postJson($url, ['codigo' => $invitado->codigo_publico])->assertStatus(201);
    $this->postJson($url, ['codigo' => $invitado->codigo_publico])->assertStatus(409);
    $this->postJson($url, ['codigo' => $dueno->codigo_publico])->assertStatus(422);
    $this->postJson($url, ['codigo' => $miembro->codigo_publico])->assertStatus(409);
});

test('un trabajador no puede invitar', function () {
    $negocio = negocioDe(persona());
    $trabajador = persona();
    hacerTrabajador($negocio, $trabajador);
    Sanctum::actingAs($trabajador);

    $this->postJson("/api/negocios/{$negocio->id}/invitar", ['codigo' => persona()->codigo_publico])
        ->assertStatus(403);
});

test('el propietario ve el equipo y las invitaciones pendientes, y puede cancelarlas', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $trabajador = persona();
    hacerTrabajador($negocio, $trabajador);
    $pendiente = $negocio->invitaciones()->create([
        'user_id' => persona()->id,
        'invitado_por' => $dueno->id,
        'estado' => InvitacionTrabajo::PENDIENTE,
    ]);
    Sanctum::actingAs($dueno);

    $this->getJson("/api/negocios/{$negocio->id}/miembros")
        ->assertOk()
        ->assertJsonCount(2, 'miembros')
        ->assertJsonPath('miembros.0.rol', Negocio::ROL_PROPIETARIO)
        ->assertJsonPath('miembros.0.es_yo', true)
        ->assertJsonCount(1, 'invitaciones_pendientes');

    $this->deleteJson("/api/negocios/{$negocio->id}/invitaciones/{$pendiente->id}")->assertOk();
    $this->assertDatabaseMissing('invitaciones_trabajo', ['id' => $pendiente->id]);
});

// ---------------------------------------------------------------------------
// Lado del invitado
// ---------------------------------------------------------------------------

test('el invitado ve sus invitaciones y al aceptar queda como trabajador', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno, 'Droguería Salud');
    $invitado = persona();
    $inv = $negocio->invitaciones()->create([
        'user_id' => $invitado->id,
        'invitado_por' => $dueno->id,
        'estado' => InvitacionTrabajo::PENDIENTE,
    ]);
    Sanctum::actingAs($invitado);

    $this->getJson('/api/invitaciones')
        ->assertOk()
        ->assertJsonPath('invitaciones.0.negocio', 'Droguería Salud')
        ->assertJsonPath('invitaciones.0.invitado_por', $dueno->name);

    $this->putJson("/api/invitaciones/{$inv->id}/aceptar")
        ->assertOk()
        ->assertJsonPath('negocio.rol', Negocio::ROL_TRABAJADOR);

    expect($negocio->esMiembroActivo($invitado))->toBeTrue()
        ->and($negocio->esPropietario($invitado))->toBeFalse();

    // Ya puede gestionar el catálogo y aparece en "mis negocios".
    $this->getJson("/api/negocios/{$negocio->id}/productos")->assertOk();
    $this->getJson('/api/negocios/mios')
        ->assertJsonPath('negocios.0.nombre', 'Droguería Salud')
        ->assertJsonPath('negocios.0.rol', Negocio::ROL_TRABAJADOR);

    // Una invitación ya respondida no se puede volver a usar.
    $this->putJson("/api/invitaciones/{$inv->id}/aceptar")->assertStatus(404);
});

test('rechazar una invitación no crea membresía', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $invitado = persona();
    $inv = $negocio->invitaciones()->create([
        'user_id' => $invitado->id,
        'invitado_por' => $dueno->id,
        'estado' => InvitacionTrabajo::PENDIENTE,
    ]);
    Sanctum::actingAs($invitado);

    $this->putJson("/api/invitaciones/{$inv->id}/rechazar")->assertOk();

    expect($negocio->esMiembroActivo($invitado))->toBeFalse();
    $this->assertDatabaseHas('invitaciones_trabajo', ['id' => $inv->id, 'estado' => InvitacionTrabajo::RECHAZADA]);
});

test('nadie puede aceptar la invitación de otra persona', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $inv = $negocio->invitaciones()->create([
        'user_id' => persona()->id,
        'invitado_por' => $dueno->id,
        'estado' => InvitacionTrabajo::PENDIENTE,
    ]);
    $intruso = persona();
    Sanctum::actingAs($intruso);

    $this->putJson("/api/invitaciones/{$inv->id}/aceptar")->assertStatus(404);
    expect($negocio->esMiembroActivo($intruso))->toBeFalse();
});

// ---------------------------------------------------------------------------
// Quitar / salir
// ---------------------------------------------------------------------------

test('el propietario quita a un trabajador pero nunca a un propietario', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $trabajador = persona();
    hacerTrabajador($negocio, $trabajador);
    Sanctum::actingAs($dueno);

    $this->deleteJson("/api/negocios/{$negocio->id}/miembros/{$dueno->id}")->assertStatus(422);
    $this->deleteJson("/api/negocios/{$negocio->id}/miembros/{$trabajador->id}")->assertOk();

    expect($negocio->esMiembroActivo($trabajador))->toBeFalse();
});

test('un trabajador puede salir del negocio, el propietario no', function () {
    $dueno = persona();
    $negocio = negocioDe($dueno);
    $trabajador = persona();
    hacerTrabajador($negocio, $trabajador);

    Sanctum::actingAs($trabajador);
    $this->postJson("/api/negocios/{$negocio->id}/salir")->assertOk();
    expect($negocio->esMiembroActivo($trabajador))->toBeFalse();

    Sanctum::actingAs($dueno);
    $this->postJson("/api/negocios/{$negocio->id}/salir")->assertStatus(422);
});

test('el login devuelve mis negocios con mi rol en cada uno', function () {
    $user = User::factory()->create(['password' => 'password123']);
    $user->assignRole('usuario');
    negocioDe($user, 'Mío');
    hacerTrabajador(negocioDe(persona(), 'Ajeno'), $user);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password123'])
        ->assertOk()
        ->assertJsonPath('user.codigo_publico', $user->codigo_publico)
        ->assertJsonCount(2, 'user.negocios');
});
