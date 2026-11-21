<?php

use App\Models\CodigoTelefono;
use App\Models\User;
use App\Support\Telefono\CodigosTelefono;
use App\Support\Telefono\EnviadorCodigos;
use App\Support\Telefono\EnviadorWhatsApp;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

/**
 * Canal falso: guarda los códigos en vez de enviarlos, para poder leerlos.
 */
class EnviadorDePrueba implements EnviadorCodigos
{
    public array $enviados = [];

    public bool $falla = false;

    public function enviar(string $telefono, string $codigo): void
    {
        if ($this->falla) {
            throw new RuntimeException('Meta no responde');
        }
        $this->enviados[] = [$telefono, $codigo];
    }

    public function esDePrueba(): bool
    {
        return false;
    }

    public function ultimo(): string
    {
        return end($this->enviados)[1];
    }
}

beforeEach(function () {
    foreach (['administrador', 'usuario', 'domiciliario'] as $rol) {
        Role::findOrCreate($rol, 'web');
    }
    $this->enviador = new EnviadorDePrueba;
    $this->app->instance(EnviadorCodigos::class, $this->enviador);
});

function cuentaConCelular(string $telefono = '3001234567', bool $verificado = true): User
{
    $user = User::factory()->create(['password' => 'clave-actual', 'telefono' => $telefono, 'email' => null]);
    $user->forceFill(['telefono_verificado_at' => $verificado ? now() : null])->save();
    $user->assignRole('usuario');

    return $user;
}

function registroConCelular(array $extra = []): array
{
    return $extra + [
        'name' => 'Ana', 'apellidos' => 'Pérez', 'pin' => '2468', 'pin_confirmation' => '2468',
        'direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro', 'telefono' => '3001234567', 'acepta_terminos' => true,
    ];
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

test('el registro completo con el celular: código, verificación y cuenta sin correo', function () {
    $this->postJson('/api/telefono/codigo', ['telefono' => '+57 300 123 4567'])
        ->assertOk()->assertJsonPath('espera', 60)->assertJsonMissingPath('codigo_prueba');
    expect($this->enviador->enviados[0][0])->toBe('3001234567');

    $token = $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $this->enviador->ultimo()])
        ->assertOk()->json('verificacion');

    $respuesta = $this->postJson('/api/register', registroConCelular(['verificacion' => $token]))
        ->assertCreated()
        ->assertJsonPath('user.telefono', '3001234567')
        ->assertJsonPath('user.telefono_verificado', true)
        ->assertJsonPath('user.tiene_pin', true)
        ->assertJsonPath('user.email', null);
    // Con el código de WhatsApp ya demostró quién es: este teléfono queda de confianza.
    $dispositivo = $respuesta->json('dispositivo');
    expect($dispositivo)->toBeString();
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468', 'dispositivo' => $dispositivo])
        ->assertOk()->assertJsonPath('user.telefono', '3001234567');

    // El token se gasta: no sirve para otra cuenta.
    $this->postJson('/api/register', registroConCelular(['verificacion' => $token, 'name' => 'Otra']))
        ->assertStatus(422)->assertJsonValidationErrors('telefono');
    expect(CodigoTelefono::count())->toBe(0);
});

test('registrarse exige haber confirmado el número', function () {
    $this->postJson('/api/register', registroConCelular())
        ->assertStatus(422)->assertJsonValidationErrors('verificacion');

    $this->postJson('/api/register', registroConCelular(['verificacion' => 'inventado']))
        ->assertStatus(422)->assertJsonValidationErrors('telefono');
});

test('el token de un número no sirve para registrar otro', function () {
    $token = verificacionTelefono('3001234567');

    $this->postJson('/api/register', registroConCelular(['telefono' => '3109998877', 'verificacion' => $token]))
        ->assertStatus(422)->assertJsonValidationErrors('telefono');
});

