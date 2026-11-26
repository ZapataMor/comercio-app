<?php

namespace App\Console\Commands;

use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Materiales;
use App\Models\Negocio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Producción y materiales en un restaurante de prueba (por defecto «El Rincón
 * Paisa»): insumos en el inventario y lo que gasta cada plato, que se
 * descuenta «con cada pedido» cuando el pedido queda listo. Deja también unas
 * preparaciones registradas a mano para que el historial no esté vacío.
 *
 * Solo pone receta a los platos cuyo nombre reconoce. Se puede repetir:
 * borra antes los insumos de prueba (por nombre) y lo que se registró con ellos.
 */
class RecetasRestauranteDePrueba extends Command
{
    protected $signature = 'vitrina:recetas-restaurante-de-prueba
        {negocio=El Rincón Paisa : Nombre o id del restaurante}
        {--quitar : Borrar los insumos y recetas de prueba}';

    protected $description = 'Carga insumos y recetas («con cada pedido») de prueba en un restaurante';

    /** clave => [nombre, categoría, unidad, cantidad, mínimo, costo, proveedor] */
    private const INSUMOS = [
        'carne' => ['Carne molida de res', 'Carnes', 'kg', 9, 3, 26000, 'Carnes Finas El Novillo'],
        'chicharron' => ['Tocino para chicharrón', 'Carnes', 'kg', 6, 2, 22000, 'Carnes Finas El Novillo'],
        'gallina' => ['Gallina criolla', 'Carnes', 'kg', 8, 3, 18000, 'Carnes Finas El Novillo'],
        'garra' => ['Garra de cerdo', 'Carnes', 'kg', 4, 2, 12000, 'Carnes Finas El Novillo'],
        'chorizo' => ['Chorizo antioqueño', 'Carnes', 'unidad', 30, 10, 2200, 'Carnes Finas El Novillo'],
        'salchicha' => ['Salchicha ranchera', 'Carnes', 'unidad', 40, 12, 1500, 'Supermercado El Ahorro'],
        'frijol' => ['Fríjol cargamanto', 'Granos', 'kg', 7, 2, 9800, 'Supermercado El Ahorro'],
        'arroz' => ['Arroz blanco', 'Granos', 'kg', 20, 5, 4200, 'Supermercado El Ahorro'],
        'huevo' => ['Huevo AA', 'Lácteos y huevos', 'unidad', 60, 20, 550, 'Supermercado El Ahorro'],
        'queso' => ['Queso tajado', 'Lácteos y huevos', 'unidad', 50, 15, 700, 'Supermercado El Ahorro'],
        'leche' => ['Leche entera', 'Lácteos y huevos', 'l', 10, 3, 4200, 'Supermercado El Ahorro'],
        'maduro' => ['Plátano maduro', 'Frutas y verduras', 'unidad', 25, 8, 900, 'Frutas y Verduras El Campo'],
        'verde' => ['Plátano verde', 'Frutas y verduras', 'unidad', 20, 6, 800, 'Frutas y Verduras El Campo'],
        'aguacate' => ['Aguacate', 'Frutas y verduras', 'unidad', 12, 4, 2500, 'Frutas y Verduras El Campo'],
        'yuca' => ['Yuca', 'Frutas y verduras', 'kg', 8, 3, 2800, 'Frutas y Verduras El Campo'],
        'papa' => ['Papa pastusa', 'Frutas y verduras', 'kg', 15, 5, 3200, 'Frutas y Verduras El Campo'],
        'limon' => ['Limón', 'Frutas y verduras', 'unidad', 40, 15, 300, 'Frutas y Verduras El Campo'],
        'mora' => ['Mora', 'Frutas y verduras', 'kg', 3, 1, 9000, 'Frutas y Verduras El Campo'],
        'arepa' => ['Arepa de maíz', 'Panadería', 'unidad', 40, 12, 600, 'Panadería La Espiga Dorada'],
        'pan' => ['Pan de hamburguesa', 'Panadería', 'unidad', 24, 10, 900, 'Panadería La Espiga Dorada'],
        'panela' => ['Panela', 'Abarrotes', 'kg', 5, 2, 5200, 'Supermercado El Ahorro'],
        'aceite' => ['Aceite vegetal', 'Abarrotes', 'l', 9, 3, 9500, 'Supermercado El Ahorro'],
        'salsas' => ['Salsas de la casa', 'Abarrotes', 'l', 4, 1, 12000, null],
        'empaque' => ['Empaque desechable', 'Empaques', 'unidad', 120, 40, 450, 'Papelería El Lápiz Feliz'],
        'vaso' => ['Vaso con tapa 16 oz', 'Empaques', 'unidad', 90, 30, 300, 'Papelería El Lápiz Feliz'],
    ];

