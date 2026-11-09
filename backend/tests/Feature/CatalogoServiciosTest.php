<?php

use App\Models\TipoNegocio;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('publica la tienda y su categoria solo mientras ofrece servicios visibles', function () {
    $dueno = User::factory()->create();
    Sanctum::actingAs($dueno);
    $tienda = $dueno->negocio()->create(['nombre' => 'Mi taller']);
    $tipo = TipoNegocio::create(['nombre' => 'Talleres', 'slug' => 'talleres']);
    $tienda->tiposNegocio()->attach($tipo);
    $tienda->productos()->create(['nombre' => 'Repuesto', 'precio' => 15000]);
    $ruta = "/api/negocios/{$tienda->id}/servicios";

    $this->getJson('/api/negocios?seccion=servicios')->assertOk()->assertJsonCount(0, 'negocios');
    $this->getJson('/api/tipos-negocio?seccion=servicios')->assertOk()->assertJsonCount(0, 'categorias');
    $this->getJson('/api/tipos-negocio?seccion=productos')->assertOk()->assertJsonPath('categorias.0.id', $tipo->id);

    $datos = ['nombre' => 'Instalacion', 'descripcion' => 'Instalacion a domicilio', 'precio' => 30000, 'duracion_minutos' => 60];
    $id = $this->postJson($ruta, $datos)->assertCreated()->json('servicio.id');
    $this->getJson('/api/negocios?seccion=servicios')->assertOk()->assertJsonCount(1, 'negocios')->assertJsonPath('negocios.0.id', $tienda->id);
    $this->getJson('/api/tipos-negocio?seccion=servicios')->assertOk()->assertJsonCount(1, 'categorias')->assertJsonPath('categorias.0.id', $tipo->id);
    $this->getJson('/api/negocios/'.$tienda->id)->assertOk()->assertJsonPath('servicios.0.precio', 30000);

    $this->putJson($ruta.'/'.$id, [...$datos, 'disponible' => false])->assertOk();
    $this->getJson('/api/negocios?seccion=servicios')->assertOk()->assertJsonCount(0, 'negocios');
    $this->getJson('/api/tipos-negocio?seccion=servicios')->assertOk()->assertJsonCount(0, 'categorias');
    $this->putJson($ruta.'/'.$id, [...$datos, 'disponible' => true])->assertOk();
    $this->deleteJson($ruta.'/'.$id)->assertOk();
    $this->getJson('/api/negocios?seccion=servicios')->assertOk()->assertJsonCount(0, 'negocios');
    $this->getJson('/api/tipos-negocio?seccion=servicios')->assertOk()->assertJsonCount(0, 'categorias');
});