test('un número verificado en otra cuenta no puede registrarse otra vez', function () {
    cuentaConCelular('3001234567');

    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])
        ->assertStatus(422)->assertJsonValidationErrors('telefono');
    expect($this->enviador->enviados)->toBe([]);
});

test('un número guardado sin verificar no bloquea a su verdadero dueño', function () {
    cuentaConCelular('3001234567', verificado: false);

    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])->assertOk();
});

test('solo se aceptan celulares colombianos', function ($telefono) {
    $this->postJson('/api/telefono/codigo', ['telefono' => $telefono])
        ->assertStatus(422)->assertJsonValidationErrors('telefono');
})->with(['6051234567', '300123456', '+1 300 123 4567', '30012345678', 'abc']);

test('hay que esperar 60 segundos para pedir otro código', function () {
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])->assertOk();
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])
        ->assertStatus(422)->assertJsonValidationErrors('telefono');

    $this->travel(61)->seconds();
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])->assertOk();
    expect($this->enviador->enviados)->toHaveCount(2);
});

test('pedir otro código anula el anterior', function () {
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567']);
    $primero = $this->enviador->ultimo();
    $this->travel(61)->seconds();
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567']);

    if ($primero !== $this->enviador->ultimo()) {
        $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $primero])
            ->assertStatus(422)->assertJsonValidationErrors('codigo');
    }
    $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $this->enviador->ultimo()])->assertOk();
});

test('el código se anula tras cinco intentos fallidos', function () {
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567']);
    $bueno = $this->enviador->ultimo();
    $malo = $bueno === '000000' ? '111111' : '000000';

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $malo])->assertStatus(422);
        $this->travel(11)->seconds(); // no chocar con el límite por minuto
    }

    $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $bueno])
        ->assertStatus(422)->assertJsonPath('errors.codigo.0', 'El código venció o ya no sirve. Pide uno nuevo.');
});

test('el código vence a los diez minutos', function () {
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567']);
    $this->travel(11)->minutes();

    $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $this->enviador->ultimo()])
        ->assertStatus(422)->assertJsonValidationErrors('codigo');
});

test('si WhatsApp falla se avisa y no queda un código vivo', function () {
    $this->enviador->falla = true;

    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])
        ->assertStatus(422)->assertJsonPath('errors.telefono.0', 'No pudimos enviarte el código por WhatsApp. Inténtalo de nuevo en unos minutos.');
    expect(CodigoTelefono::count())->toBe(0);
});

test('un mismo número no puede pedir más de cinco códigos por hora', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])->assertOk();
        $this->travel(61)->seconds();
    }
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])->assertStatus(429);
});

// ---------------------------------------------------------------------------
// Entrar (ver también ClaveTest)
// ---------------------------------------------------------------------------

test('un celular sin verificar no sirve para entrar', function () {
    $user = cuentaConCelular('3001234567', verificado: false);
    $user->forceFill(['pin' => '2468'])->save();

    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468'])
        ->assertStatus(422)->assertJsonValidationErrors('telefono');
});

test('ya no se entra con correo o usuario y contraseña', function () {
    User::factory()->create(['password' => 'clave-actual', 'email' => 'ana@correo.com', 'username' => 'ana.p']);

    $this->postJson('/api/login', ['usuario' => 'ana@correo.com', 'password' => 'clave-actual'])
        ->assertStatus(422)->assertJsonValidationErrors(['telefono', 'pin']);
    $this->postJson('/api/login', ['email' => 'ana@correo.com', 'password' => 'clave-actual'])->assertStatus(422);
});

// ---------------------------------------------------------------------------
// ¿Olvidaste tu clave?
// ---------------------------------------------------------------------------

