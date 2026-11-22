<?php

use App\Models\Negocio;
use App\Models\User;
use App\Support\Telefono\EnviadorCodigos;
use App\Support\Telefono\EnviadorLog;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

function clienteCuenta(): User
{
    $user = User::factory()->conClave()->create([
        'password' => 'clave-actual',
        'telefono' => '3001112233',
        'direccion' => 'Calle 1 #10-20',
        'barrio' => 'Centro',
    ]);
    $user->assignRole('usuario');

    return $user;
}

function datosRegistro(array $extra = []): array
{
    return [
        'name' => 'Ana', 'apellidos' => 'Pérez', 'email' => 'ana@correo.com',
        'pin' => '2468', 'pin_confirmation' => '2468',
        'direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro', 'telefono' => '3001234567',
        'verificacion' => verificacionTelefono('3001234567'),
    ] + $extra;
}

// ---------------------------------------------------------------------------
// Registro: autorización de datos
// ---------------------------------------------------------------------------

test('registrarse exige aceptar la política de privacidad', function () {
    $this->postJson('/api/register', datosRegistro())
        ->assertStatus(422)->assertJsonValidationErrors(['acepta_terminos']);
});

test('el registro guarda cuándo se aceptó la política', function () {
    $this->postJson('/api/register', datosRegistro(['acepta_terminos' => true]))->assertCreated();

    expect(User::where('email', 'ana@correo.com')->first()->terminos_aceptados_at)->not->toBeNull();
});

// ---------------------------------------------------------------------------
// Eliminar cuenta
// ---------------------------------------------------------------------------

test('eliminar la cuenta exige la clave correcta', function () {
    Sanctum::actingAs(clienteCuenta());

    $this->deleteJson('/api/cuenta', ['password' => 'clave-actual'])
        ->assertStatus(422)->assertJsonValidationErrors(['pin']);
    $this->deleteJson('/api/cuenta', ['pin' => '1357'])
        ->assertStatus(422)->assertJsonValidationErrors(['pin']);
});

test('eliminar la cuenta anonimiza los datos y conserva los pedidos', function () {
    $user = clienteCuenta();
    $negocio = User::factory()->create()->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $pedido = $negocio->pedidos()->create([
        'user_id' => $user->id, 'estado' => 'entregado', 'metodo_pago' => 'efectivo',
        'total' => 1000, 'direccion_entrega' => 'Calle 1 #10-20', 'telefono_contacto' => '3001112233',
    ]);
    $user->clienteDirecciones()->create(['direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro', 'es_principal' => true]);
    $user->deviceTokens()->create(['token' => 'tok-1', 'plataforma' => 'android']);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['pin' => '2468'])->assertOk();

    $user->refresh();
    expect($user->eliminado_at)->not->toBeNull()
        ->and($user->email)->toEndWith('@vitrina.invalid')
        ->and($user->telefono)->toBeNull()
        ->and($user->codigo_publico)->toBeNull()
        ->and($user->clienteDirecciones()->count())->toBe(0)
        ->and($user->deviceTokens()->count())->toBe(0)
        ->and($user->getRoleNames())->toBeEmpty();

    $pedido->refresh();
    expect($pedido->exists)->toBeTrue()
        ->and($pedido->telefono_contacto)->toBe('');
});

test('no se puede eliminar la cuenta con un pedido en curso', function () {
    $user = clienteCuenta();
    $negocio = User::factory()->create()->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $negocio->pedidos()->create([
        'user_id' => $user->id, 'estado' => 'pendiente', 'metodo_pago' => 'efectivo',
        'total' => 1000, 'direccion_entrega' => 'Calle 1 #10-20', 'telefono_contacto' => '300',
    ]);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['pin' => '2468'])->assertStatus(409);
    expect($user->fresh()->eliminado_at)->toBeNull();
});

test('el negocio del único propietario se cierra y archiva; el compartido no', function () {
    $user = clienteCuenta();
    $solo = $user->negocio()->create(['nombre' => 'Solo mío', 'activo' => true]);

    $socio = User::factory()->create();
    $compartido = $socio->negocio()->create(['nombre' => 'Compartido', 'activo' => true]);
    $compartido->miembros()->attach($user->id, ['rol' => Negocio::ROL_PROPIETARIO, 'activo' => true]);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['pin' => '2468'])->assertOk();

    expect($solo->fresh()->activo)->toBeFalse()
        ->and($solo->fresh()->archivado_at)->not->toBeNull()
        ->and($compartido->fresh()->archivado_at)->toBeNull()
        ->and($compartido->fresh()->esMiembroActivo($user->fresh()))->toBeFalse();
});

test('la cuenta también se puede eliminar desde la web pública con el celular y la clave', function () {
    $user = clienteCuenta();
    $user->forceFill(['telefono_verificado_at' => now()])->save();

    $this->get('/eliminar-cuenta')->assertOk()->assertSee('Eliminar mi cuenta');
    $this->from('/eliminar-cuenta')->post('/eliminar-cuenta', ['usuario' => '300 111 2233', 'clave' => '1357'])
        ->assertRedirect('/eliminar-cuenta')->assertSessionHasErrors('usuario');
    expect($user->fresh()->eliminado_at)->toBeNull()->and($user->fresh()->pin_fallidos)->toBe(1);

    $this->post('/eliminar-cuenta', ['usuario' => '300 111 2233', 'clave' => '2468'])
        ->assertRedirect(route('eliminar-cuenta'));
    expect($user->fresh()->eliminado_at)->not->toBeNull();
});

