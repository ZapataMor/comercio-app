<?php

use App\Models\CodigoTelefono;
use App\Models\DispositivoConfianza;
use App\Models\User;
use App\Rules\ClaveCuatro;
use App\Support\ClavePin;
use App\Support\Telefono\EnviadorCodigos;
use App\Support\Telefono\EnviadorLog;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

/*
 * Clave de 4 números (como Nequi) y teléfonos de confianza: ver
 * App\Support\ClavePin. Los códigos de WhatsApp salen por el canal de prueba,
 * que en las pruebas los devuelve en `codigo_prueba`.
 */

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    $this->app->instance(EnviadorCodigos::class, new EnviadorLog);
});

/** Cliente con celular verificado y clave 2468. */
function conClave(string $telefono = '3001234567', array $extra = []): User
{
    $user = User::factory()->conClave()->create($extra + ['password' => null, 'telefono' => $telefono, 'email' => null]);
    $user->forceFill(['telefono_verificado_at' => now()])->save();
    $user->assignRole('usuario');

    return $user;
}

/** Entra en un teléfono nuevo (clave + código) y devuelve el token del teléfono de confianza. */
function entrarEnTelefonoNuevo(string $telefono = '3001234567', string $pin = '2468'): string
{
    $codigo = test()->postJson('/api/login', ['telefono' => $telefono, 'pin' => $pin])
        ->assertOk()->assertJsonPath('requiere_codigo', true)->json('codigo_prueba');

    return test()->postJson('/api/login/codigo', ['telefono' => $telefono, 'pin' => $pin, 'codigo' => $codigo])
        ->assertOk()->json('dispositivo');
}

// ---------------------------------------------------------------------------
// Qué claves sirven
// ---------------------------------------------------------------------------

test('las claves fáciles de adivinar no sirven', function ($clave) {
    expect(ClaveCuatro::motivoDebil($clave))->not->toBeNull();
})->with(['0000', '7777', '1234', '3456', '6789', '0123', '4321', '9876', '1212', '9090', '1004', '2000']);

test('las demás claves de 4 números sí sirven', function ($clave) {
    expect(ClaveCuatro::motivoDebil($clave))->toBeNull();
})->with(['2468', '1357', '8024', '5193', '0472']);

test('la clave se guarda cifrada y nunca sale en las respuestas', function () {
    $user = conClave();
    Sanctum::actingAs($user);

    expect($user->fresh()->getRawOriginal('pin'))->not->toBe('2468')
        ->and(Hash::check('2468', $user->fresh()->pin))->toBeTrue();
    $this->getJson('/api/user')->assertOk()->assertJsonMissingPath('pin');
});

// ---------------------------------------------------------------------------
// Entrar con el celular y la clave
// ---------------------------------------------------------------------------

test('en un teléfono nuevo, tras la clave llega un código y con él queda de confianza', function () {
    $user = conClave();

    $r = $this->postJson('/api/login', ['telefono' => '+57 300 123 4567', 'pin' => '2468'])
        ->assertOk()
        ->assertJsonPath('requiere_codigo', true)
        ->assertJsonPath('telefono', '3001234567')
        ->assertJsonPath('espera', 60)
        ->assertJsonMissingPath('token');
    $codigo = $r->json('codigo_prueba');
    expect($codigo)->toMatch('/^\d{6}$/');

    $sesion = $this->postJson('/api/login/codigo', ['telefono' => '3001234567', 'pin' => '2468', 'codigo' => $codigo, 'nombre_dispositivo' => 'Pixel 6'])
        ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonPath('user.tiene_pin', true)
        ->assertJsonStructure(['token', 'dispositivo']);
    expect($user->dispositivosConfianza()->value('nombre'))->toBe('Pixel 6');

    // En ese teléfono ya entra solo con la clave.
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468', 'dispositivo' => $sesion->json('dispositivo')])
        ->assertOk()->assertJsonMissingPath('requiere_codigo')->assertJsonPath('dispositivo', $sesion->json('dispositivo'));
});

test('el código solo se envía después de acertar la clave', function () {
    conClave();

    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '1357'])
        ->assertStatus(422)->assertJsonPath('errors.pin.0', 'La clave no es correcta. Te quedan 4 intentos.');
    expect(CodigoTelefono::count())->toBe(0);
});

