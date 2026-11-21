<?php

use App\Models\User;
use App\Support\GoogleIdToken;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

/*
 * Entrar y registrarse con Google. Los tokens se firman aquí con una llave
 * RSA de prueba que se publica como si fuera la de Google (Http::fake): así
 * se prueba la verificación de verdad (firma, emisor, app y vencimiento).
 */

const GOOGLE_CLIENTE_PRUEBA = '1234-web.apps.googleusercontent.com';

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    config(['services.google.client_ids' => [GOOGLE_CLIENTE_PRUEBA]]);

    // Llave RSA solo para pruebas (en Windows PHP no siempre puede generarlas).
    $privada = file_get_contents(base_path('tests/fixtures/google/llave-prueba.pem'));
    $rsa = openssl_pkey_get_details(openssl_pkey_get_private($privada))['rsa'];
    $b64 = fn (string $bytes) => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    $this->llaveGoogle = $privada;

    Http::fake([GoogleIdToken::URL_LLAVES => Http::response([
        'keys' => [['kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => 'llave-1', 'n' => $b64($rsa['n']), 'e' => $b64($rsa['e'])]],
    ], 200, ['Cache-Control' => 'public, max-age=3600'])]);
});

/** ID token como el que Google le da a la app. */
function tokenGoogle(array $cambios = [], ?string $llave = null): string
{
    $ahora = time();

    return JWT::encode(array_merge([
        'iss' => 'https://accounts.google.com',
        'aud' => GOOGLE_CLIENTE_PRUEBA,
        'sub' => '109876543210',
        'email' => 'ana.perez@gmail.com',
        'email_verified' => true,
        'given_name' => 'Ana',
        'family_name' => 'Pérez',
        'iat' => $ahora,
        'exp' => $ahora + 3600,
    ], $cambios), $llave ?? test()->llaveGoogle, 'RS256', 'llave-1');
}

test('la primera vez devuelve los datos de Google sin crear la cuenta', function () {
    $this->postJson('/api/google', ['id_token' => tokenGoogle()])
        ->assertOk()
        ->assertJsonPath('nuevo', true)
        ->assertJsonPath('perfil.name', 'Ana')
        ->assertJsonPath('perfil.apellidos', 'Pérez')
        ->assertJsonPath('perfil.email', 'ana.perez@gmail.com')
        ->assertJsonMissing(['token']);

    expect(User::count())->toBe(0);
});

test('registrarse con Google exige aceptar la política de privacidad', function () {
    $this->postJson('/api/google', ['id_token' => tokenGoogle(), 'acepta_terminos' => false, 'name' => 'Ana', 'apellidos' => 'Pérez'])
        ->assertOk()->assertJsonPath('nuevo', true);

    expect(User::count())->toBe(0);
});

test('con la política aceptada y la clave crea la cuenta de cliente y entra', function () {
    $r = $this->postJson('/api/google', [
        'id_token' => tokenGoogle(), 'acepta_terminos' => true, 'name' => ' Ana María ', 'apellidos' => 'Pérez',
        'pin' => '2468', 'pin_confirmation' => '2468',
    ])->assertCreated()
        ->assertJsonPath('user.google', true)
        ->assertJsonPath('user.tiene_pin', true)
        ->assertJsonPath('user.name', 'Ana María')
        ->assertJsonPath('user.roles', ['usuario']);

    expect($r->json('token'))->toBeString()->and($r->json('dispositivo'))->toBeString();
    $user = User::firstOrFail();
    expect($user->google_id)->toBe('109876543210')
        ->and($user->password)->toBeNull()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->terminos_aceptados_at)->not->toBeNull()
        ->and($user->telefono)->toBeNull();
});

test('registrarse con Google exige crear una clave difícil de adivinar', function () {
    $datos = ['id_token' => tokenGoogle(), 'acepta_terminos' => true, 'name' => 'Ana', 'apellidos' => 'Pérez'];

    $this->postJson('/api/google', $datos)->assertStatus(422)->assertJsonValidationErrors(['pin']);
    $this->postJson('/api/google', $datos + ['pin' => '1111', 'pin_confirmation' => '1111'])->assertStatus(422)->assertJsonValidationErrors(['pin']);
    $this->postJson('/api/google', $datos + ['pin' => '2468', 'pin_confirmation' => '2469'])->assertStatus(422)->assertJsonValidationErrors(['pin']);
    expect(User::count())->toBe(0);
});