test('las reglas de cancelación y devolución son públicas', function () {
    $this->get('/cancelaciones')->assertOk()->assertSee('ni cobra comisiones')->assertSee('la mitad del valor de los productos');
});

test('la política de privacidad es pública', function () {
    $this->get('/privacidad')->assertOk()->assertSee('Ley 1581 de 2012');
});

// ---------------------------------------------------------------------------
// Cuenta suspendida
// ---------------------------------------------------------------------------

test('una cuenta suspendida no puede iniciar sesión', function () {
    $user = clienteCuenta();
    $user->forceFill(['suspendido_at' => now(), 'motivo_suspension' => 'Pedidos falsos', 'telefono_verificado_at' => now()])->save();

    $respuesta = $this->postJson('/api/login', ['telefono' => $user->telefono, 'pin' => '2468'])
        ->assertStatus(422);

    expect($respuesta->json('errors.telefono.0'))->toContain('suspendida')->toContain('Pedidos falsos');
});

test('al suspender la cuenta su token deja de servir', function () {
    $user = clienteCuenta();
    $token = $user->createToken('api')->plainTextToken;
    $user->forceFill(['suspendido_at' => now()])->save();

    $this->withToken($token)->getJson('/api/pedidos')->assertStatus(401);
    expect($user->tokens()->count())->toBe(0);
});

// ---------------------------------------------------------------------------
// ¿Olvidaste tu clave? (código por WhatsApp; ver también AccesoTelefonoTest)
// ---------------------------------------------------------------------------

/** Cliente con el celular verificado; el código llega por el canal de prueba. */
function clienteConCelular(): User
{
    $user = clienteCuenta();
    $user->forceFill(['telefono_verificado_at' => now()])->save();
    app()->instance(EnviadorCodigos::class, new EnviadorLog);

    return $user;
}

function pedirCodigo(User $user): string
{
    return test()->postJson('/api/password/codigo', ['telefono' => $user->telefono])->assertOk()->json('codigo_prueba');
}

function restablecer(User $user, string $codigo, string $clave = '1357')
{
    return test()->postJson('/api/password/restablecer', [
        'telefono' => $user->telefono,
        'codigo' => $codigo,
        'pin' => $clave,
        'pin_confirmation' => $clave,
    ]);
}

test('fallar el login no bloquea pedir el código de recuperación', function () {
    $user = clienteConCelular();
    foreach (range(1, 6) as $i) {
        expect($this->postJson('/api/login', ['telefono' => $user->telefono, 'pin' => '1357'])->status())->toBeIn([422, 423]);
    }
    $this->postJson('/api/login', ['telefono' => $user->telefono, 'pin' => '1357'])->assertStatus(429);

    expect(pedirCodigo($user))->toMatch('/^\d{6}$/');

    // Y el límite del login es por celular: otra persona en la misma IP entra.
    $otro = User::factory()->conClave()->create(['telefono' => '3205556677', 'telefono_verificado_at' => now()]);
    $dispositivo = \App\Support\ClavePin::confiar($otro);
    $this->postJson('/api/login', ['telefono' => '3205556677', 'pin' => '2468', 'dispositivo' => $dispositivo])->assertOk();
});

test('pedir código no revela si el número tiene cuenta', function () {
    app()->instance(EnviadorCodigos::class, new EnviadorLog);

    $this->postJson('/api/password/codigo', ['telefono' => '3209876543'])
        ->assertOk()->assertJsonMissingPath('codigo_prueba');
});

test('con el código correcto se cambia la clave, se desbloquea y se cierran las sesiones', function () {
    $user = clienteConCelular();
    $user->forceFill(['pin_bloqueado_at' => now(), 'pin_fallidos' => 5])->save();
    $user->createToken('api');
    \App\Support\ClavePin::confiar($user, 'Teléfono viejo');
    $codigo = pedirCodigo($user);

    restablecer($user, $codigo)->assertOk()->assertJsonStructure(['token', 'dispositivo']);

    $user->refresh();
    expect(Hash::check('1357', $user->pin))->toBeTrue()
        ->and($user->pin_bloqueado_at)->toBeNull()
        ->and($user->tokens()->count())->toBe(1)
        ->and($user->dispositivosConfianza()->count())->toBe(1);

    // El código no sirve dos veces.
    restablecer($user, $codigo, '9753')->assertStatus(422);
});

test('un código equivocado no cambia la clave y tras 5 intentos se anula', function () {
    // Aquí se prueba el límite propio del código, no el throttle por IP.
    $this->withoutMiddleware(Illuminate\Routing\Middleware\ThrottleRequests::class);
    $user = clienteConCelular();
    $codigo = pedirCodigo($user);
    $malo = $codigo === '000000' ? '111111' : '000000';

    foreach (range(1, 5) as $i) {
        restablecer($user, $malo)->assertStatus(422);
    }

    // Ni el código bueno sirve ya.
    restablecer($user, $codigo)->assertStatus(422);

    expect(Hash::check('2468', $user->fresh()->pin))->toBeTrue();
});

test('un código vencido no sirve', function () {
    $user = clienteConCelular();
    $codigo = pedirCodigo($user);
    $this->travel(11)->minutes();

    restablecer($user, $codigo)->assertStatus(422)->assertJsonValidationErrors(['codigo']);
});