test('volver a entrar antes de un minuto no envía otro código: sirve el anterior', function () {
    conClave();
    $primero = $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468'])->json('codigo_prueba');

    $this->travel(20)->seconds();
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468'])
        ->assertOk()->assertJsonPath('requiere_codigo', true)->assertJsonMissingPath('codigo_prueba')
        ->assertJsonPath('message', 'Escribe el código que te enviamos por WhatsApp.');

    $this->postJson('/api/login/codigo', ['telefono' => '3001234567', 'pin' => '2468', 'codigo' => $primero])->assertOk();
});

test('el código de entrar pide otra vez la clave y no sirve el de recuperar', function () {
    conClave();
    $codigo = $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468'])->json('codigo_prueba');

    $this->postJson('/api/login/codigo', ['telefono' => '3001234567', 'pin' => '1357', 'codigo' => $codigo])
        ->assertStatus(422)->assertJsonValidationErrors('pin');

    $this->travel(61)->seconds();
    $deRecuperar = $this->postJson('/api/password/codigo', ['telefono' => '3001234567'])->json('codigo_prueba');
    if ($deRecuperar !== $codigo) {
        $this->postJson('/api/login/codigo', ['telefono' => '3001234567', 'pin' => '2468', 'codigo' => $deRecuperar])
            ->assertStatus(422)->assertJsonValidationErrors('codigo');
    }
});

test('el teléfono de confianza de otra cuenta no evita el código', function () {
    conClave('3001234567');
    $ajeno = ClavePin::confiar(conClave('3109998877'));

    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468', 'dispositivo' => $ajeno])
        ->assertOk()->assertJsonPath('requiere_codigo', true);
});

test('un celular sin cuenta verificada o una cuenta sin clave reciben un aviso claro', function () {
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468'])
        ->assertStatus(422)->assertJsonValidationErrors('telefono');

    $user = User::factory()->create(['telefono' => '3001234567', 'telefono_verificado_at' => now()]);
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468'])
        ->assertStatus(422)->assertJsonPath('errors.pin.0', 'Aún no tienes clave de 4 números. Créala para continuar.');
});

test('una cuenta suspendida no entra aunque acierte la clave', function () {
    conClave(extra: ['suspendido_at' => now(), 'motivo_suspension' => 'Pedidos falsos']);

    $r = $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468'])->assertStatus(422);
    expect($r->json('errors.telefono.0'))->toContain('suspendida');
});

// ---------------------------------------------------------------------------
// Bloqueo a los 5 intentos
// ---------------------------------------------------------------------------

test('cinco claves equivocadas seguidas la bloquean, aunque luego se acierte', function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    $user = conClave();
    $dispositivo = ClavePin::confiar($user);

    foreach ([4, 3, 2] as $quedan) {
        $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '1357'])
            ->assertStatus(422)->assertJsonPath('errors.pin.0', "La clave no es correcta. Te quedan {$quedan} intentos.");
    }
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '1357'])
        ->assertStatus(422)->assertJsonPath('errors.pin.0', 'La clave no es correcta. Te queda 1 intento antes de que se bloquee.');
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '1357'])
        ->assertStatus(423)->assertJsonPath('codigo', 'clave_bloqueada');

    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468', 'dispositivo' => $dispositivo])
        ->assertStatus(423)->assertJsonPath('codigo', 'clave_bloqueada');
    $this->postJson('/api/login', ['dispositivo' => $dispositivo, 'pin' => '2468'])->assertStatus(423);
    expect($user->fresh()->pin_bloqueado_at)->not->toBeNull();
});

test('acertar la clave reinicia la cuenta de intentos', function () {
    $user = conClave();
    $dispositivo = ClavePin::confiar($user);

    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '1357'])->assertStatus(422);
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '1357'])->assertStatus(422);
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468', 'dispositivo' => $dispositivo])->assertOk();

    expect($user->fresh()->pin_fallidos)->toBe(0);
});

test('las acciones que piden la clave también cuentan para el bloqueo', function () {
    $user = conClave(extra: ['pin_fallidos' => 4]);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['pin' => '1357'])->assertStatus(423);
    expect($user->fresh()->eliminado_at)->toBeNull();
});

// ---------------------------------------------------------------------------
// «Continuar como» en un teléfono de confianza
// ---------------------------------------------------------------------------

test('con el teléfono de confianza basta la clave, también para cuentas de Google sin celular', function () {
    $user = User::factory()->conClave()->create(['password' => null]);
    $user->forceFill(['google_id' => '109876543210'])->save();
    $dispositivo = ClavePin::confiar($user, 'Pixel 6');

    $this->postJson('/api/login', ['dispositivo' => $dispositivo, 'pin' => '1357'])
        ->assertStatus(422)->assertJsonValidationErrors('pin');
    $this->postJson('/api/login', ['dispositivo' => $dispositivo, 'pin' => '2468'])
        ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonPath('dispositivo', $dispositivo);
});