test('registrarse con Google exige nombre y apellidos', function () {
    $this->postJson('/api/google', ['id_token' => tokenGoogle(), 'acepta_terminos' => true, 'name' => '', 'apellidos' => ''])
        ->assertStatus(422)->assertJsonValidationErrors(['name', 'apellidos']);
});

test('con clave, Google pide la clave y luego entra, aunque cambie su correo en Google', function () {
    $user = User::factory()->conClave()->create(['email' => 'otro@correo.com']);
    $user->forceFill(['google_id' => '109876543210'])->save();
    $user->assignRole('usuario');

    $this->postJson('/api/google', ['id_token' => tokenGoogle()])
        ->assertOk()->assertJsonPath('requiere_pin', true)->assertJsonPath('user.name', $user->name)
        ->assertJsonMissingPath('token');

    $this->postJson('/api/google', ['id_token' => tokenGoogle(), 'pin' => '1357'])
        ->assertStatus(422)->assertJsonPath('errors.pin.0', 'La clave no es correcta. Te quedan 4 intentos.');

    $r = $this->postJson('/api/google', ['id_token' => tokenGoogle(), 'pin' => '2468'])
        ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonStructure(['token', 'dispositivo']);
    expect($user->fresh()->pin_fallidos)->toBe(0);

    // Google demostró quién es: en este teléfono ya entra solo con la clave.
    $this->postJson('/api/login', ['dispositivo' => $r->json('dispositivo'), 'pin' => '2468'])
        ->assertOk()->assertJsonPath('user.id', $user->id);
});

test('con Google se crea una clave nueva aunque esté bloqueada', function () {
    $user = User::factory()->conClave()->create(['pin_bloqueado_at' => now(), 'pin_fallidos' => 5]);
    $user->forceFill(['google_id' => '109876543210'])->save();
    $user->createToken('otro-telefono');

    $this->postJson('/api/password/google', ['id_token' => tokenGoogle(['sub' => '555']), 'pin' => '1357', 'pin_confirmation' => '1357'])
        ->assertStatus(422)->assertJsonValidationErrors(['id_token']);

    $this->postJson('/api/password/google', ['id_token' => tokenGoogle(), 'pin' => '1357', 'pin_confirmation' => '1357'])
        ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonStructure(['token', 'dispositivo']);

    $user->refresh();
    expect($user->pin_bloqueado_at)->toBeNull()->and($user->pin_fallidos)->toBe(0)
        ->and($user->tokens()->count())->toBe(1);
    $this->postJson('/api/google', ['id_token' => tokenGoogle(), 'pin' => '1357'])->assertOk();
});

test('un correo que ya tiene cuenta no se une solo a Google', function () {
    $user = User::factory()->create(['email' => 'ana.perez@gmail.com']);

    $this->postJson('/api/google', ['id_token' => tokenGoogle(), 'acepta_terminos' => true, 'name' => 'Ana', 'apellidos' => 'Pérez'])
        ->assertStatus(409)->assertJsonPath('codigo', 'correo_existente');

    expect($user->fresh()->google_id)->toBeNull()->and(User::count())->toBe(1);
});

test('una cuenta suspendida no entra con Google', function () {
    $user = User::factory()->create(['suspendido_at' => now()]);
    $user->forceFill(['google_id' => '109876543210'])->save();

    $this->postJson('/api/google', ['id_token' => tokenGoogle()])
        ->assertStatus(422)->assertJsonValidationErrors(['id_token']);
});

test('rechaza tokens falsos, vencidos, de otra app o sin correo confirmado', function (Closure $token) {
    $this->postJson('/api/google', ['id_token' => $token(), 'acepta_terminos' => true, 'name' => 'Ana', 'apellidos' => 'Pérez'])
        ->assertStatus(422)->assertJsonValidationErrors(['id_token']);

    expect(User::count())->toBe(0);
})->with([
    'firmado con otra llave' => fn () => fn () => tokenGoogle([], file_get_contents(base_path('tests/fixtures/google/otra-llave.pem'))),
    'vencido' => fn () => fn () => tokenGoogle(['iat' => time() - 7200, 'exp' => time() - 3600]),
    'de otra app' => fn () => fn () => tokenGoogle(['aud' => 'otra-app.apps.googleusercontent.com']),
    'de otro emisor' => fn () => fn () => tokenGoogle(['iss' => 'https://evil.example']),
    'correo sin confirmar' => fn () => fn () => tokenGoogle(['email_verified' => false]),
    'no es un token' => fn () => fn () => 'esto.no.sirve',
]);

