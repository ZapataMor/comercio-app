<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Vitrina Gestión (ADR-005): el negocio se maneja completo desde la web.
 *
 * - negocios.gestion_activa: el super administrador le enciende el panel web.
 * - plantillas_gestion: módulos y campos de producto por tipo de negocio.
 * - negocio_modulos: módulos opcionales encendidos para cada negocio (el
 *   catálogo de módulos vive en el código: App\Gestion\Modulos).
 * - sedes: puntos de venta, fábricas y bodegas del negocio.
 * - negocio_user.permisos_gestion: permisos por módulo de cada miembro.
 * - accesos_web: entrada a la web con un código que se aprueba desde la app.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plantillas_gestion', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 80);
            $table->string('slug', 80)->unique();
            $table->string('descripcion', 500)->nullable();
            // Claves de módulos opcionales que enciende al aplicarse.
            $table->json('modulos');
            // Ficha técnica: [{clave, etiqueta, tipo, unidad?, opciones?, requerido}].
            $table->json('campos_producto');
            // Ids de tipos de negocio a los que se le sugiere.
            $table->json('tipos_negocio')->nullable();
            $table->boolean('activa')->default(true);
            $table->timestamps();
        });

        Schema::table('negocios', function (Blueprint $table) {
            $table->boolean('gestion_activa')->default(false);
            $table->timestamp('gestion_activada_at')->nullable();
            $table->foreignId('plantilla_gestion_id')->nullable()->constrained('plantillas_gestion')->nullOnDelete();
        });

        Schema::create('negocio_modulos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->string('modulo', 40);
            $table->boolean('activo')->default(true);
            $table->foreignId('cambiado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['negocio_id', 'modulo']);
        });

        Schema::create('sedes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->string('nombre', 80);
            // punto_venta | fabrica | bodega | oficina
            $table->string('tipo', 20)->default('punto_venta');
            $table->string('direccion', 255)->nullable();
            $table->string('barrio', 120)->nullable();
            $table->string('telefono', 20)->nullable();
            $table->boolean('factura')->default(true);
            $table->boolean('principal')->default(false);
            $table->boolean('activa')->default(true);
            $table->timestamps();

            $table->index(['negocio_id', 'activa']);
        });

        Schema::table('negocio_user', function (Blueprint $table) {
            $table->json('permisos_gestion')->nullable();
        });

        Schema::create('accesos_web', function (Blueprint $table) {
            $table->id();
            // Lo que se escribe (o se escanea) en la app: 8 letras y números.
            $table->string('codigo', 12)->unique();
            // pendiente | aprobado | usado | vencido | cerrado
            $table->string('estado', 12)->default('pendiente');
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('ip', 45)->nullable();
            $table->string('navegador', 255)->nullable();
            $table->timestamp('expira_at');
            $table->timestamp('aprobado_at')->nullable();
            $table->timestamp('usado_at')->nullable();
            $table->timestamp('ultimo_uso_at')->nullable();
            $table->timestamp('cerrado_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'estado']);
        });

        $ahora = now();
        foreach (self::plantillas() as $p) {
            DB::table('plantillas_gestion')->insert([
                'nombre' => $p['nombre'],
                'slug' => $p['slug'],
                'descripcion' => $p['descripcion'],
                'modulos' => json_encode($p['modulos']),
                'campos_producto' => json_encode($p['campos'], JSON_UNESCAPED_UNICODE),
                'tipos_negocio' => json_encode([]),
                'activa' => true,
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('accesos_web');
        Schema::table('negocio_user', fn (Blueprint $table) => $table->dropColumn('permisos_gestion'));
        Schema::dropIfExists('sedes');
        Schema::dropIfExists('negocio_modulos');
        Schema::table('negocios', function (Blueprint $table) {
            $table->dropConstrainedForeignId('plantilla_gestion_id');
            $table->dropColumn(['gestion_activa', 'gestion_activada_at']);
        });
        Schema::dropIfExists('plantillas_gestion');
    }

    /** Plantillas iniciales; el super administrador las edita desde la web. */
    private static function plantillas(): array
    {
        $opciones = fn (string $clave, string $etiqueta, array $opciones, bool $requerido = false) => [
            'clave' => $clave, 'etiqueta' => $etiqueta, 'tipo' => 'opciones', 'opciones' => $opciones, 'requerido' => $requerido,
        ];
        $medida = fn (string $clave, string $etiqueta) => [
            'clave' => $clave, 'etiqueta' => $etiqueta, 'tipo' => 'numero', 'unidad' => 'cm', 'requerido' => false,
        ];

        return [
            [
                'nombre' => 'Negocio con inventario',
                'slug' => 'negocio-con-inventario',
                'descripcion' => 'Tienda que vende en el mostrador y por Vitrina, con inventario y cuentas.',
                'modulos' => ['inventario', 'caja', 'cuentas'],
                'campos' => [],
            ],
            [
                'nombre' => 'Latonería y ornamentación',
                'slug' => 'latoneria-y-ornamentacion',
                'descripcion' => 'Fabrica puertas, ventanas, portones, rejas y escaleras, en stock y a la medida, con varias sedes y personal.',
                'modulos' => ['sedes', 'inventario', 'caja', 'personal', 'nomina', 'medida', 'produccion', 'compras', 'clientes', 'cuentas'],
                'campos' => [
                    $opciones('pieza', 'Tipo de pieza', ['Puerta', 'Ventana', 'Portón', 'Reja', 'Escalera', 'Otro'], true),
                    $medida('ancho', 'Ancho'),
                    $medida('alto', 'Alto'),
                    $opciones('material', 'Material', ['Lámina', 'Tubo', 'Ángulo', 'Vidrio', 'Mixto']),
                    $opciones('calibre', 'Calibre', ['16', '18', '20', '22']),
                    ['clave' => 'color', 'etiqueta' => 'Color', 'tipo' => 'texto', 'requerido' => false],
                    $opciones('apertura', 'Apertura', ['Izquierda', 'Derecha', 'Corrediza', 'Batiente', 'No aplica']),
                    $opciones('acabado', 'Lleva', ['Lámina', 'Vidrio', 'No aplica']),
                    ['clave' => 'proteccion', 'etiqueta' => 'Con reja o protector', 'tipo' => 'si_no', 'requerido' => false],
                ],
            ],
        ];
    }
};