test('con el código de WhatsApp se crea una clave nueva y se entra', function () {
    $user = cuentaConCelular('3001234567');
    $user->createToken('otro-telefono');

    $this->postJson('/api/password/codigo', ['telefono' => '3001234567'])
        ->assertOk()->assertJsonPath('message', 'Si el número tiene una cuenta, te enviamos un código por WhatsApp.');

    $respuesta = $this->postJson('/api/password/restablecer', [
        'telefono' => '3001234567', 'codigo' => $this->enviador->ultimo(),
        'pin' => '2468', 'pin_confirmation' => '2468',
    ])->assertOk()->assertJsonPath('user.tiene_pin', true);

    // Las sesiones de antes se cierran; queda solo la nueva.
    expect($user->tokens()->count())->toBe(1);
    $this->postJson('/api/login', ['telefono' => '3001234567', 'pin' => '2468', 'dispositivo' => $respuesta->json('dispositivo')])
        ->assertOk()->assertJsonMissingPath('requiere_codigo');
});

test('una clave fácil de adivinar no se acepta y no gasta el código', function () {
    cuentaConCelular('3001234567');
    $this->postJson('/api/password/codigo', ['telefono' => '3001234567']);
    $codigo = $this->enviador->ultimo();

    $this->postJson('/api/password/restablecer', ['telefono' => '3001234567', 'codigo' => $codigo, 'pin' => '1234', 'pin_confirmation' => '1234'])
        ->assertStatus(422)->assertJsonValidationErrors('pin');
    $this->postJson('/api/password/restablecer', ['telefono' => '3001234567', 'codigo' => $codigo, 'pin' => '2468', 'pin_confirmation' => '2468'])
        ->assertOk();
});

test('recuperar con un número sin cuenta responde igual y no envía nada', function ($verificado) {
    if ($verificado !== null) {
        cuentaConCelular('3001234567', $verificado);
    }

    $this->postJson('/api/password/codigo', ['telefono' => '3001234567'])
        ->assertOk()->assertJsonPath('message', 'Si el número tiene una cuenta, te enviamos un código por WhatsApp.');
    expect($this->enviador->enviados)->toBe([]);
})->with(['sin cuenta' => null, 'sin verificar' => false]);

test('el código de recuperación no sirve para otra cuenta ni para el registro', function () {
    cuentaConCelular('3001234567');
    $this->postJson('/api/password/codigo', ['telefono' => '3001234567']);

    $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $this->enviador->ultimo()])
        ->assertStatus(422)->assertJsonValidationErrors('codigo');
});

test('ya no se recupera por correo: se pide el celular', function () {
    User::factory()->create(['email' => 'ana@correo.com']);

    $this->postJson('/api/password/codigo', ['email' => 'ana@correo.com'])
        ->assertStatus(422)->assertJsonPath('errors.telefono.0', 'Escribe el celular de tu cuenta.');
    expect($this->enviador->enviados)->toBe([]);
});

// ---------------------------------------------------------------------------
// Mi información
// ---------------------------------------------------------------------------

test('desde Mi información se verifica el celular', function () {
    $user = cuentaConCelular('3001234567', verificado: false);
    Sanctum::actingAs($user);

    $this->postJson('/api/perfil/telefono/codigo', ['telefono' => '3109998877'])->assertOk();
    $this->postJson('/api/perfil/telefono/verificar', ['telefono' => '3109998877', 'codigo' => $this->enviador->ultimo()])
        ->assertOk()
        ->assertJsonPath('user.telefono', '3109998877')
        ->assertJsonPath('user.telefono_verificado', true);
});

test('no se puede verificar un número que ya está verificado en otra cuenta', function () {
    cuentaConCelular('3109998877');
    Sanctum::actingAs(cuentaConCelular('3001234567', verificado: false));

    $this->postJson('/api/perfil/telefono/codigo', ['telefono' => '3109998877'])
        ->assertStatus(422)->assertJsonPath('errors.telefono.0', 'Este número ya está verificado en otra cuenta.');
});

