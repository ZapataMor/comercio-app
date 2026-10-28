<?php

use App\Models\Negocio;
use App\Models\User;
use App\Notifications\CodigoRecuperacionClave;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
});

function clienteCuenta(): User
{
    $user = User::factory()->create([
        'password' => 'clave-actual',
        'telefono' => '3001112233',
        'direccion' => 'Calle 1',
        'barrio' => 'Centro',
    ]);
    $user->assignRole('usuario');

    return $user;
}

function datosRegistro(array $extra = []): array
{
    return [
        'name' => 'Ana', 'apellidos' => 'Pérez', 'email' => 'ana@correo.com',
        'password' => 'password123', 'password_confirmation' => 'password123',
        'direccion' => 'Calle 1', 'barrio' => 'Centro', 'telefono' => '3001234567',
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

test('eliminar la cuenta exige la contraseña correcta', function () {
    Sanctum::actingAs(clienteCuenta());

    $this->deleteJson('/api/cuenta', ['password' => 'otra'])
        ->assertStatus(422)->assertJsonValidationErrors(['password']);
});

test('eliminar la cuenta anonimiza los datos y conserva los pedidos', function () {
    $user = clienteCuenta();
    $negocio = User::factory()->create()->negocio()->create(['nombre' => 'Tienda', 'activo' => true]);
    $pedido = $negocio->pedidos()->create([
        'user_id' => $user->id, 'estado' => 'entregado', 'metodo_pago' => 'efectivo',
        'total' => 1000, 'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001112233',
    ]);
    $user->clienteDirecciones()->create(['direccion' => 'Calle 1', 'barrio' => 'Centro', 'es_principal' => true]);
    $user->deviceTokens()->create(['token' => 'tok-1', 'plataforma' => 'android']);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['password' => 'clave-actual'])->assertOk();

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
        'total' => 1000, 'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '300',
    ]);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['password' => 'clave-actual'])->assertStatus(409);
    expect($user->fresh()->eliminado_at)->toBeNull();
});

test('el negocio del único propietario se cierra y archiva; el compartido no', function () {
    $user = clienteCuenta();
    $solo = $user->negocio()->create(['nombre' => 'Solo mío', 'activo' => true]);

    $socio = User::factory()->create();
    $compartido = $socio->negocio()->create(['nombre' => 'Compartido', 'activo' => true]);
    $compartido->miembros()->attach($user->id, ['rol' => Negocio::ROL_PROPIETARIO, 'activo' => true]);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/cuenta', ['password' => 'clave-actual'])->assertOk();

    expect($solo->fresh()->activo)->toBeFalse()
        ->and($solo->fresh()->archivado_at)->not->toBeNull()
        ->and($compartido->fresh()->archivado_at)->toBeNull()
        ->and($compartido->fresh()->esMiembroActivo($user->fresh()))->toBeFalse();
});

test('la cuenta también se puede eliminar desde la web pública', function () {
    $user = clienteCuenta();

    $this->get('/eliminar-cuenta')->assertOk()->assertSee('Eliminar mi cuenta');
    $this->post('/eliminar-cuenta', ['email' => $user->email, 'password' => 'clave-actual'])
        ->assertRedirect(route('eliminar-cuenta'));

    expect($user->fresh()->eliminado_at)->not->toBeNull();
});

test('la política de privacidad es pública', function () {
    $this->get('/privacidad')->assertOk()->assertSee('Ley 1581 de 2012');
});

// ---------------------------------------------------------------------------
// Cuenta suspendida
// ---------------------------------------------------------------------------

test('una cuenta suspendida no puede iniciar sesión', function () {
    $user = clienteCuenta();
    $user->forceFill(['suspendido_at' => now(), 'motivo_suspension' => 'Pedidos falsos'])->save();

    $respuesta = $this->postJson('/api/login', ['email' => $user->email, 'password' => 'clave-actual'])
        ->assertStatus(422);

    expect($respuesta->json('errors.email.0'))->toContain('suspendida')->toContain('Pedidos falsos');
});

test('al suspender la cuenta su token deja de servir', function () {
    $user = clienteCuenta();
    $token = $user->createToken('api')->plainTextToken;
    $user->forceFill(['suspendido_at' => now()])->save();

    $this->withToken($token)->getJson('/api/pedidos')->assertStatus(401);
    expect($user->tokens()->count())->toBe(0);
});

// ---------------------------------------------------------------------------
// Recuperar contraseña
// ---------------------------------------------------------------------------

function pedirCodigo(User $user): string
{
    Notification::fake();
    test()->postJson('/api/password/codigo', ['email' => $user->email])->assertOk();

    $codigo = null;
    Notification::assertSentTo($user, CodigoRecuperacionClave::class, function ($n) use (&$codigo) {
        $codigo = $n->codigo;

        return true;
    });

    return $codigo;
}

function restablecer(User $user, string $codigo, string $clave = 'nueva-clave-1')
{
    return test()->postJson('/api/password/restablecer', [
        'email' => $user->email,
        'codigo' => $codigo,
        'password' => $clave,
        'password_confirmation' => $clave,
    ]);
}

test('fallar el login no bloquea pedir el código de recuperación', function () {
    $user = clienteCuenta();
    foreach (range(1, 6) as $i) {
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'mala'])->assertStatus(422);
    }
    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'mala'])->assertStatus(429);

    Notification::fake();
    $this->postJson('/api/password/codigo', ['email' => $user->email])->assertOk();
    Notification::assertSentTo($user, CodigoRecuperacionClave::class);

    // Y el límite del login es por correo: otra persona en la misma IP entra.
    $otro = clienteCuenta();
    $this->postJson('/api/login', ['email' => $otro->email, 'password' => 'clave-actual'])->assertOk();
});

test('pedir código no revela si el correo existe', function () {
    Notification::fake();

    $this->postJson('/api/password/codigo', ['email' => 'nadie@correo.com'])->assertOk();
    Notification::assertNothingSent();
});

test('con el código correcto se cambia la contraseña y se cierran las sesiones', function () {
    $user = clienteCuenta();
    $user->createToken('api');
    $codigo = pedirCodigo($user);

    restablecer($user, $codigo)->assertOk();

    expect(Hash::check('nueva-clave-1', $user->fresh()->password))->toBeTrue()
        ->and($user->tokens()->count())->toBe(0);

    // El código no sirve dos veces.
    restablecer($user, $codigo, 'otra-clave-22')->assertStatus(422);
});

test('un código equivocado no cambia la contraseña y tras 5 intentos se anula', function () {
    // Aquí se prueba el límite propio del código, no el throttle por IP.
    $this->withoutMiddleware(Illuminate\Routing\Middleware\ThrottleRequests::class);
    $user = clienteCuenta();
    $codigo = pedirCodigo($user);
    $malo = $codigo === '000000' ? '111111' : '000000';

    foreach (range(1, 5) as $i) {
        restablecer($user, $malo)->assertStatus(422);
    }

    // Ni el código bueno sirve ya.
    restablecer($user, $codigo)->assertStatus(422);

    expect(Hash::check('clave-actual', $user->fresh()->password))->toBeTrue();
});

test('un código vencido no sirve', function () {
    $user = clienteCuenta();
    $codigo = pedirCodigo($user);
    $this->travel(16)->minutes();

    restablecer($user, $codigo)->assertStatus(422)->assertJsonValidationErrors(['codigo']);
});
