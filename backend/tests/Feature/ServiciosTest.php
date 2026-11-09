<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('gestiona servicios con validacion y aislamiento entre negocios', function () {
    $dueno = User::factory()->create();
    $negocio = $dueno->negocio()->create(['nombre' => 'Taller']);
    $otro = User::factory()->create();
    $ajeno = $otro->negocio()->create(['nombre' => 'Otro']);
    Sanctum::actingAs($dueno);
    $ruta = "/api/negocios/{$negocio->id}/servicios";
    $this->postJson($ruta, ['nombre' => ' ', 'descripcion' => ' '])->assertUnprocessable()->assertJsonValidationErrors(['nombre', 'descripcion']);
    $id = $this->postJson($ruta, ['nombre' => 'Llantería', 'descripcion' => 'Reparación de pinchazos'])->assertCreated()->json('servicio.id');
    $this->getJson($ruta)->assertOk()->assertJsonCount(1, 'servicios');
    $this->putJson($ruta.'/'.$id, ['nombre' => 'Llantas', 'descripcion' => 'Cambio de llantas', 'disponible' => false])->assertOk()->assertJsonPath('servicio.disponible', false);
    $this->getJson('/api/negocios/'.$negocio->id)->assertOk()->assertJsonCount(0, 'servicios');
    Sanctum::actingAs($otro);
    $this->getJson($ruta)->assertForbidden();
    $this->postJson($ruta, ['nombre' => 'X', 'descripcion' => 'Y'])->assertForbidden();
    $this->putJson($ruta.'/'.$id, ['nombre' => 'X', 'descripcion' => 'Y'])->assertForbidden();
    $this->deleteJson($ruta.'/'.$id)->assertForbidden();
    $this->putJson("/api/negocios/{$ajeno->id}/servicios/{$id}", ['nombre' => 'X', 'descripcion' => 'Y'])->assertNotFound();
    Sanctum::actingAs($dueno);
    $negocio->miembros()->updateExistingPivot($dueno->id, ['activo' => false]);
    $this->deleteJson($ruta.'/'.$id)->assertForbidden();
    $negocio->miembros()->updateExistingPivot($dueno->id, ['activo' => true]);
    $this->deleteJson($ruta.'/'.$id)->assertOk();
    $this->assertDatabaseMissing('servicios', ['id' => $id]);
});

it('separa el catalogo y encuentra servicios por descripcion', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $productos = $user->negocio()->create(['nombre' => 'Productos']);
    $servicios = $user->negocio()->create(['nombre' => 'Servicios', 'activo' => false]);
    $mixto = $user->negocio()->create(['nombre' => 'Mixto']);
    $oculto = $user->negocio()->create(['nombre' => 'Oculto']);
    $archivado = $user->negocio()->create(['nombre' => 'Archivado']);
    $archivado->forceFill(['archivado_at' => now()])->save();
    $vetado = $user->negocio()->create(['nombre' => 'Vetado']);
    $vetado->forceFill(['vetado_at' => now()])->save();
    foreach ([$productos, $mixto] as $n) {
        $n->productos()->create(['nombre' => 'Llanta', 'precio' => 50000]);
    }
    foreach ([$servicios, $mixto, $archivado, $vetado] as $n) {
        $n->servicios()->create(['nombre' => 'Mantenimiento', 'descripcion' => 'Reparación de electrodomésticos']);
    }
    $oculto->servicios()->create(['nombre' => 'Oculto', 'descripcion' => 'No visible', 'disponible' => false]);
    $this->getJson('/api/negocios?seccion=productos')->assertOk()->assertJsonCount(2, 'negocios');
    $this->getJson('/api/negocios?seccion=servicios')->assertOk()->assertJsonCount(2, 'negocios')->assertJsonPath('negocios.0.nombre', 'Mixto');
    $this->getJson('/api/negocios?seccion=servicios&buscar=electro')->assertOk()->assertJsonCount(2, 'negocios');
    $this->getJson('/api/negocios?seccion=productos&buscar=electro')->assertOk()->assertJsonCount(0, 'negocios');
    $this->getJson('/api/negocios/'.$mixto->id)->assertOk()->assertJsonCount(1, 'productos')->assertJsonCount(1, 'servicios');
    $this->getJson('/api/negocios?seccion=invalida')->assertUnprocessable();
    $this->getJson('/api/productos?todos=1')->assertOk()->assertJsonCount(2, 'productos');
});

it('exige autenticacion para administrar servicios', function () {
    $this->getJson('/api/negocios/1/servicios')->assertUnauthorized();
    $this->postJson('/api/negocios/1/servicios', [])->assertUnauthorized();
});