test('el celular verificado no se cambia a mano: se cambia con la clave y el código', function () {
    $user = cuentaConCelular('3001234567');
    $user->update(['email' => 'ana@correo.com', 'direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro']);
    Sanctum::actingAs($user);

    $this->putJson('/api/perfil', [
        'name' => 'Ana', 'email' => 'ana@correo.com', 'direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro', 'telefono' => '3109998877',
    ])->assertStatus(422)->assertJsonValidationErrors('telefono');
    expect($user->fresh()->telefono)->toBe('3001234567');
});

test('un celular sin verificar es solo de contacto y se cambia a mano', function () {
    $user = cuentaConCelular('3001234567', verificado: false);
    $user->update(['email' => 'ana@correo.com']);
    Sanctum::actingAs($user);

    $this->putJson('/api/perfil', ['name' => 'Ana', 'email' => 'ana@correo.com', 'telefono' => '3109998877'])
        ->assertOk()->assertJsonPath('user.telefono', '3109998877')->assertJsonPath('user.telefono_verificado', false);
});

test('una cuenta sin correo no puede cambiar su celular sin verificarlo', function () {
    $user = cuentaConCelular('3001234567');
    $user->update(['direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro']);
    Sanctum::actingAs($user);
    $datos = ['name' => 'Ana', 'email' => '', 'direccion' => 'Calle 1 #10-20', 'barrio' => 'Centro'];

    $this->putJson('/api/perfil', $datos + ['telefono' => '3109998877'])
        ->assertStatus(422)->assertJsonValidationErrors('telefono');
    // Conservando el número verificado, el correo puede quedar vacío.
    $this->putJson('/api/perfil', $datos + ['telefono' => '3001234567'])->assertOk();
});

test('eliminar la cuenta libera el número verificado', function () {
    $user = cuentaConCelular('3001234567');
    \App\Support\EliminarCuenta::ejecutar($user);

    expect(CodigosTelefono::cuentaConTelefono('3001234567'))->toBeNull();
    $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])->assertOk();
});

// ---------------------------------------------------------------------------
// WhatsApp Cloud API
// ---------------------------------------------------------------------------

test('el envío por WhatsApp usa la plantilla de autenticación con el código dos veces', function () {
    Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.1']]])]);

    (new EnviadorWhatsApp('token-x', '123456', 'codigo_vitrina', 'es', 'v23.0'))->enviar('3001234567', '482913');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://graph.facebook.com/v23.0/123456/messages'
            && $request->hasHeader('Authorization', 'Bearer token-x')
            && $request['to'] === '573001234567'
            && $request['template']['name'] === 'codigo_vitrina'
            && $request['template']['components'][0]['parameters'][0]['text'] === '482913'
            && $request['template']['components'][1]['sub_type'] === 'url'
            && $request['template']['components'][1]['parameters'][0]['text'] === '482913';
    });
});

test('un error de Meta se convierte en excepción', function () {
    Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['message' => 'Template not found', 'code' => 132001]], 404)]);

    expect(fn () => (new EnviadorWhatsApp('t', '1', 'x', 'es', 'v23.0'))->enviar('3001234567', '111111'))
        ->toThrow(RuntimeException::class, 'Template not found');
});

test('sin datos de Meta el modo cloud avisa qué falta', function () {
    config(['services.whatsapp.driver' => 'cloud', 'services.whatsapp.token' => null]);

    expect(fn () => EnviadorWhatsApp::desdeConfig())->toThrow(RuntimeException::class, 'services.whatsapp.token');
});

test('con el canal de prueba la API devuelve el código para mostrarlo en la app', function () {
    $this->app->instance(EnviadorCodigos::class, new \App\Support\Telefono\EnviadorLog);

    $codigo = $this->postJson('/api/telefono/codigo', ['telefono' => '3001234567'])->assertOk()->json('codigo_prueba');

    expect($codigo)->toMatch('/^\d{6}$/');
    $this->postJson('/api/telefono/verificar', ['telefono' => '3001234567', 'codigo' => $codigo])->assertOk();
});
