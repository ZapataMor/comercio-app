<?php

namespace Database\Seeders;

use App\Models\Negocio;
use App\Models\TipoProducto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Le da a cada restaurante y asadero de demostración una carta propia con
 * comida real: hamburguesas, perros, salchipapas, picadas, pizzas, arepas...
 * Cada plato trae descripción e ingredientes, que el cliente puede quitar o
 * pedir de más.
 *
 * Pensado para desarrollo. Se puede correr varias veces: solo añade los platos
 * que el negocio no tiene, y no revive los que el comerciante haya borrado.
 */
class MenusRestaurantesDemoSeeder extends Seeder
{
    /** Secciones de la carta de cada negocio, además de lo que ya vendía. */
    private const CARTAS = [
        'El Rincón Paisa' => ['Hamburguesas', 'Salchipapas', 'Picadas', 'Patacones rellenos'],
        'Sazón de la Abuela' => ['Comida guajira', 'Arepas rellenas', 'Perros calientes'],
        'La Fonda Antioqueña' => ['Picadas', 'Arepas rellenas', 'Costillas'],
        'Doña Rosa Restaurante' => ['Pizzas', 'Hamburguesas', 'Sándwiches'],
        'El Buen Sabor' => ['Hamburguesas', 'Perros calientes', 'Salchipapas', 'Comida árabe'],
        'Asadero El Carbón' => ['Picadas', 'Costillas', 'Alitas'],
        'Pollos La Brasa Dorada' => ['Alitas', 'Salchipapas', 'Sándwiches'],
        'Asadero Doña Tere' => ['Picadas', 'Patacones rellenos', 'Perros calientes'],
        'El Fogón del Pollo' => ['Hamburguesas', 'Salchipapas', 'Alitas'],
    ];

