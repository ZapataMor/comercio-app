<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Lo que se considera talla al separar los datos viejos (el resto es color). */
    private const PATRON_TALLA = '/^(x{0,3}s|m|x{0,3}l|\d{1,3}|(talla\s+)?[úu]nica)$/iu';

    private const SUGERENCIAS_TALLAS_ANTES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

    public function up(): void
    {
        // Ropa y calzado: el cliente elige talla Y color, así que dejan de ir
        // mezclados. `atributos` queda con las tallas y `colores` con los colores.
        Schema::table('productos', function (Blueprint $table) {
            $table->json('colores')->nullable()->after('atributos');
        });
        // Solo los tipos que usan colores tienen sugerencias de color.
        Schema::table('tipos_producto', function (Blueprint $table) {
            $table->json('sugerencias_colores')->nullable()->after('sugerencias');
        });
        // Lo que eligió el cliente en esa línea: talla y color, o los
        // ingredientes que quitó y de los que quiere más (solo los del producto).
        Schema::table('pedido_items', function (Blueprint $table) {
            $table->json('opciones')->nullable()->after('cantidad');
        });

        DB::table('tipos_producto')->where('slug', 'ropa-y-calzado')->update([
            'atributo_label' => 'Tallas disponibles',
            'atributo_boton' => 'Añadir talla',
            'sugerencias' => json_encode([
                'XS', 'S', 'M', 'L', 'XL', 'XXL',
                '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44',
            ]),
            'sugerencias_colores' => json_encode([
                'Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde',
                'Beige', 'Café', 'Rosado', 'Amarillo',
            ]),
        ]);

        $this->separarTallasYColores();
    }

    public function down(): void
    {
        $this->juntarTallasYColores();

        DB::table('tipos_producto')->where('slug', 'ropa-y-calzado')->update([
            'atributo_label' => 'Tallas y colores disponibles',
            'atributo_boton' => 'Añadir',
            'sugerencias' => json_encode(self::SUGERENCIAS_TALLAS_ANTES),
        ]);

        Schema::table('pedido_items', fn (Blueprint $table) => $table->dropColumn('opciones'));
        Schema::table('tipos_producto', fn (Blueprint $table) => $table->dropColumn('sugerencias_colores'));
        Schema::table('productos', fn (Blueprint $table) => $table->dropColumn('colores'));
    }

    /** Reparte los valores que el comerciante ya había guardado mezclados. */
    private function separarTallasYColores(): void
    {
        $this->productosDeRopa()->each(function ($producto) {
            $valores = collect(json_decode($producto->atributos ?? '[]', true) ?: []);
            [$tallas, $colores] = $valores->partition(
                fn ($v) => preg_match(self::PATRON_TALLA, trim((string) $v)) === 1,
            );

            DB::table('productos')->where('id', $producto->id)->update([
                'atributos' => $tallas->values()->toJson(),
                'colores' => $colores->values()->toJson(),
            ]);
        });
    }

    private function juntarTallasYColores(): void
    {
        $this->productosDeRopa()->each(function ($producto) {
            $tallas = json_decode($producto->atributos ?? '[]', true) ?: [];
            $colores = json_decode($producto->colores ?? '[]', true) ?: [];

            DB::table('productos')->where('id', $producto->id)->update([
                'atributos' => json_encode([...$tallas, ...$colores]),
            ]);
        });
    }

    private function productosDeRopa()
    {
        return DB::table('productos')
            ->join('tipos_producto', 'tipos_producto.id', '=', 'productos.tipo_producto_id')
            ->where('tipos_producto.slug', 'ropa-y-calzado')
            ->select('productos.*')
            ->get();
    }
};
