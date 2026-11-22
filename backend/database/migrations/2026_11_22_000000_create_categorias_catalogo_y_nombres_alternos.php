<?php

use App\Support\Busqueda;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Categorías GLOBALES del catálogo (Comida, Comidas rápidas, Bebidas...): las
 * crea el administrador desde la web y el comerciante marca, si quiere, varias
 * para cada producto. Sirven para filtrar la búsqueda del cliente.
 *
 * También los «otros nombres» de productos, negocios y categorías: a un
 * lapicero le dicen bolígrafo y a una peluquería, barbería. La búsqueda los
 * encuentra por cualquiera de ellos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categorias_catalogo', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 80)->unique();
            $table->string('slug', 100)->unique();
            $table->json('nombres_alternos')->nullable();
            // Oculta: no sale en los filtros ni en el formulario, pero los
            // productos la conservan por si se vuelve a mostrar.
            $table->boolean('activa')->default(true);
            $table->unsignedSmallInteger('orden')->default(0);
            $table->text('busqueda')->nullable();
            $table->timestamps();
        });

        Schema::create('categoria_catalogo_producto', function (Blueprint $table) {
            $table->foreignId('categoria_catalogo_id')->constrained('categorias_catalogo')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->primary(['categoria_catalogo_id', 'producto_id']);
            $table->index('producto_id');
        });

        Schema::table('productos', function (Blueprint $table) {
            $table->json('nombres_alternos')->nullable()->after('nombre');
        });
        Schema::table('negocios', function (Blueprint $table) {
            $table->json('nombres_alternos')->nullable()->after('nombre');
        });

        $this->sembrar();
        $this->asignarAProductosExistentes();
        Busqueda::olvidarVocabulario();
    }

    public function down(): void
    {
        Schema::dropIfExists('categoria_catalogo_producto');
        Schema::dropIfExists('categorias_catalogo');
        Schema::table('productos', fn (Blueprint $table) => $table->dropColumn('nombres_alternos'));
        Schema::table('negocios', fn (Blueprint $table) => $table->dropColumn('nombres_alternos'));
        Busqueda::olvidarVocabulario();
    }

    private function sembrar(): void
    {
        foreach ($this->base() as $orden => [$nombre, $alternos]) {
            DB::table('categorias_catalogo')->insert([
                'nombre' => $nombre,
                'slug' => Str::slug($nombre),
                'nombres_alternos' => json_encode($alternos, JSON_UNESCAPED_UNICODE),
                'activa' => true,
                'orden' => $orden,
                'busqueda' => Busqueda::indexar($nombre.' '.implode(' ', $alternos)),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Los productos que ya existen reciben las categorías que se deducen de su
     * tipo (Comida, Medicamento...) y de los tipos de su negocio (Panadería,
     * Ferretería...), comparando por nombre y por los otros nombres.
     */
    private function asignarAProductosExistentes(): void
    {
        $porNombre = [];
        foreach (DB::table('categorias_catalogo')->get() as $categoria) {
            foreach ([$categoria->nombre, ...json_decode($categoria->nombres_alternos ?? '[]', true)] as $nombre) {
                $porNombre[Busqueda::normalizar($nombre)] = $categoria->id;
            }
        }

        $tiposNegocio = DB::table('negocio_tipo_negocio')
            ->join('tipos_negocio', 'tipos_negocio.id', '=', 'negocio_tipo_negocio.tipo_negocio_id')
            ->get(['negocio_id', 'tipos_negocio.nombre'])
            ->groupBy('negocio_id');

        DB::table('productos')
            ->leftJoin('tipos_producto', 'tipos_producto.id', '=', 'productos.tipo_producto_id')
            ->select('productos.id', 'productos.negocio_id', 'tipos_producto.nombre as tipo')
            ->orderBy('productos.id')
            ->chunk(500, function ($productos) use ($porNombre, $tiposNegocio) {
                $filas = [];
                foreach ($productos as $producto) {
                    $nombres = [$producto->tipo, ...($tiposNegocio[$producto->negocio_id] ?? collect())->pluck('nombre')];
                    $ids = collect($nombres)->filter()
                        ->map(fn ($n) => $porNombre[Busqueda::normalizar($n)] ?? null)
                        ->filter()->unique();
                    foreach ($ids as $id) {
                        $filas[] = ['categoria_catalogo_id' => $id, 'producto_id' => $producto->id];
                    }
                }
                if ($filas) {
                    DB::table('categoria_catalogo_producto')->insertOrIgnore($filas);
                }
            });
    }

    /**
     * Categorías iniciales con sus otros nombres. Los otros nombres incluyen
     * los tipos de negocio parecidos («Droguería» en Medicamentos): así el
     * filtro también muestra esos negocios aunque aún no tengan productos.
     *
     * @return list<array{0: string, 1: list<string>}>
     */
    private function base(): array
    {
        return [
            ['Comida', ['Comidas', 'Almuerzos', 'Restaurante']],
            ['Comidas rápidas', ['Comida rápida', 'Asadero', 'Hamburguesas', 'Perros calientes']],
            ['Bebidas', ['Gaseosas', 'Refrescos', 'Jugos', 'Café']],
            ['Licores', ['Licorería', 'Trago', 'Cerveza']],
            ['Panadería', ['Pan', 'Panes']],
            ['Postres y helados', ['Heladería', 'Helados', 'Dulces', 'Postres']],
            ['Mercado', ['Supermercado', 'Minimercado', 'Víveres', 'Abarrotes', 'Tienda']],
            ['Frutas y verduras', ['Frutería', 'Verduras', 'Frutas']],
            ['Carnes', ['Carnicería', 'Carne']],
            ['Medicamentos', ['Medicamento', 'Droguería', 'Farmacia', 'Medicinas']],
            ['Belleza y aseo', ['Belleza', 'Aseo', 'Cuidado personal', 'Barbería', 'Peluquería']],
            ['Hogar', ['Limpieza', 'Cocina', 'Miscelánea']],
            ['Papelería', ['Útiles escolares', 'Útiles']],
            ['Ferretería', ['Herramienta', 'Herramientas', 'Construcción']],
            ['Repuestos', ['Autopartes', 'Taller de motos', 'Taller de carros']],
            ['Ropa', ['Prendas', 'Vestuario', 'Ropa y calzado']],
            ['Calzado', ['Zapatos', 'Tenis']],
            ['Tecnología', ['Celulares', 'Electrónica', 'Accesorios']],
            ['Mascotas', ['Veterinaria', 'Animales']],
        ];
    }
};