    /**
     * Sección → platos: [nombre, unidad, precio base, descripción, ingredientes].
     *
     * @var array<string, array<int, array{0:string,1:string,2:int,3:string,4:array<int,string>}>>
     */
    private const SECCIONES = [
        'Hamburguesas' => [
            ['Hamburguesa sencilla', 'unidad', 14000, 'Carne de res a la plancha en pan artesanal, con papas a la francesa.', ['Pan artesanal', 'Carne de res 150 g', 'Queso cheddar', 'Lechuga', 'Tomate', 'Cebolla', 'Salsa de la casa', 'Papa a la francesa']],
            ['Hamburguesa doble carne', 'unidad', 21000, 'Dos carnes, doble queso y tocineta crocante.', ['Pan artesanal', 'Carne de res 150 g x2', 'Queso cheddar x2', 'Tocineta', 'Lechuga', 'Tomate', 'Cebolla caramelizada', 'Salsa de la casa', 'Papa a la francesa']],
            ['Hamburguesa de pollo crispy', 'unidad', 17000, 'Pechuga apanada y crocante con salsa de miel y mostaza.', ['Pan artesanal', 'Pechuga apanada', 'Queso mozzarella', 'Lechuga', 'Tomate', 'Salsa miel mostaza', 'Papa a la francesa']],
            ['Hamburguesa ranchera', 'unidad', 23000, 'Con huevo frito, chorizo y salsa BBQ. Para llegar con hambre.', ['Pan artesanal', 'Carne de res 150 g', 'Chorizo', 'Huevo frito', 'Queso costeño', 'Tocineta', 'Lechuga', 'Salsa BBQ', 'Papa a la francesa']],
        ],
        'Perros calientes' => [
            ['Perro sencillo', 'unidad', 9000, 'El clásico de esquina, con papita triturada encima.', ['Pan de perro', 'Salchicha', 'Papita triturada', 'Cebolla', 'Salsa de tomate', 'Mayonesa', 'Mostaza']],
            ['Perro con todo', 'unidad', 13000, 'Bien cargado de queso y tocineta.', ['Pan de perro', 'Salchicha americana', 'Queso costeño', 'Tocineta', 'Papita triturada', 'Cebolla', 'Salsa de piña', 'Salsa de tomate', 'Mayonesa']],
            ['Perro ranchero', 'unidad', 15000, 'Con huevo de codorniz y carne desmechada.', ['Pan de perro', 'Salchicha ranchera', 'Carne desmechada', 'Huevo de codorniz', 'Queso mozzarella', 'Papita triturada', 'Salsa rosada']],
        ],
        'Salchipapas' => [
            ['Salchipapa sencilla', 'porción', 12000, 'Papas fritas y salchicha en rodajas, para una persona.', ['Papa a la francesa', 'Salchicha', 'Salsa de tomate', 'Mayonesa', 'Mostaza']],
            ['Salchipapa especial', 'porción', 17000, 'Con queso gratinado, tocineta y huevos de codorniz.', ['Papa a la francesa', 'Salchicha', 'Queso gratinado', 'Tocineta', 'Huevo de codorniz', 'Salsa rosada', 'Salsa de tomate']],
            ['Salchipollo', 'porción', 19000, 'Salchipapa con trocitos de pollo apanado.', ['Papa a la francesa', 'Salchicha', 'Pollo apanado', 'Queso gratinado', 'Salsa de ajo', 'Salsa de tomate']],
            ['Salchipapa para compartir', 'porción', 32000, 'Porción grande para dos o tres personas.', ['Papa a la francesa', 'Salchicha', 'Chorizo', 'Pollo desmechado', 'Queso gratinado', 'Tocineta', 'Maíz tierno', 'Salsa rosada', 'Salsa de piña']],
        ],
        'Picadas' => [
            ['Picada personal', 'porción', 25000, 'Un poco de todo para una persona, con limón y ají.', ['Chicharrón', 'Chorizo', 'Carne de res', 'Papa criolla', 'Arepa', 'Guacamole', 'Limón']],
            ['Picada para dos', 'porción', 45000, 'Carnes a la parrilla con acompañantes para dos.', ['Carne de res', 'Pechuga', 'Chicharrón', 'Chorizo', 'Morcilla', 'Papa criolla', 'Patacón', 'Arepa', 'Guacamole', 'Ají']],
            ['Picada familiar', 'porción', 85000, 'Bandeja grande para cuatro o cinco personas.', ['Carne de res', 'Costilla de cerdo', 'Pechuga', 'Chicharrón', 'Chorizo', 'Morcilla', 'Papa criolla', 'Yuca frita', 'Patacón', 'Arepa', 'Maduro', 'Guacamole', 'Ají']],
        ],
        'Patacones rellenos' => [
            ['Patacón de carne desmechada', 'unidad', 16000, 'Patacón grande y crocante con carne en hogao.', ['Plátano verde', 'Carne desmechada', 'Hogao', 'Queso costeño', 'Suero costeño']],
            ['Patacón de pollo', 'unidad', 15000, 'Con pollo desmechado y maíz tierno.', ['Plátano verde', 'Pollo desmechado', 'Maíz tierno', 'Queso mozzarella', 'Salsa rosada']],
            ['Patacón mixto', 'unidad', 19000, 'Carne, pollo y chicharrón sobre patacón.', ['Plátano verde', 'Carne desmechada', 'Pollo desmechado', 'Chicharrón', 'Queso costeño', 'Guacamole']],
        ],
        'Arepas rellenas' => [
            ['Arepa de huevo', 'unidad', 5000, 'Frita al momento, con huevo y carne molida.', ['Arepa de maíz', 'Huevo', 'Carne molida', 'Ají']],
            ['Arepa de carne desmechada', 'unidad', 12000, 'Arepa asada, rellena de carne y queso.', ['Arepa de maíz', 'Carne desmechada', 'Hogao', 'Queso mozzarella', 'Mantequilla']],
            ['Arepa mixta', 'unidad', 15000, 'Carne, pollo, maíz tierno y queso gratinado.', ['Arepa de maíz', 'Carne desmechada', 'Pollo desmechado', 'Maíz tierno', 'Queso gratinado', 'Salsa de ajo']],
        ],
        'Costillas' => [
            ['Costillas BBQ', 'porción', 32000, 'Costillas de cerdo en salsa BBQ, cocidas lento hasta deshacerse.', ['Costilla de cerdo', 'Salsa BBQ', 'Papa a la francesa', 'Ensalada de repollo']],
            ['Costillas a la miel', 'porción', 34000, 'Glaseadas con miel y mostaza.', ['Costilla de cerdo', 'Miel', 'Mostaza', 'Papa salada', 'Ensalada de repollo']],
        ],
        'Alitas' => [
            ['Alitas BBQ x8', 'porción', 19000, 'Ocho alitas bañadas en salsa BBQ.', ['Alitas', 'Salsa BBQ', 'Papa a la francesa', 'Salsa ranch']],
            ['Alitas picantes x8', 'porción', 19000, 'Ocho alitas con salsa picante de la casa.', ['Alitas', 'Salsa picante', 'Papa a la francesa', 'Salsa ranch', 'Apio']],
            ['Alitas para compartir x20', 'porción', 42000, 'Veinte alitas con dos salsas a elegir.', ['Alitas', 'Salsa BBQ', 'Salsa picante', 'Papa a la francesa', 'Salsa ranch']],
        ],
        'Pizzas' => [
            ['Pizza hawaiana personal', 'unidad', 16000, 'Masa delgada de 20 cm, horneada al momento.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Jamón', 'Piña']],
            ['Pizza de pepperoni personal', 'unidad', 17000, 'Masa delgada de 20 cm con pepperoni.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Pepperoni', 'Orégano']],
            ['Pizza mexicana mediana', 'unidad', 34000, 'Ocho porciones con carne y jalapeños.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Carne molida', 'Maíz tierno', 'Pimentón', 'Jalapeños']],
            ['Pizza de la casa grande', 'unidad', 46000, 'Doce porciones con pollo, champiñones y tocineta.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Pollo', 'Champiñones', 'Tocineta', 'Cebolla']],
        ],
        'Sándwiches' => [
            ['Sándwich cubano', 'unidad', 15000, 'Prensado y caliente, con pepinillos.', ['Pan baguette', 'Cerdo', 'Jamón', 'Queso', 'Pepinillos', 'Mostaza']],
            ['Sándwich de pollo', 'unidad', 14000, 'Pollo desmechado en salsa cremosa.', ['Pan baguette', 'Pollo desmechado', 'Queso mozzarella', 'Lechuga', 'Tomate', 'Salsa de ajo']],
            ['Sándwich de carne', 'unidad', 16000, 'Carne a la plancha con cebolla caramelizada.', ['Pan baguette', 'Carne de res', 'Queso cheddar', 'Cebolla caramelizada', 'Tomate', 'Salsa BBQ']],
        ],
        'Comida guajira' => [
            ['Chivo guisado', 'porción', 28000, 'Chivo guajiro en guiso, con arroz con coco.', ['Chivo', 'Arroz con coco', 'Yuca cocida', 'Plátano maduro', 'Ensalada']],
            ['Friche', 'porción', 30000, 'Chivo frito tradicional de La Guajira.', ['Chivo', 'Yuca cocida', 'Arepa de maíz', 'Suero costeño']],
            ['Cayeye con queso', 'porción', 12000, 'Puré de guineo verde con queso y huevo.', ['Guineo verde', 'Queso costeño', 'Hogao', 'Huevo frito']],
        ],
        'Comida árabe' => [
            ['Shawarma de pollo', 'unidad', 16000, 'Pollo marinado en pan árabe, tradición de Maicao.', ['Pan árabe', 'Pollo marinado', 'Lechuga', 'Tomate', 'Cebolla', 'Salsa de ajo']],
            ['Shawarma de carne', 'unidad', 18000, 'Carne marinada con especias árabes.', ['Pan árabe', 'Carne de res', 'Tomate', 'Cebolla', 'Perejil', 'Salsa tahini']],
            ['Kibbe frito x3', 'porción', 12000, 'Tres kibbes de carne y trigo, con limón.', ['Trigo', 'Carne molida', 'Cebolla', 'Hierbabuena', 'Limón']],
            ['Tabule', 'porción', 9000, 'Ensalada fresca de perejil y trigo.', ['Perejil', 'Trigo', 'Tomate', 'Hierbabuena', 'Limón', 'Aceite de oliva']],
        ],
    ];

    public function run(): void
    {
        $comida = TipoProducto::where('slug', TipoProducto::SLUG_COMIDA)->value('id');

        if (! $comida) {
            return;
        }

        DB::transaction(function () use ($comida) {
            foreach (self::CARTAS as $nombre => $secciones) {
                $negocio = Negocio::where('nombre', $nombre)->first();
                if (! $negocio) {
                    continue;
                }

                foreach ($secciones as $seccion) {
                    $this->sembrarSeccion($negocio, $seccion, $comida);
                }
            }
        });
    }

    private function sembrarSeccion(Negocio $negocio, string $seccion, int $comida): void
    {
        $categoria = $negocio->categorias()->firstOrCreate(['nombre' => $seccion]);

        foreach (self::SECCIONES[$seccion] as [$nombre, $unidad, $precio, $descripcion, $ingredientes]) {
            if ($negocio->productos()->withTrashed()->where('nombre', $nombre)->exists()) {
                continue;
            }

            $negocio->productos()->create([
                'nombre' => $nombre,
                'descripcion' => $descripcion,
                // Cada negocio pone su precio: hasta $1.000 por encima o $500 por debajo.
                'precio' => $precio + rand(-1, 2) * 500,
                'unidad_medida' => $unidad,
                'categoria_id' => $categoria->id,
                'tipo_producto_id' => $comida,
                'atributos' => $ingredientes,
            ]);
        }
    }
}
