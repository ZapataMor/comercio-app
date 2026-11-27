<?php

namespace App\Console\Commands;

use App\Gestion\Etapas;
use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Modelos;
use App\Models\InventarioArticulo;
use App\Models\Negocio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Inventario de prueba como el de una latonería (Grumar): tubos, láminas,
 * ángulos y varillas con calibre y medidas, insumos de soldadura y pintura,
 * algunas puertas terminadas y herramientas; unos por acabarse y otros
 * agotados, para ver las tarjetas, alertas y movimientos llenos.
 *
 * Enciende el módulo «inventario» del negocio si no lo tiene. Se puede
 * repetir: borra antes los artículos de prueba (por nombre) y los vuelve a crear.
 */
class InventarioDePrueba extends Command
{
    protected $signature = 'vitrina:inventario-de-prueba
        {negocio : Id del negocio}
        {--con-productos : También crea un portón, una puerta y una reja en el catálogo con los materiales que gastan}
        {--quitar : Borrar los artículos (y productos) de prueba en vez de crearlos}';

    protected $description = 'Carga materiales y herramientas de prueba (y, si se pide, productos con su modelo) en un negocio';

    /** [tipo, nombre, categoría, unidad, cantidad, mínimo, costo, proveedor, características, movimientos [tipo, cantidad, nota]] */
    private const ARTICULOS = [
        ['materia_prima', 'Tubo cuadrado 1"', 'Tubos', 'unidad', 34, 10, 52000, 'Ferretería El Tornillo', ['Material' => 'Hierro', 'Calibre' => '18', 'Medida' => '1 x 1 pulgada', 'Largo' => '6 m'], [['salida', 6, 'Puerta del señor Pérez'], ['salida', 4, 'Reja de la ventana corrediza']]],
        ['materia_prima', 'Tubo cuadrado 1"', 'Tubos', 'unidad', 8, 10, 44000, 'Ferretería El Tornillo', ['Material' => 'Hierro', 'Calibre' => '20', 'Medida' => '1 x 1 pulgada', 'Largo' => '6 m'], [['salida', 5, 'Portón de la bodega']]],
        ['materia_prima', 'Tubo rectangular 2 x 1"', 'Tubos', 'unidad', 22, 8, 68000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '18', 'Medida' => '2 x 1 pulgada', 'Largo' => '6 m'], []],
        ['materia_prima', 'Tubo redondo 3/4"', 'Tubos', 'unidad', 0, 6, 31000, 'Aceros del Caribe', ['Material' => 'Hierro galvanizado', 'Calibre' => '20', 'Diámetro' => '3/4 pulgada', 'Largo' => '6 m'], [['salida', 12, 'Barandas de la escalera']]],
        ['materia_prima', 'Lámina lisa', 'Láminas', 'lamina', 15, 5, 118000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '18', 'Medida' => '1,22 x 2,44 m', 'Acabado' => 'Cold rolled'], [['salida', 3, 'Puertas de la casa de la 15']]],
        ['materia_prima', 'Lámina galvanizada', 'Láminas', 'lamina', 4, 5, 96000, 'Ferretería El Tornillo', ['Material' => 'Hierro galvanizado', 'Calibre' => '20', 'Medida' => '1 x 2 m'], []],
        ['materia_prima', 'Ángulo 1 x 1/8"', 'Perfiles', 'unidad', 18, 6, 39000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Medida' => '1 x 1/8 pulgada', 'Largo' => '6 m', 'Forma' => 'L'], []],
        ['materia_prima', 'Platina 1 x 1/8"', 'Perfiles', 'unidad', 25, 8, 21000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Medida' => '1 x 1/8 pulgada', 'Largo' => '6 m'], []],
        ['materia_prima', 'Varilla cuadrada 1/2"', 'Varillas', 'unidad', 40, 15, 18500, 'Ferretería El Tornillo', ['Material' => 'Hierro', 'Medida' => '1/2 pulgada', 'Largo' => '6 m', 'Uso' => 'Rejas y protectores'], []],
        ['materia_prima', 'Vidrio claro 4 mm', 'Vidrios', 'm2', 12.5, 4, 62000, 'Vidrios La Guajira', ['Espesor' => '4 mm', 'Color' => 'Claro'], [['salida', 2.5, 'Ventana batiente']]],
        ['insumo', 'Soldadura 6013 1/8"', 'Soldadura', 'kg', 7.5, 5, 24000, 'Ferretería El Tornillo', ['Referencia' => 'E6013', 'Diámetro' => '1/8 pulgada', 'Marca' => 'West Arco'], [['salida', 2.5, 'Semana del 17 de noviembre']]],
        ['insumo', 'Disco de corte 7"', 'Discos', 'unidad', 3, 10, 6500, 'Ferretería El Tornillo', ['Medida' => '7 pulgadas', 'Uso' => 'Metal', 'Marca' => 'Norton'], [['salida', 9, 'Gasto de la semana']]],
        ['insumo', 'Disco de pulir 4 1/2"', 'Discos', 'unidad', 14, 6, 7800, 'Ferretería El Tornillo', ['Medida' => '4 1/2 pulgadas', 'Grano' => '60'], []],
        ['insumo', 'Anticorrosivo gris', 'Pinturas', 'gal', 2, 3, 78000, 'Pinturas El Arcoíris', ['Color' => 'Gris', 'Acabado' => 'Mate', 'Presentación' => 'Galón'], []],
        ['insumo', 'Esmalte negro', 'Pinturas', 'gal', 5, 2, 92000, 'Pinturas El Arcoíris', ['Color' => 'Negro', 'Acabado' => 'Brillante', 'Presentación' => 'Galón'], []],
        ['insumo', 'Bisagra de cazoleta 3"', 'Herrajes', 'par', 30, 10, 4500, 'Ferretería El Tornillo', ['Medida' => '3 pulgadas', 'Material' => 'Acero'], []],
        ['producto', 'Puerta lámina 0,90 x 2,10', 'Puertas', 'unidad', 3, 1, 680000, null, ['Ancho' => '90 cm', 'Alto' => '210 cm', 'Calibre' => '18', 'Apertura' => 'Derecha', 'Color' => 'Negro', 'Con protector' => 'Sí'], []],
        ['producto', 'Ventana corrediza 1,20 x 1,00', 'Ventanas', 'unidad', 2, 1, 420000, null, ['Ancho' => '120 cm', 'Alto' => '100 cm', 'Lleva' => 'Vidrio', 'Con reja' => 'No', 'Color' => 'Blanco'], []],
        ['herramienta', 'Pulidora 4 1/2"', 'Herramientas', 'unidad', 4, null, 289000, 'Ferretería El Tornillo', ['Marca' => 'DeWalt', 'Potencia' => '900 W'], []],
        ['herramienta', 'Equipo de soldar', 'Herramientas', 'unidad', 2, null, 1450000, 'Soldaduras Maicao', ['Marca' => 'Lincoln', 'Amperaje' => '225 A'], []],
    ];

    /** Productos del catálogo con lo que gasta cada uno: [nombre, precio, [referencia => cantidad]]. */
    private const PRODUCTOS = [
        ['Portón 3 x 2,20 m', 2800000, ['GR-003' => 6, 'GR-005' => 2, 'GR-009' => 4, 'GR-011' => 1.5, 'GR-012' => 2, 'GR-014' => 0.5, 'GR-016' => 3]],
        ['Puerta en lámina 0,90 x 2,10 m', 680000, ['GR-001' => 3, 'GR-005' => 1, 'GR-011' => 0.5, 'GR-012' => 1, 'GR-015' => 0.25, 'GR-016' => 2]],
        ['Reja de ventana 1,20 x 1,00 m', 350000, ['GR-009' => 5, 'GR-008' => 1, 'GR-011' => 0.3, 'GR-014' => 0.25]],
    ];

    public function handle(): int
    {
        $negocio = Negocio::find($this->argument('negocio'));
        if (! $negocio) {
            $this->error('No existe ese negocio.');

            return self::FAILURE;
        }
        $nombres = array_unique(array_column(self::ARTICULOS, 1));
        $borrados = $negocio->articulosInventario()->whereIn('nombre', $nombres)->delete();
        $negocio->productos()->withTrashed()->whereIn('nombre', array_column(self::PRODUCTOS, 0))->get()->each->forceDelete();
        $negocio->producciones()->whereIn('nombre', array_column(self::PRODUCTOS, 0))->delete();
        if ($this->option('quitar')) {
            $this->info("Se borraron {$borrados} artículos de prueba de «{$negocio->nombre}».");

            return self::SUCCESS;
        }

        if (! Gestion::tieneModulo($negocio, 'inventario')) {
            Gestion::activar($negocio);
            Gestion::definirModulos($negocio, [...Gestion::opcionalesEncendidos($negocio), 'inventario']);
        }
        $quien = $negocio->user;
        $sede = $negocio->sedes()->where('activa', true)->orderByDesc('principal')->first();

        DB::transaction(function () use ($negocio, $quien, $sede) {
            foreach (self::ARTICULOS as $i => [$tipo, $nombre, $categoria, $unidad, $cantidad, $minimo, $costo, $proveedor, $rasgos, $movimientos]) {
                $articulo = $negocio->articulosInventario()->create([
                    'tipo' => $tipo === 'herramienta' ? 'herramienta' : 'material', 'nombre' => $nombre, 'categoria' => $categoria, 'unidad' => $unidad,
                    'minimo' => $minimo, 'costo' => $costo, 'proveedor' => $proveedor, 'sede_id' => $sede?->id,
                    'referencia' => sprintf('GR-%03d', $i + 1),
                    'caracteristicas' => collect($rasgos)->map(fn ($valor, $nombre) => ['nombre' => $nombre, 'valor' => $valor])->values()->all(),
                ]);
                // La existencia se arma con movimientos, de hace unos días a hoy.
                $gastado = array_sum(array_map(fn ($m) => $m[0] === 'salida' ? $m[1] : 0, $movimientos));
                $hace = count($movimientos) + 2;
                $this->mover($articulo, 'entrada', $cantidad + $gastado, $quien, 'Existencia inicial', $hace);
                foreach ($movimientos as $j => [$tipoMov, $cuanto, $nota]) {
                    $this->mover($articulo, $tipoMov, $cuanto, $quien, $nota, $hace - $j - 1);
                }
            }
        });

        $this->info('Se cargaron '.count(self::ARTICULOS)." artículos en el inventario de «{$negocio->nombre}».");

        if ($this->option('con-productos')) {
            $porReferencia = $negocio->articulosInventario()->whereIn('nombre', $nombres)->pluck('id', 'referencia');
            foreach (self::PRODUCTOS as $i => [$nombre, $precio, $receta]) {
                $producto = $negocio->productos()->create(['nombre' => $nombre, 'precio' => $precio, 'disponible' => true, 'descripcion' => 'Producto de prueba de Materiales y producción.']);
                $modelo = Modelos::guardar($negocio, null, ['nombre' => $nombre], collect($receta)->mapWithKeys(fn ($c, $ref) => [$porReferencia[$ref] => $c])->all(), [$producto->id]);
                if ($i === 1) {
                    // Una por hacer, para ver la etapa 1 con sus materiales.
                    Etapas::crear($negocio, $modelo, null, 1, $quien, 'Para el señor Pérez');
                }
            }
            $this->info('Se crearon '.count(self::PRODUCTOS).' productos con su modelo y sus materiales.');
        }

        return self::SUCCESS;
    }

    private function mover(InventarioArticulo $articulo, string $tipo, float $cantidad, $quien, string $nota, int $diasAtras): void
    {
        if ($cantidad <= 0) {
            return;
        }
        $m = Inventario::mover($articulo, $tipo, $cantidad, $quien, $nota);
        $cuando = now()->subDays($diasAtras)->setTime(8 + ($m->id % 9), ($m->id * 7) % 60);
        $m->forceFill(['created_at' => $cuando, 'updated_at' => $cuando])->saveQuietly();
    }
}
