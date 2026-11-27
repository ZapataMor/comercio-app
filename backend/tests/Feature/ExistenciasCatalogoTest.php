<?php

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Models\AccesoWeb;
use App\Models\TipoProducto;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

/*
 * Unidades en stock de un producto del catálogo: las suma lo que se publica
 * desde Producción (ver ProduccionEtapasTest) y se pueden editar a mano.
 */
beforeEach(function () {
    Notification::fake();
    $this->dueno = User::factory()->create(['name' => 'Ismael']);
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Grumar', 'direccion' => 'Calle 17', 'barrio' => 'Centro']);
    Gestion::activar($this->negocio);
    $this->puerta = $this->negocio->productos()->create(['nombre' => 'Puerta en lámina', 'precio' => 680000, 'disponible' => false, 'descripcion' => 'Calibre 18']);
});

function entrarComoIsmael($test): void
{
    $test->get('/login')->assertOk();
    AccesosWeb::aprobar(AccesoWeb::latest('id')->first()->codigo, $test->dueno);
    $test->getJson('/login/estado')->assertJsonPath('estado', 'listo');
}

test('las unidades en stock se editan en el formulario del producto y vacío deja de contarlas', function () {
    entrarComoIsmael($this);
    $tipo = TipoProducto::where('slug', 'otro')->value('id');
    $base = ['_producto' => (string) $this->puerta->id, 'nombre' => 'Puerta en lámina', 'precio' => '680000', 'tipo_producto_id' => $tipo, 'venta' => 'cantidad', 'disponible' => 1];

    $this->put("/negocio/catalogo/productos/{$this->puerta->id}", $base + ['existencias' => '4'])->assertSessionHas('ok');
    expect($this->puerta->fresh()->existencias)->toBe(4.0);
    $this->put("/negocio/catalogo/productos/{$this->puerta->id}", $base + ['existencias' => 'muchas'])->assertSessionHasErrors('existencias');
    $this->put("/negocio/catalogo/productos/{$this->puerta->id}", $base + ['existencias' => ''])->assertSessionHas('ok');
    expect($this->puerta->fresh()->existencias)->toBeNull();
});
