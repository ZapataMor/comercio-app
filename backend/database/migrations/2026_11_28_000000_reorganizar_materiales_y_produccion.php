<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * «Materiales y producción» en un solo módulo (antes Inventario, Producción
 * y materiales, y la pestaña «En espera» del catálogo).
 *
 * - inventario_articulos.tipo: solo «material» (con lo que se fabrica o se
 *   gasta) o «herramienta» (se usa y no se gasta).
 * - modelos_produccion + modelo_materiales: la base de lo que se hace, con
 *   sus materiales predeterminados por unidad (una reja = 6 varillas y 1
 *   galón de pintura). Ya no dependen del catálogo. al_pedido: se descuentan
 *   con cada pedido de Vitrina de los productos que lo usan (restaurantes).
 * - productos.modelo_id: el modelo con el que se hace un producto.
 * - producciones por etapas (estado):
 *     por_hacer  = etapa 1: se dijo que se hará; materiales ajustables, aún
 *                  no se descuentan (produccion_materiales),
 *     terminada  = etapa 2: ya se descontaron; falta ponerle nombre, precio
 *                  y foto para el catálogo,
 *     publicada  = llegó al catálogo (producto_id),
 *     encargo    = no va al catálogo (era para alguien),
 *     pedido     = se descontó sola por un pedido de Vitrina.
 *
 * Los datos de antes se pasan: cada producto con materiales se vuelve un
 * modelo con su nombre, y lo que estaba «En espera» queda en la etapa 2.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modelos_produccion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->string('nombre', 150);
            $table->text('descripcion')->nullable();
            $table->boolean('al_pedido')->default(false);
            $table->timestamps();

            $table->index(['negocio_id', 'nombre']);
        });

        Schema::create('modelo_materiales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('modelo_id')->constrained('modelos_produccion')->cascadeOnDelete();
            $table->foreignId('articulo_id')->constrained('inventario_articulos')->cascadeOnDelete();
            $table->decimal('cantidad', 14, 3);
            $table->timestamps();

            $table->unique(['modelo_id', 'articulo_id']);
        });

        Schema::table('productos', function (Blueprint $table) {
            $table->foreignId('modelo_id')->nullable()->constrained('modelos_produccion')->nullOnDelete();
        });

        Schema::table('producciones', function (Blueprint $table) {
            $table->foreignId('modelo_id')->nullable()->constrained('modelos_produccion')->nullOnDelete();
            $table->string('estado', 12)->default('por_hacer');
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $table->foreignId('categoria_id')->nullable()->constrained('categorias')->nullOnDelete();
            $table->text('descripcion')->nullable();
            $table->unsignedInteger('precio')->nullable();
            // [{"nombre": "Ancho", "valor": "90 cm"}, ...]
            $table->text('especificaciones')->nullable();
            $table->string('imagen')->nullable();
            $table->timestamp('terminada_at')->nullable();
            $table->timestamp('publicada_at')->nullable();

            $table->index(['negocio_id', 'estado']);
        });

        Schema::create('produccion_materiales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('produccion_id')->constrained('producciones')->cascadeOnDelete();
            $table->foreignId('articulo_id')->constrained('inventario_articulos')->cascadeOnDelete();
            // Lo que se va a gastar (o se gastó) en toda la producción.
            $table->decimal('cantidad', 14, 3);
            // Lo predeterminado del modelo para esa cantidad; null si se añadió aparte.
            $table->decimal('normal', 14, 3)->nullable();
            $table->timestamps();

            $table->unique(['produccion_id', 'articulo_id']);
        });

        $this->pasarDatos();

        Schema::dropIfExists('productos_en_espera');
        Schema::dropIfExists('producto_materiales');
        Schema::table('producciones', fn (Blueprint $table) => $table->dropColumn('destino'));
        Schema::table('productos', fn (Blueprint $table) => $table->dropColumn('materiales_al'));
    }

    private function pasarDatos(): void
    {
        $ahora = now();

        // Inventario: solo materiales y herramientas.
        DB::table('inventario_articulos')->where('tipo', '!=', 'herramienta')->update(['tipo' => 'material']);

        // Cada producto con materiales pasa a ser un modelo con su nombre.
        $recetas = DB::table('producto_materiales')->get()->groupBy('producto_id');
        foreach ($recetas as $productoId => $filas) {
            $producto = DB::table('productos')->where('id', $productoId)->first();
            if (! $producto) {
                continue;
            }
            $modeloId = DB::table('modelos_produccion')->insertGetId([
                'negocio_id' => $producto->negocio_id,
                'nombre' => mb_substr($producto->nombre, 0, 150),
                'al_pedido' => ($producto->materiales_al ?? 'fabricar') === 'pedido',
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ]);
            DB::table('modelo_materiales')->insert($filas->map(fn ($f) => [
                'modelo_id' => $modeloId,
                'articulo_id' => $f->articulo_id,
                'cantidad' => $f->cantidad,
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ])->all());
            DB::table('productos')->where('id', $productoId)->update(['modelo_id' => $modeloId]);
        }

        // Producciones de antes: ya se descontaron, así que quedan terminadas.
        $esperas = Schema::hasTable('productos_en_espera') ? DB::table('productos_en_espera')->get()->keyBy('produccion_id') : collect();
        foreach (DB::table('producciones')->get() as $p) {
            $espera = $esperas->get($p->id);
            $estado = match (true) {
                $p->origen === 'pedido' => 'pedido',
                $p->destino === 'catalogo' => 'publicada',
                $p->destino === 'espera' && $espera?->estado === 'en_espera' => 'terminada',
                $p->destino === 'espera' && $espera?->estado === 'publicado' => 'publicada',
                default => 'encargo',
            };
            $cambios = [
                'estado' => $estado,
                'modelo_id' => $p->producto_id ? DB::table('productos')->where('id', $p->producto_id)->value('modelo_id') : null,
                'terminada_at' => $p->created_at,
                'publicada_at' => $estado === 'publicada' ? ($espera->publicado_at ?? $p->created_at) : null,
            ];
            if ($espera) {
                $cambios += [
                    'nombre' => $espera->nombre,
                    'descripcion' => $espera->descripcion,
                    'precio' => $espera->precio,
                    'especificaciones' => $espera->especificaciones,
                    'imagen' => $espera->imagen,
                    'sede_id' => $espera->sede_id,
                ];
                if ($estado === 'publicada' && $espera->publicado_en) {
                    $cambios['producto_id'] = $espera->publicado_en;
                }
                if ($estado === 'terminada' && $espera->producto_id) {
                    $cambios['categoria_id'] = DB::table('productos')->where('id', $espera->producto_id)->value('categoria_id');
                }
            }
            DB::table('producciones')->where('id', $p->id)->update($cambios);
        }

        // El módulo «produccion» quedó dentro de «inventario».
        DB::table('negocio_modulos')->where('modulo', 'produccion')->delete();
    }

    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->string('materiales_al', 10)->default('fabricar');
        });
        Schema::table('producciones', function (Blueprint $table) {
            $table->string('destino', 10)->nullable();
        });
        Schema::create('producto_materiales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('articulo_id')->constrained('inventario_articulos')->cascadeOnDelete();
            $table->decimal('cantidad', 14, 3);
            $table->timestamps();
            $table->unique(['producto_id', 'articulo_id']);
        });
        Schema::create('productos_en_espera', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->foreignId('producto_id')->nullable()->constrained('productos')->nullOnDelete();
            $table->foreignId('produccion_id')->nullable()->constrained('producciones')->nullOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('cantidad', 12, 3);
            $table->string('nombre', 255);
            $table->text('descripcion')->nullable();
            $table->unsignedInteger('precio')->nullable();
            $table->text('especificaciones')->nullable();
            $table->string('imagen')->nullable();
            $table->string('estado', 12)->default('en_espera');
            $table->foreignId('publicado_en')->nullable()->constrained('productos')->nullOnDelete();
            $table->timestamp('publicado_at')->nullable();
            $table->timestamps();
            $table->index(['negocio_id', 'estado']);
        });

        // Los modelos ligados a un producto vuelven a ser sus materiales.
        foreach (DB::table('productos')->whereNotNull('modelo_id')->get(['id', 'modelo_id']) as $p) {
            $modelo = DB::table('modelos_produccion')->where('id', $p->modelo_id)->first();
            DB::table('producto_materiales')->insert(DB::table('modelo_materiales')->where('modelo_id', $p->modelo_id)->get()
                ->map(fn ($m) => ['producto_id' => $p->id, 'articulo_id' => $m->articulo_id, 'cantidad' => $m->cantidad, 'created_at' => now(), 'updated_at' => now()])->all());
            DB::table('productos')->where('id', $p->id)->update(['materiales_al' => $modelo?->al_pedido ? 'pedido' : 'fabricar']);
        }
        DB::table('producciones')->where('estado', 'publicada')->update(['destino' => 'catalogo']);
        DB::table('producciones')->whereIn('estado', ['encargo', 'pedido'])->update(['destino' => 'pedido']);
        DB::table('producciones')->where('estado', 'por_hacer')->delete();

        Schema::dropIfExists('produccion_materiales');
        Schema::table('producciones', function (Blueprint $table) {
            $table->dropIndex(['negocio_id', 'estado']);
            $table->dropConstrainedForeignId('modelo_id');
            $table->dropConstrainedForeignId('sede_id');
            $table->dropConstrainedForeignId('categoria_id');
            $table->dropColumn(['estado', 'descripcion', 'precio', 'especificaciones', 'imagen', 'terminada_at', 'publicada_at']);
        });
        Schema::table('productos', fn (Blueprint $table) => $table->dropConstrainedForeignId('modelo_id'));
        Schema::dropIfExists('modelo_materiales');
        Schema::dropIfExists('modelos_produccion');
    }
};