test('sin GOOGLE_CLIENT_IDS entrar con Google está apagado', function () {
    config(['services.google.client_ids' => []]);

    $this->postJson('/api/google', ['id_token' => tokenGoogle()])->assertStatus(503);
});

// ---------------------------------------------------------------------------
// Conectar y desconectar desde «Mi información»
// ---------------------------------------------------------------------------

test('conectar Google a una cuenta existente le permite entrar con él', function () {
    $user = User::factory()->create(['email' => 'ana.perez@gmail.com', 'password' => 'clave-actual']);
    $user->assignRole('usuario');
    Sanctum::actingAs($user);

    $this->postJson('/api/perfil/google', ['id_token' => tokenGoogle()])
        ->assertOk()->assertJsonPath('user.google', true);

    $this->app['auth']->forgetGuards();
    $this->postJson('/api/google', ['id_token' => tokenGoogle()])->assertOk()->assertJsonPath('user.id', $user->id);
});

test('al conectar Google una cuenta sin correo toma el de Google', function () {
    $user = User::factory()->create(['email' => null, 'telefono' => '3001234567', 'telefono_verificado_at' => now()]);
    Sanctum::actingAs($user);

    $this->postJson('/api/perfil/google', ['id_token' => tokenGoogle()])->assertOk()
        ->assertJsonPath('user.email', 'ana.perez@gmail.com');
});

test('no se puede conectar una cuenta de Google que ya es de otra persona', function () {
    $duena = User::factory()->create();
    $duena->forceFill(['google_id' => '109876543210'])->save();
    $otro = User::factory()->create();
    Sanctum::actingAs($otro);

    $this->postJson('/api/perfil/google', ['id_token' => tokenGoogle()])
        ->assertStatus(422)->assertJsonValidationErrors(['id_token']);

    expect($otro->fresh()->google_id)->toBeNull();
});

test('desconectar Google exige el celular verificado y la clave', function () {
    $user = User::factory()->conClave()->create(['password' => null]);
    $user->forceFill(['google_id' => '109876543210'])->save();
    Sanctum::actingAs($user);

    // Sin celular verificado no podría volver a entrar desde otro teléfono.
    $this->deleteJson('/api/perfil/google', ['pin' => '2468'])->assertStatus(422)->assertJsonValidationErrors(['google']);

    $user->forceFill(['telefono' => '3001234567', 'telefono_verificado_at' => now()])->save();
    $this->deleteJson('/api/perfil/google')->assertStatus(422)->assertJsonValidationErrors(['pin']);
    $this->deleteJson('/api/perfil/google', ['pin' => '1357'])->assertStatus(422)->assertJsonValidationErrors(['pin']);
    $this->deleteJson('/api/perfil/google', ['pin' => '2468'])->assertOk()->assertJsonPath('user.google', false);
    expect($user->fresh()->google_id)->toBeNull();
});

// ---------------------------------------------------------------------------
// Eliminar la cuenta (con la clave)
// ---------------------------------------------------------------------------

test('quien se registró con Google elimina su cuenta con su clave', function () {
    $user = User::factory()->conClave()->create(['email' => 'ana.perez@gmail.com', 'password' => null]);
    $user->forceFill(['google_id' => '109876543210'])->save();
    $user->assignRole('usuario');
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['pin' => '1357'])->assertStatus(422)->assertJsonValidationErrors(['pin']);
    expect($user->fresh()->eliminado_at)->toBeNull();

    $this->deleteJson('/api/cuenta', ['pin' => '2468'])->assertOk();
    $user->refresh();
    expect($user->eliminado_at)->not->toBeNull()->and($user->google_id)->toBeNull();

    // Ya no entra con Google: se registraría de nuevo.
    $this->app['auth']->forgetGuards();
    $this->postJson('/api/google', ['id_token' => tokenGoogle()])->assertOk()->assertJsonPath('nuevo', true);
});