test('un teléfono desconocido o sin usar en 180 días vuelve a pedir el celular o Google', function () {
    $user = conClave();
    $dispositivo = ClavePin::confiar($user);

    $this->postJson('/api/login', ['dispositivo' => 'inventado', 'pin' => '2468'])
        ->assertStatus(422)->assertJsonPath('codigo', 'dispositivo_desconocido');

    $this->travel(ClavePin::DIAS_DISPOSITIVO + 1)->days();
    $this->postJson('/api/login', ['dispositivo' => $dispositivo, 'pin' => '2468'])
        ->assertStatus(422)->assertJsonPath('codigo', 'dispositivo_desconocido');
    expect(DispositivoConfianza::count())->toBe(0);
});

test('cada cuenta conserva solo sus 10 teléfonos de confianza más recientes', function () {
    $user = conClave();
    $primero = ClavePin::confiar($user);
    foreach (range(1, ClavePin::MAX_DISPOSITIVOS) as $i) {
        $this->travel(1)->minutes();
        ClavePin::confiar($user);
    }

    expect($user->dispositivosConfianza()->count())->toBe(ClavePin::MAX_DISPOSITIVOS)
        ->and(ClavePin::dispositivo($primero))->toBeNull();
});

// ---------------------------------------------------------------------------
// Cambiar la clave y acciones que la piden
// ---------------------------------------------------------------------------

test('cambiar la clave pide la actual, no acepta la misma y cierra las demás sesiones', function () {
    $user = conClave();
    $otra = $user->createToken('otro-telefono')->plainTextToken;
    $actual = $user->createToken('este-telefono')->plainTextToken;

    $this->withToken($actual)->postJson('/api/perfil/clave', ['pin' => '1357', 'pin_confirmation' => '1357'])
        ->assertStatus(422)->assertJsonValidationErrors('pin_actual');
    $this->withToken($actual)->postJson('/api/perfil/clave', ['pin_actual' => '9753', 'pin' => '1357', 'pin_confirmation' => '1357'])
        ->assertStatus(422)->assertJsonValidationErrors('pin_actual');
    $this->withToken($actual)->postJson('/api/perfil/clave', ['pin_actual' => '2468', 'pin' => '2468', 'pin_confirmation' => '2468'])
        ->assertStatus(422)->assertJsonPath('errors.pin.0', 'La clave nueva es igual a la actual.');
    $this->withToken($actual)->postJson('/api/perfil/clave', ['pin_actual' => '2468', 'pin' => '1357', 'pin_confirmation' => '1357'])
        ->assertOk();

    expect(Hash::check('1357', $user->fresh()->pin))->toBeTrue()
        ->and($user->fresh()->pin_fallidos)->toBe(0)
        ->and($user->tokens()->count())->toBe(1);
    $this->app['auth']->forgetGuards();
    $this->withToken($otra)->getJson('/api/user')->assertUnauthorized();
});

test('la app puede revisar la clave antes de una acción en dos pasos', function () {
    Sanctum::actingAs(conClave());

    $this->postJson('/api/perfil/clave/comprobar', ['pin' => '1357'])->assertStatus(422)->assertJsonValidationErrors('pin');
    $this->postJson('/api/perfil/clave/comprobar', ['pin' => '2468'])->assertOk();
});

test('cambiar el celular verificado pide la clave; agregar el primero no', function () {
    $user = conClave();
    Sanctum::actingAs($user);

    $this->postJson('/api/perfil/telefono/codigo', ['telefono' => '3109998877'])->assertStatus(422)->assertJsonValidationErrors('pin');
    $codigo = $this->postJson('/api/perfil/telefono/codigo', ['telefono' => '3109998877', 'pin' => '2468'])->assertOk()->json('codigo_prueba');
    $this->postJson('/api/perfil/telefono/verificar', ['telefono' => '3109998877', 'codigo' => $codigo])
        ->assertOk()->assertJsonPath('user.telefono', '3109998877');

    $google = User::factory()->conClave()->create(['telefono' => null]);
    Sanctum::actingAs($google);
    $this->postJson('/api/perfil/telefono/codigo', ['telefono' => '3205556677'])->assertOk();
});
