<?php

namespace App\Console\Commands;

use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Modelos;
use App\Models\Negocio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Producción y materiales en un restaurante de prueba (por defecto «El Rincón
 * Paisa»): insumos en el inventario y lo que gasta cada plato (platos típicos:
 * bandeja, sancocho, hamburguesas, carnes, picadas, arepas, patacones,
 * perros, jugos, batidos y postres). Solo crea los insumos que usan sus platos, que se
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
        'pollo' => ['Pechuga de pollo', 'Carnes', 'kg', 10, 3, 17000, 'Carnes Finas El Novillo'],
        'res' => ['Carne de res para asar', 'Carnes', 'kg', 9, 3, 32000, 'Carnes Finas El Novillo'],
        'costilla' => ['Costilla de cerdo', 'Carnes', 'kg', 7, 2, 21000, 'Carnes Finas El Novillo'],
        'azucar' => ['Azúcar', 'Abarrotes', 'kg', 6, 2, 4800, 'Supermercado El Ahorro'],
        'harina' => ['Harina de trigo', 'Abarrotes', 'kg', 5, 2, 4200, 'Supermercado El Ahorro'],
        'queso_costeno' => ['Queso costeño', 'Lácteos y huevos', 'kg', 6, 2, 22000, 'Supermercado El Ahorro'],
        'pan_perro' => ['Pan para perro', 'Panadería', 'unidad', 30, 10, 800, 'Panadería La Espiga Dorada'],
        'pan_tajado' => ['Pan tajado', 'Panadería', 'unidad', 40, 12, 350, 'Panadería La Espiga Dorada'],
        'papa_ripio' => ['Papa ripio', 'Abarrotes', 'kg', 3, 1, 16000, 'Supermercado El Ahorro'],
        'hogao' => ['Hogao de la casa', 'Abarrotes', 'l', 3, 1, 9000, null],
        'avena' => ['Avena en hojuelas', 'Abarrotes', 'kg', 4, 1, 7800, 'Supermercado El Ahorro'],
        'almidon' => ['Almidón de yuca', 'Abarrotes', 'kg', 4, 1, 8500, 'Supermercado El Ahorro'],
        'proteina' => ['Proteína en polvo', 'Abarrotes', 'kg', 2, 1, 95000, null],
        'gaseosa' => ['Gaseosa 400 ml', 'Bebidas', 'unidad', 48, 12, 1800, 'Supermercado El Ahorro'],
        'crema_coco' => ['Crema de coco', 'Abarrotes', 'l', 3, 1, 16000, 'Supermercado El Ahorro'],
        'mango' => ['Mango', 'Frutas y verduras', 'kg', 8, 3, 4500, 'Frutas y Verduras El Campo'],
        'maracuya' => ['Maracuyá', 'Frutas y verduras', 'kg', 6, 2, 5200, 'Frutas y Verduras El Campo'],
        'fresa' => ['Fresa', 'Frutas y verduras', 'kg', 5, 2, 9000, 'Frutas y Verduras El Campo'],
        'frutas' => ['Frutas surtidas', 'Frutas y verduras', 'kg', 10, 3, 5000, 'Frutas y Verduras El Campo'],
        'verdes' => ['Espinaca y apio', 'Frutas y verduras', 'kg', 2, 1, 7000, 'Frutas y Verduras El Campo'],
        'verduras' => ['Lechuga y tomate', 'Frutas y verduras', 'kg', 3, 1, 5500, 'Frutas y Verduras El Campo'],
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
        'almuerzo ejecutivo' => ['arroz' => 0.12, 'frijol' => 0.08, 'carne' => 0.12, 'maduro' => 0.5, 'aguacate' => 0.25, 'empaque' => 1],
        'arroz con pollo' => ['pollo' => 0.15, 'arroz' => 0.2, 'empaque' => 1],
        'pechuga' => ['pollo' => 0.25, 'arroz' => 0.12, 'papa' => 0.15, 'empaque' => 1],
        'churrasco' => ['res' => 0.3, 'papa' => 0.2, 'aceite' => 0.05, 'empaque' => 1],
        'costillas' => ['costilla' => 0.4, 'papa' => 0.2, 'salsas' => 0.04, 'empaque' => 1],
        'punta de anca' => ['res' => 0.35, 'papa' => 0.2, 'arepa' => 1, 'empaque' => 1],
        'picada para dos' => ['res' => 0.25, 'chorizo' => 2, 'chicharron' => 0.2, 'maduro' => 1, 'arepa' => 2, 'papa' => 0.3, 'empaque' => 1],
        'picada familiar' => ['res' => 0.5, 'chorizo' => 4, 'chicharron' => 0.4, 'maduro' => 2, 'arepa' => 4, 'papa' => 0.6, 'empaque' => 2],
        'tres leches' => ['leche' => 0.15, 'huevo' => 1, 'harina' => 0.05, 'azucar' => 0.05, 'empaque' => 1],
        'flan' => ['leche' => 0.12, 'huevo' => 1, 'azucar' => 0.04, 'empaque' => 1],
        'arepa de queso' => ['arepa' => 1, 'queso_costeno' => 0.08, 'empaque' => 1],
        'arepa mixta' => ['arepa' => 1, 'queso_costeno' => 0.06, 'pollo' => 0.06, 'carne' => 0.06, 'salsas' => 0.02, 'empaque' => 1],
        'reina pepiada' => ['arepa' => 1, 'pollo' => 0.1, 'aguacate' => 0.5, 'salsas' => 0.02, 'empaque' => 1],
        'arepa de huevo' => ['arepa' => 1, 'huevo' => 1, 'carne' => 0.05, 'aceite' => 0.05, 'empaque' => 1],
        'patacón con todo' => ['verde' => 1, 'pollo' => 0.06, 'carne' => 0.06, 'queso_costeno' => 0.05, 'salsas' => 0.03, 'aceite' => 0.05, 'empaque' => 1],
        'patacón con hogao' => ['verde' => 1, 'hogao' => 0.05, 'aceite' => 0.05, 'empaque' => 1],
        'perro sencillo' => ['pan_perro' => 1, 'salchicha' => 1, 'papa_ripio' => 0.03, 'salsas' => 0.03, 'empaque' => 1],
        'perro especial' => ['pan_perro' => 1, 'salchicha' => 1, 'queso_costeno' => 0.04, 'papa_ripio' => 0.04, 'salsas' => 0.04, 'empaque' => 1],
        'avena' => ['avena' => 0.05, 'leche' => 0.25, 'azucar' => 0.03, 'vaso' => 1],
        'gaseosa' => ['gaseosa' => 1],
        'jugo de mango' => ['mango' => 0.2, 'azucar' => 0.03, 'vaso' => 1],
        'maracuyá' => ['maracuya' => 0.15, 'azucar' => 0.04, 'vaso' => 1],
        'limonada de coco' => ['limon' => 2, 'crema_coco' => 0.08, 'azucar' => 0.03, 'vaso' => 1],
        'batido de fresa' => ['fresa' => 0.15, 'leche' => 0.25, 'azucar' => 0.03, 'vaso' => 1],
        'batido verde' => ['verdes' => 0.08, 'mango' => 0.1, 'limon' => 1, 'vaso' => 1],
        'batido proteico' => ['proteina' => 0.03, 'leche' => 0.3, 'frutas' => 0.1, 'vaso' => 1],
        'salpicón' => ['frutas' => 0.25, 'vaso' => 1],
        'ensalada de frutas' => ['frutas' => 0.3, 'queso_costeno' => 0.03, 'empaque' => 1],
        'sándwich de pollo' => ['pan_tajado' => 2, 'pollo' => 0.1, 'verduras' => 0.05, 'salsas' => 0.02, 'empaque' => 1],
        'pandebono' => ['almidon' => 0.04, 'queso_costeno' => 0.04, 'huevo' => 0.2],
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
            // Los modelos «con cada pedido» que se quedaron sin ingredientes.
            $negocio->modelosProduccion()->where('al_pedido', true)->whereDoesntHave('materiales')->delete();
        });
        if ($this->option('quitar')) {
            $this->info("Se borraron {$viejos->count()} insumos de prueba de «{$negocio->nombre}».");

            return self::SUCCESS;
        }

        if (! Gestion::tieneModulo($negocio, 'inventario')) {
            Gestion::activar($negocio);
            Gestion::definirModulos($negocio, [...Gestion::opcionalesEncendidos($negocio), 'inventario']);
        }
        $dueno = $negocio->user;
        $sede = $negocio->sedes()->where('activa', true)->orderByDesc('principal')->first();

        $recetas = collect(self::RECETAS)->sortByDesc(fn ($r, $palabra) => mb_strlen($palabra));
        $platos = $negocio->productos()->get()
            ->map(fn ($p) => [$p, $recetas->first(fn ($r, $palabra) => str_contains(mb_strtolower($p->nombre), $palabra))])
            ->filter(fn ($par) => $par[1] !== null)->values();
        $usados = $platos->flatMap(fn ($par) => array_keys($par[1]))->unique()->all();

        $hechos = DB::transaction(function () use ($negocio, $dueno, $sede, $platos, $usados) {
            $insumos = [];
            foreach (array_intersect_key(self::INSUMOS, array_flip($usados)) as $clave => [$nombre, $categoria, $unidad, $cantidad, $minimo, $costo, $proveedor]) {
                $a = $negocio->articulosInventario()->create([
                    'tipo' => 'material', 'nombre' => $nombre, 'categoria' => $categoria, 'unidad' => $unidad,
                    'minimo' => $minimo, 'costo' => $costo, 'proveedor' => $proveedor, 'sede_id' => $sede?->id,
                ]);
                Inventario::mover($a, 'entrada', $cantidad * 1.5, $dueno, 'Mercado de la semana');
                $insumos[$clave] = $a;
            }

            // Cada plato: un modelo «con cada pedido» con sus ingredientes.
            $hechos = [];
            foreach ($platos as [$producto, $receta]) {
                Modelos::guardar($negocio, $producto->modelo, ['nombre' => $producto->nombre, 'al_pedido' => true],
                    collect($receta)->mapWithKeys(fn ($c, $k) => [$insumos[$k]->id => $c])->all(), [$producto->id]);
                $hechos[] = $producto;
            }

            return $hechos;
        });

        $this->info('«'.$negocio->nombre.'»: '.count($usados).' insumos y '.count($hechos).' platos que descuentan con cada pedido.');

        return self::SUCCESS;
    }
}
