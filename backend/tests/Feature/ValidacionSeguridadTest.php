<?php

use App\Models\User;
use App\Rules\Direccion;
use App\Rules\Telefono;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

test('el telefono exige diez digitos y prefijo tres', function ($telefono, $valido) {
    expect(Validator::make(['telefono' => $telefono], ['telefono' => ['required', 'string', new Telefono]])->passes())->toBe($valido);
})->with([
    ['3001234567', true], ['300123456', false], ['30012345678', false],
    ['2001234567', false], ['3abcdefghi', false], ['300 123456', false], ['3001234567x', false],
]);

test('la direccion exige al menos una via y numero de casa', function ($direccion, $valida) {
    expect(Validator::make(['direccion' => $direccion], ['direccion' => ['required', new Direccion]])->passes())->toBe($valida);
})->with([
    ['Calle 12 #30', true], ['Carrera 8 #20-15', true], ['Calle 12 Carrera 8 #30', true],
    ['Calle 12 # 30', true], ['Calle 12', false], [' #30', false], ['Calle 12 #', false], ['Calle   #30', false],
]);

test('el registro exige una clave de 4 números difícil de adivinar', function ($clave) {
    Role::findOrCreate('usuario', 'web');
    $datos = ['name' => 'Ana', 'apellidos' => 'Pérez', 'email' => 'ana@example.com',
        'pin' => $clave, 'pin_confirmation' => $clave, 'direccion' => 'Carrera 8 #30',
        'barrio' => 'Centro', 'telefono' => '3001234567', 'acepta_terminos' => true,
        'verificacion' => verificacionTelefono('3001234567')];
    $this->postJson('/api/register', $datos)->assertUnprocessable()->assertJsonValidationErrors('pin');
    $this->postJson('/api/register', [...$datos, 'pin' => '2468', 'pin_confirmation' => '2468'])->assertCreated();
})->with(['123', '12345', 'abcd', '0000', '1234', '9876', '1212', '2000']);

test('un producto no se puede crear ni actualizar con precio cero', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $negocio = $user->negocio()->create(['nombre' => 'Tienda']);
    $url = "/api/negocios/{$negocio->id}/productos";
    $this->postJson($url, ['nombre' => 'Pan', 'precio' => 0])->assertUnprocessable()->assertJsonValidationErrors('precio');
    $producto = $negocio->productos()->create(['nombre' => 'Pan', 'precio' => 100]);
    $this->putJson("$url/{$producto->id}", ['precio' => 0])->assertUnprocessable()->assertJsonValidationErrors('precio');
    $this->putJson("$url/{$producto->id}", ['precio' => 1])->assertOk();
});

test('el limite por usuario comparte contador entre rutas y respeta el minuto', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    for ($i = 0; $i < 120; $i++) $this->getJson('/api/user')->assertOk();
    $this->getJson('/api/cliente/direcciones')->assertStatus(429)->assertHeader('Retry-After');
    Sanctum::actingAs(User::factory()->create());
    $this->getJson('/api/user')->assertOk();
    Sanctum::actingAs($user);
    $this->travel(61)->seconds();
    $this->getJson('/api/user')->assertOk();
});

test('rotar celulares no evade el limite general por IP', function () {
    for ($i = 0; $i < 300; $i++) $this->postJson('/api/login', ['telefono' => '30000'.str_pad((string) $i, 5, '0', STR_PAD_LEFT), 'pin' => '2468'])->assertStatus(422);
    $this->postJson('/api/login', ['telefono' => '3109998877', 'pin' => '2468'])->assertStatus(429)->assertHeader('Retry-After');
});

test('las escrituras se limitan a cuarenta por minuto sin bloquear lecturas', function () {
    Sanctum::actingAs(User::factory()->create());
    for ($i = 0; $i < 40; $i++) $this->putJson('/api/carrito', ['items' => []])->assertOk();
    $this->putJson('/api/carrito', ['items' => []])->assertStatus(429);
    $this->getJson('/api/user')->assertOk();
});

test('un precio cero historico no aparece en el catalogo ni acepta su cotizacion', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $negocio = $user->negocio()->create(['nombre' => 'Tienda']);
    $producto = $negocio->productos()->create(['nombre' => 'Antiguo', 'precio' => 100]);
    // Simula un registro previo a la validación, sin pasar por el modelo.
    \Illuminate\Support\Facades\DB::table('productos')->where('id', $producto->id)->update(['precio' => 0]);
    $producto->refresh();
    $this->getJson("/api/negocios/{$negocio->id}")->assertOk()->assertJsonCount(0, 'productos');
    $token = \App\Support\PrecioCarrito::cotizar($producto, $user->id)['precio_token'];
    $this->putJson('/api/carrito', ['items' => [['producto_id' => $producto->id, 'precio_token' => $token]]])
        ->assertUnprocessable()->assertJsonValidationErrors('items');
});