    /** palabra del nombre del plato => [insumo => por porción] */
    private const RECETAS = [
        'bandeja paisa' => ['carne' => 0.15, 'chicharron' => 0.12, 'frijol' => 0.1, 'arroz' => 0.12, 'huevo' => 1, 'maduro' => 0.5, 'arepa' => 1, 'aguacate' => 0.25, 'chorizo' => 1, 'empaque' => 1],
        'sancocho' => ['gallina' => 0.3, 'yuca' => 0.2, 'papa' => 0.15, 'verde' => 0.5, 'arroz' => 0.1, 'aguacate' => 0.25, 'empaque' => 1],
        'garra' => ['frijol' => 0.15, 'garra' => 0.2, 'arroz' => 0.12, 'maduro' => 0.5, 'aguacate' => 0.25, 'empaque' => 1],
        'chicharrón' => ['chicharron' => 0.2, 'arepa' => 2, 'limon' => 1, 'empaque' => 1],
        'hamburguesa sencilla' => ['pan' => 1, 'carne' => 0.15, 'queso' => 1, 'salsas' => 0.03, 'papa' => 0.15, 'aceite' => 0.05, 'empaque' => 1],
        'hamburguesa doble' => ['pan' => 1, 'carne' => 0.3, 'queso' => 2, 'salsas' => 0.04, 'papa' => 0.15, 'aceite' => 0.05, 'empaque' => 1],
        'salchipapa sencilla' => ['salchicha' => 1, 'papa' => 0.25, 'salsas' => 0.03, 'aceite' => 0.08, 'empaque' => 1],
        'salchipapa especial' => ['salchicha' => 2, 'papa' => 0.3, 'queso' => 2, 'huevo' => 1, 'salsas' => 0.05, 'aceite' => 0.1, 'empaque' => 1],
        'limonada' => ['panela' => 0.08, 'limon' => 2, 'vaso' => 1],
        'mora' => ['mora' => 0.15, 'leche' => 0.25, 'panela' => 0.03, 'vaso' => 1],
    ];

    public function handle(): int
    {
        $arg = $this->argument('negocio');
        $negocio = ctype_digit((string) $arg) ? Negocio::find($arg) : Negocio::where('nombre', $arg)->first();
        if (! $negocio) {
            $this->error('No existe ese negocio.');

            return self::FAILURE;
        }
        $nombres = array_column(self::INSUMOS, 0);
        $viejos = $negocio->articulosInventario()->whereIn('nombre', $nombres)->pluck('id');
        DB::transaction(function () use ($negocio, $viejos) {
            $negocio->producciones()->whereHas('movimientos', fn ($q) => $q->whereIn('articulo_id', $viejos))->delete();
            $negocio->articulosInventario()->whereIn('id', $viejos)->delete();
        });
        if ($this->option('quitar')) {
            $this->info("Se borraron {$viejos->count()} insumos de prueba de «{$negocio->nombre}».");

            return self::SUCCESS;
        }

        if (! Gestion::tieneModulo($negocio, 'produccion')) {
            Gestion::activar($negocio);
            Gestion::definirModulos($negocio, [...Gestion::opcionalesEncendidos($negocio), 'produccion']);
        }
        $dueno = $negocio->user;
        $sede = $negocio->sedes()->where('activa', true)->orderByDesc('principal')->first();

        $hechos = DB::transaction(function () use ($negocio, $dueno, $sede) {
            $insumos = [];
            foreach (self::INSUMOS as $clave => [$nombre, $categoria, $unidad, $cantidad, $minimo, $costo, $proveedor]) {
                $a = $negocio->articulosInventario()->create([
                    'tipo' => 'insumo', 'nombre' => $nombre, 'categoria' => $categoria, 'unidad' => $unidad,
                    'minimo' => $minimo, 'costo' => $costo, 'proveedor' => $proveedor, 'sede_id' => $sede?->id,
                ]);
                Inventario::mover($a, 'entrada', $cantidad * 1.5, $dueno, 'Mercado de la semana');
                $insumos[$clave] = $a;
            }

            $hechos = [];
            foreach ($negocio->productos()->get() as $producto) {
                $nombre = mb_strtolower($producto->nombre);
                $receta = collect(self::RECETAS)->first(fn ($r, $palabra) => str_contains($nombre, $palabra));
                if (! $receta) {
                    continue;
                }
                Materiales::guardar($producto, collect($receta)->mapWithKeys(fn ($c, $k) => [$insumos[$k]->id => $c])->all(), 'pedido');
                $hechos[] = $producto;
            }

            // Lo que se preparó adelantado para el almuerzo de los últimos días.
            foreach (array_slice($hechos, 0, 6) as $k => $producto) {
                $p = Materiales::registrar($producto, 3 + $k % 3, $dueno, 'Adelantado para el almuerzo', true);
                $cuando = now()->subDays(5 - $k)->setTime(10, 30);
                $p->forceFill(['created_at' => $cuando, 'updated_at' => $cuando])->saveQuietly();
                $p->movimientos()->update(['created_at' => $cuando, 'updated_at' => $cuando]);
            }

            return $hechos;
        });

        $this->info('«'.$negocio->nombre.'»: '.count(self::INSUMOS).' insumos y '.count($hechos).' platos que descuentan con cada pedido.');

        return self::SUCCESS;
    }
}
