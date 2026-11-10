<?php

namespace Tests\Feature;

use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Models\TipoNegocio;
use App\Models\User;
use App\Notifications\CitaActualizada;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class NegocioLifecycleTest extends TestCase
{
    // Sin transacción exterior: comprueba también la limpieza de archivos al commit.
    use DatabaseMigrations;

    private User $dueno;
    private User $cliente;
    private Negocio $negocio;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Notification::fake();
        $this->dueno = User::factory()->create();
        $this->cliente = User::factory()->create();
        $this->negocio = $this->dueno->negocio()->create([
            'nombre' => 'Tienda temporal', 'activo' => true, 'lat' => 11.38, 'lng' => -72.24,
        ]);
    }

    private function ruta(): string
    {
        return '/api/negocios/'.$this->negocio->id;
    }

    private function pedido(string $estado = 'entregado'): Pedido
    {
        return $this->negocio->pedidos()->create([
            'user_id' => $this->cliente->id, 'estado' => $estado, 'metodo_pago' => 'efectivo',
            'total' => 1000, 'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567',
        ]);
    }

    private function cita(): Cita
    {
        return Cita::create([
            'negocio_id' => $this->negocio->id, 'profesional_id' => $this->dueno->id,
            'cliente_id' => $this->cliente->id, 'cliente_nombre' => 'Cliente', 'servicio_nombre' => 'Corte',
            'estado' => 'confirmada', 'inicio' => now()->addDay(), 'fin' => now()->addDay()->addHour(),
        ]);
    }

    public function test_solo_el_dueno_puede_desactivar_reactivar_o_borrar(): void
    {
        $this->putJson($this->ruta().'/desactivacion', ['desactivado' => true])->assertUnauthorized();
        $this->deleteJson($this->ruta())->assertUnauthorized();
        foreach (['ajeno', 'trabajador', 'administrador', 'propietario_inactivo'] as $rol) {
            $usuario = User::factory()->create();
            if ($rol === 'administrador') {
                Role::findOrCreate('administrador', 'web');
                $usuario->assignRole('administrador');
            }
            if ($rol !== 'ajeno') {
                $this->negocio->miembros()->attach($usuario, [
                    'rol' => $rol === 'propietario_inactivo' ? 'propietario' : 'trabajador',
                    'activo' => $rol !== 'propietario_inactivo',
                ]);
            }
            Sanctum::actingAs($usuario);
            foreach ([true, false] as $desactivado) {
                $this->putJson($this->ruta().'/desactivacion', compact('desactivado'))->assertForbidden();
            }
            $this->deleteJson($this->ruta())->assertForbidden();
        }
        $this->assertDatabaseHas('negocios', ['id' => $this->negocio->id, 'desactivado_at' => null]);
    }

    public function test_desactivar_oculta_todas_las_vistas_publicas_y_conserva_datos_y_acceso_del_equipo(): void
    {
        $tipo = TipoNegocio::create(['nombre' => 'Temporal', 'slug' => 'temporal']);
        $this->negocio->tiposNegocio()->attach($tipo);
        $producto = $this->negocio->productos()->create(['nombre' => 'Producto temporal', 'precio' => 1000]);
        $servicio = $this->negocio->servicios()->create(['nombre' => 'Corte', 'descripcion' => 'Corte']);
        $pedido = $this->pedido('aceptado');
        $cita = $this->cita();
        $pedidoOriginal = $pedido->fresh()->getRawOriginal();
        $citaOriginal = $cita->fresh()->getRawOriginal();
        Sanctum::actingAs($this->dueno);
        $this->putJson($this->ruta().'/desactivacion', ['desactivado' => true])
            ->assertOk()->assertJsonPath('negocio.desactivado', true);
        $this->getJson('/api/negocios/mios')->assertJsonPath('negocios.0.desactivado', true);
        $this->getJson('/api/negocios/mios/'.$this->negocio->id)->assertOk();
        $trabajador = User::factory()->create();
        $this->negocio->miembros()->attach($trabajador, ['rol' => 'trabajador', 'activo' => true]);
        Sanctum::actingAs($trabajador);
        $this->getJson('/api/negocios/mios/'.$this->negocio->id)->assertOk();
        Sanctum::actingAs($this->cliente);
        $this->getJson('/api/negocios')->assertJsonCount(0, 'negocios');
        $this->getJson('/api/negocios?buscar=temporal')->assertJsonCount(0, 'negocios');
        $this->getJson('/api/negocios/mapa')->assertJsonCount(0, 'negocios');
        $this->getJson('/api/productos?buscar=temporal')->assertJsonCount(0, 'productos');
        $this->getJson('/api/tipos-negocio')->assertJsonCount(0, 'categorias');
        foreach (['', '/estado', '/resenas', '/recetas-preferidas', '/disponibilidad'] as $sufijo) {
            $this->getJson($this->ruta().$sufijo)->assertNotFound();
        }
        $this->postJson('/api/pedidos', [
            'negocio_id' => $this->negocio->id, 'items' => [['producto_id' => $producto->id, 'cantidad' => 1]],
            'metodo_pago' => 'efectivo', 'direccion_entrega' => 'Calle 1', 'telefono_contacto' => '3001234567',
        ])->assertUnprocessable();
        $this->postJson($this->ruta().'/solicitudes-cita', [
            'servicio_id' => $servicio->id, 'profesional_id' => $this->dueno->id,
            'fecha' => now()->addDay()->format('Y-m-d'), 'hora' => '14:00',
        ])->assertNotFound();
        $this->assertSame($pedidoOriginal, $pedido->fresh()->getRawOriginal());
        $this->assertSame($citaOriginal, $cita->fresh()->getRawOriginal());
        $this->assertDatabaseHas('productos', ['id' => $producto->id]);
        Notification::assertNothingSent();
        Sanctum::actingAs($this->dueno);
        $this->putJson($this->ruta().'/desactivacion', ['desactivado' => false])
            ->assertOk()->assertJsonPath('negocio.desactivado', false);
        $this->getJson($this->ruta())->assertOk()->assertJsonCount(1, 'productos')->assertJsonCount(1, 'servicios');
        $this->getJson('/api/negocios/mapa')->assertJsonCount(1, 'negocios');
    }

    public function test_el_borrado_elimina_las_relaciones_y_los_archivos_incluidos_productos_ya_retirados(): void
    {
        $otro = User::factory()->create()->negocio()->create(['nombre' => 'Otro negocio']);
        $categoria = $this->negocio->categorias()->create(['nombre' => 'Categoría']);
        $producto = $this->negocio->productos()->create(['nombre' => 'Producto', 'precio' => 1000, 'categoria_id' => $categoria->id]);
        $producto->forceFill(['imagen' => 'productos/producto.jpg'])->save();
        $retirado = $this->negocio->productos()->create(['nombre' => 'Retirado', 'precio' => 2000]);
        $retirado->forceFill(['imagen' => 'productos/retirado.jpg'])->save();
        $retirado->delete();
        $this->negocio->forceFill(['imagen' => 'negocios/tienda.jpg', 'desactivado_at' => now()])->save();
        $servicio = $this->negocio->servicios()->create(['nombre' => 'Servicio', 'descripcion' => 'Descripción']);
        $servicio->forceFill(['galeria' => ['/storage/servicios/foto.jpg']])->save();
        $imagenes = ['productos/producto.jpg', 'productos/retirado.jpg', 'negocios/tienda.jpg', 'servicios/foto.jpg'];
        foreach ([...$imagenes, 'negocios/otro.jpg'] as $imagen) Storage::disk('public')->put($imagen, 'foto');
        $tipo = TipoNegocio::create(['nombre' => 'Tipo', 'slug' => 'tipo']);
        $this->negocio->tiposNegocio()->attach($tipo);
        $pedido = $this->pedido();
        $pedido->items()->create(['producto_id' => $producto->id, 'nombre' => 'Producto', 'cantidad' => 1, 'precio' => 1000]);
        $cita = $this->cita();
        $cita->update(['servicio_id' => $servicio->id]);
        $this->negocio->invitaciones()->create(['user_id' => $this->cliente->id, 'invitado_por' => $this->dueno->id]);
        DB::table('carrito_reservas')->insert(['user_id' => $this->cliente->id, 'producto_id' => $producto->id, 'precio' => 1000, 'vence_at' => now()->addHour()]);
        $resena = DB::table('resenas')->insertGetId([
            'pedido_id' => $pedido->id, 'user_id' => $this->cliente->id, 'negocio_id' => $this->negocio->id,
            'objeto' => 'tienda', 'estrellas' => 5,
        ]);
        DB::table('resena_reportes')->insert(['resena_id' => $resena, 'user_id' => $this->cliente->id, 'motivo' => 'otro']);
        DB::table('resena_moderaciones')->insert(['resena_id' => $resena, 'accion' => 'ocultar']);
        DB::table('pedido_reportes')->insert(['pedido_id' => $pedido->id, 'objetivo' => 'negocio', 'tipo' => 'otro', 'motivo' => 'Motivo']);
        DB::table('calificaciones')->insert(['pedido_id' => $pedido->id, 'user_id' => $this->cliente->id, 'negocio_ok' => true]);
        ReputacionEvento::create(['tipo' => 'negocio', 'sujeto_id' => $this->negocio->id, 'pedido_id' => $pedido->id, 'motivo' => 'prueba', 'puntos' => -1, 'origen' => 'sistema']);
        Sanctum::actingAs($this->dueno);
        $this->deleteJson($this->ruta())->assertOk();
        foreach (['productos', 'servicios', 'categorias', 'pedidos', 'pedido_items', 'citas', 'invitaciones_trabajo',
            'carrito_reservas', 'resenas', 'resena_reportes', 'resena_moderaciones',
            'pedido_reportes', 'calificaciones', 'reputacion_eventos', 'negocio_tipo_negocio'] as $tabla) {
            $this->assertDatabaseCount($tabla, 0);
        }
        $this->assertDatabaseMissing('negocios', ['id' => $this->negocio->id]);
        $this->assertDatabaseMissing('negocio_user', ['negocio_id' => $this->negocio->id]);
        $this->assertDatabaseHas('negocios', ['id' => $otro->id]);
        $this->assertDatabaseHas('users', ['id' => $this->dueno->id]);
        $this->assertDatabaseHas('users', ['id' => $this->cliente->id]);
        $this->assertDatabaseHas('tipos_negocio', ['id' => $tipo->id]);
        Storage::disk('public')->assertMissing($imagenes);
        Storage::disk('public')->assertExists('negocios/otro.jpg');
        Notification::assertSentTo($this->cliente, CitaActualizada::class);
        $this->getJson('/api/negocios/mios')->assertJsonCount(0, 'negocios');
        $this->getJson($this->ruta())->assertNotFound();
    }

    public function test_no_borra_ningun_dato_con_pedidos_en_curso(): void
    {
        $pedido = $this->pedido('pendiente');
        Sanctum::actingAs($this->dueno);
        foreach (Pedido::EN_CURSO as $estado) {
            $pedido->update(['estado' => $estado]);
            $this->deleteJson($this->ruta())->assertConflict();
            $this->assertDatabaseHas('negocios', ['id' => $this->negocio->id]);
            $this->assertDatabaseHas('pedidos', ['id' => $pedido->id, 'estado' => $estado]);
        }
    }

    public function test_desactivar_no_se_puede_modificar_por_el_formulario_general_y_reactivar_no_quita_el_veto(): void
    {
        Sanctum::actingAs($this->dueno);
        $this->putJson($this->ruta().'/desactivacion', [])->assertUnprocessable();
        $this->putJson($this->ruta().'/desactivacion', ['desactivado' => 'cualquiera'])->assertUnprocessable();
        $this->putJson($this->ruta().'/desactivacion', ['desactivado' => true])->assertOk();
        $this->putJson($this->ruta(), ['desactivado_at' => null, 'activo' => true])->assertOk();
        $this->assertNotNull($this->negocio->fresh()->desactivado_at);
        $this->negocio->forceFill(['vetado_at' => now()])->save();
        $this->putJson($this->ruta().'/desactivacion', ['desactivado' => false])->assertOk();
        $this->getJson($this->ruta())->assertNotFound();
        $this->assertNotNull($this->negocio->fresh()->vetado_at);
    }
}
