<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * Llena la app con un catálogo realista de demostración:
 *   - 60+ negocios de distintos tipos (restaurantes, bares, ferreterías...).
 *   - Cada negocio con sus categorías.
 *   - Muchos productos, con distintos tipos de venta:
 *       cantidad (unidades/porciones/combos/paquetes),
 *       peso (por kg / libra), volumen (por litro), longitud (por metro).
 *
 * Cada negocio pertenece a un usuario comerciante (contraseña 'password123').
 * Pensado para desarrollo. Se puede correr varias veces sin duplicar.
 */
class CatalogoDemoSeeder extends Seeder
{
    public function run(): void
    {
        Role::findOrCreate('comerciante', 'web');

        DB::transaction(function () {
            foreach ($this->tiendas() as [$nombreTienda, $tipo]) {
                $this->crearTienda($nombreTienda, $tipo);
            }
        });
    }

    /**
     * Crea (o reutiliza) el comerciante, su negocio, categorías y productos.
     */
    private function crearTienda(string $nombre, string $tipo): void
    {
        $slug = Str::slug($nombre);

        $dueno = User::updateOrCreate(
            ['email' => "{$slug}@demo.co"],
            ['name' => $nombre, 'password' => 'password123'],
        );
        $dueno->syncRoles(['comerciante']);

        $negocio = $dueno->negocio()->firstOrCreate([
            'nombre' => $nombre,
        ], [
            'descripcion' => $this->descripcionPorTipo($tipo),
            'direccion' => 'Calle '.rand(1, 90).' # '.rand(1, 50).'-'.rand(1, 99),
            'telefono' => '3'.rand(0, 1).rand(10_000_000, 99_999_999),
            'activo' => true,
        ]);

        // Si el negocio ya tiene productos, no volvemos a sembrar (idempotente).
        if ($negocio->productos()->exists()) {
            return;
        }

        foreach ($this->catalogo($tipo) as $nombreCategoria => $productos) {
            $categoria = $negocio->categorias()->firstOrCreate(['nombre' => $nombreCategoria]);

            $filas = [];
            foreach ($productos as [$nombreProd, $tipoVenta, $unidad, $min, $max]) {
                $filas[] = [
                    'nombre' => $nombreProd,
                    'precio' => $this->precioAleatorio($min, $max),
                    'tipo_venta' => $tipoVenta,
                    'unidad_medida' => $unidad,
                    'categoria_id' => $categoria->id,
                    'disponible' => rand(1, 10) > 1, // ~10% no disponibles
                ];
            }

            $negocio->productos()->createMany($filas);
        }
    }

    /** Precio aleatorio entre min y max, redondeado a la centena de peso. */
    private function precioAleatorio(int $min, int $max): int
    {
        return (int) round(rand($min, $max) / 100) * 100;
    }

    private function descripcionPorTipo(string $tipo): string
    {
        return match ($tipo) {
            'restaurante' => 'Comida casera y platos a la carta.',
            'asadero' => 'Pollo asado al carbón y combos para compartir.',
            'cafeteria' => 'Café de origen, panadería y desayunos.',
            'bar' => 'Cervezas, cocteles y picadas.',
            'heladeria' => 'Helados artesanales, malteadas y postres fríos.',
            'panaderia' => 'Pan fresco del día, pasteles y tortas.',
            'papeleria' => 'Útiles escolares, papelería y fotocopias.',
            'ferreteria' => 'Herramientas, materiales y artículos de construcción.',
            'ropa' => 'Ropa y accesorios para toda la familia.',
            'fruteria' => 'Frutas y verduras frescas del campo.',
            'carniceria' => 'Carnes frescas de res, cerdo y pollo.',
            'drogueria' => 'Medicamentos y productos de cuidado personal.',
            'licoreria' => 'Licores nacionales e importados.',
            'minimercado' => 'Víveres, abarrotes y productos de la canasta familiar.',
            default => 'Negocio local.',
        };
    }

    /**
     * Listado de tiendas: [nombre, tipo]. Nombres realistas, sin "Tienda 1".
     *
     * @return array<int, array{0:string,1:string}>
     */
    private function tiendas(): array
    {
        return [
            // Restaurantes
            ['El Rincón Paisa', 'restaurante'],
            ['Sazón de la Abuela', 'restaurante'],
            ['La Fonda Antioqueña', 'restaurante'],
            ['Doña Rosa Restaurante', 'restaurante'],
            ['El Buen Sabor', 'restaurante'],
            // Asaderos
            ['Asadero El Carbón', 'asadero'],
            ['Pollos La Brasa Dorada', 'asadero'],
            ['Asadero Doña Tere', 'asadero'],
            ['El Fogón del Pollo', 'asadero'],
            // Cafeterías
            ['Café de la Esquina', 'cafeteria'],
            ['Aroma Café', 'cafeteria'],
            ['Tinto y Pan', 'cafeteria'],
            ['La Bohemia Café', 'cafeteria'],
            // Bares
            ['La Cantina de Pepe', 'bar'],
            ['Bar La Estación', 'bar'],
            ['El Botellón', 'bar'],
            ['Luna Bar', 'bar'],
            // Heladerías
            ['Frutos del Trópico', 'heladeria'],
            ['Helados La Nieve', 'heladeria'],
            ['Polo Norte Helados', 'heladeria'],
            ['Dulce Frío', 'heladeria'],
            // Panaderías
            ['Panadería La Espiga Dorada', 'panaderia'],
            ['Pan de Cada Día', 'panaderia'],
            ['Delicias del Trigo', 'panaderia'],
            ['La Francesa Panadería', 'panaderia'],
            // Papelerías
            ['Papelería El Lápiz Feliz', 'papeleria'],
            ['Mundo Escolar', 'papeleria'],
            ['Papelería La Económica', 'papeleria'],
            ['Todo en Papel', 'papeleria'],
            // Ferreterías
            ['Ferretería El Tornillo', 'ferreteria'],
            ['Ferremax', 'ferreteria'],
            ['Construrey', 'ferreteria'],
            ['La Casa del Herraje', 'ferreteria'],
            // Tiendas de ropa
            ['Moda Urbana', 'ropa'],
            ['Vestir Bien', 'ropa'],
            ['Boutique Elegancia', 'ropa'],
            ['Almacén La Moda', 'ropa'],
            ['Punto Fashion', 'ropa'],
            // Fruterías
            ['Frutas y Verduras El Campo', 'fruteria'],
            ['La Huerta Fresca', 'fruteria'],
            ['Frutería Tropical', 'fruteria'],
            ['Verduras Doña Marta', 'fruteria'],
            // Carnicerías
            ['Carnes Finas El Novillo', 'carniceria'],
            ['Carnicería La Res Feliz', 'carniceria'],
            ['Distribuidora El Ganadero', 'carniceria'],
            // Droguerías
            ['Droguería La Salud', 'drogueria'],
            ['Farma Express', 'drogueria'],
            ['Drogas Económicas', 'drogueria'],
            ['Tu Farmacia', 'drogueria'],
            // Licorerías
            ['Licorería El Brindis', 'licoreria'],
            ['Licores La 80', 'licoreria'],
            ['Distrilicores', 'licoreria'],
            // Minimercados
            ['Supermercado El Ahorro', 'minimercado'],
            ['Mini Market La Esquina', 'minimercado'],
            ['Surtitodo', 'minimercado'],
            ['MercaFácil', 'minimercado'],
            ['Autoservicio La Economía', 'minimercado'],
        ];
    }

    /**
     * Catálogo por tipo de negocio: [categoria => [ [nombre, tipo_venta, unidad, min, max], ... ]].
     *
     * @return array<string, array<string, array<int, array{0:string,1:string,2:string,3:int,4:int}>>>
     */
    private function catalogo(string $tipo): array
    {
        $catalogos = [
            'restaurante' => [
                'Entradas' => [
                    ['Empanadas de carne', 'cantidad', 'unidad', 1500, 2500],
                    ['Patacón con hogao', 'cantidad', 'unidad', 4000, 7000],
                    ['Tequeños', 'cantidad', 'porción', 6000, 10000],
                    ['Papas a la francesa', 'cantidad', 'porción', 5000, 9000],
                ],
                'Sopas' => [
                    ['Sancocho de gallina', 'cantidad', 'porción', 12000, 18000],
                    ['Ajiaco santafereño', 'cantidad', 'porción', 14000, 20000],
                    ['Mondongo', 'cantidad', 'porción', 11000, 16000],
                ],
                'Platos fuertes' => [
                    ['Bandeja paisa', 'cantidad', 'porción', 18000, 28000],
                    ['Churrasco', 'cantidad', 'porción', 25000, 38000],
                    ['Mojarra frita', 'cantidad', 'porción', 20000, 30000],
                    ['Cazuela de mariscos', 'cantidad', 'porción', 28000, 42000],
                ],
                'Pollo' => [
                    ['Pechuga a la plancha', 'cantidad', 'porción', 16000, 24000],
                    ['Pollo apanado', 'cantidad', 'porción', 15000, 22000],
                    ['Arroz con pollo', 'cantidad', 'porción', 14000, 20000],
                ],
                'Pastas' => [
                    ['Espagueti boloñesa', 'cantidad', 'porción', 14000, 22000],
                    ['Lasaña de carne', 'cantidad', 'porción', 16000, 24000],
                    ['Fettuccini Alfredo', 'cantidad', 'porción', 15000, 23000],
                ],
                'Arroces' => [
                    ['Arroz paisa', 'cantidad', 'porción', 13000, 19000],
                    ['Arroz mixto', 'cantidad', 'porción', 16000, 24000],
                    ['Arroz chino', 'cantidad', 'porción', 14000, 21000],
                ],
                'Ensaladas' => [
                    ['Ensalada César', 'cantidad', 'porción', 10000, 16000],
                    ['Ensalada de la casa', 'cantidad', 'porción', 8000, 13000],
                ],
                'Postres' => [
                    ['Flan de caramelo', 'cantidad', 'porción', 5000, 9000],
                    ['Torta tres leches', 'cantidad', 'porción', 6000, 11000],
                    ['Brownie con helado', 'cantidad', 'porción', 7000, 12000],
                ],
                'Bebidas' => [
                    ['Limonada natural', 'cantidad', 'unidad', 4000, 7000],
                    ['Jugo de mora', 'cantidad', 'unidad', 4000, 7000],
                    ['Gaseosa personal', 'cantidad', 'unidad', 3000, 5000],
                    ['Agua', 'cantidad', 'unidad', 2000, 4000],
                ],
                'Combos' => [
                    ['Combo ejecutivo', 'cantidad', 'combo', 18000, 26000],
                    ['Combo familiar', 'cantidad', 'combo', 45000, 70000],
                ],
            ],

            'asadero' => [
                'Pollo asado' => [
                    ['Pollo entero asado', 'cantidad', 'unidad', 28000, 42000],
                    ['Medio pollo asado', 'cantidad', 'unidad', 15000, 23000],
                    ['Cuarto de pollo', 'cantidad', 'unidad', 9000, 14000],
                ],
                'Combos' => [
                    ['Combo personal', 'cantidad', 'combo', 14000, 20000],
                    ['Combo pareja', 'cantidad', 'combo', 26000, 38000],
                    ['Combo familiar', 'cantidad', 'combo', 48000, 72000],
                ],
                'Acompañamientos' => [
                    ['Papa a la francesa', 'cantidad', 'porción', 5000, 9000],
                    ['Arepa asada', 'cantidad', 'unidad', 2000, 3500],
                    ['Yuca frita', 'cantidad', 'porción', 5000, 8000],
                    ['Plátano maduro', 'cantidad', 'porción', 4000, 7000],
                ],
                'Adiciones' => [
                    ['Porción de arroz', 'cantidad', 'porción', 4000, 6000],
                    ['Ensalada', 'cantidad', 'porción', 4000, 7000],
                ],
                'Bebidas' => [
                    ['Gaseosa 1.5 L', 'cantidad', 'unidad', 5000, 8000],
                    ['Jugo en caja', 'cantidad', 'unidad', 2500, 4500],
                    ['Agua', 'cantidad', 'unidad', 2000, 3500],
                ],
            ],

            'cafeteria' => [
                'Café caliente' => [
                    ['Tinto', 'cantidad', 'unidad', 1500, 3000],
                    ['Café con leche', 'cantidad', 'unidad', 3000, 5500],
                    ['Capuchino', 'cantidad', 'unidad', 4500, 7500],
                    ['Latte', 'cantidad', 'unidad', 4500, 7500],
                    ['Americano', 'cantidad', 'unidad', 3500, 6000],
                ],
                'Bebidas frías' => [
                    ['Frappé de café', 'cantidad', 'unidad', 7000, 11000],
                    ['Malteada', 'cantidad', 'unidad', 7000, 11000],
                    ['Jugo natural', 'cantidad', 'unidad', 4000, 7000],
                ],
                'Panadería' => [
                    ['Croissant', 'cantidad', 'unidad', 2500, 4500],
                    ['Pan de queso', 'cantidad', 'unidad', 2000, 3500],
                    ['Roscón de arequipe', 'cantidad', 'unidad', 2500, 4500],
                ],
                'Postres' => [
                    ['Cheesecake', 'cantidad', 'porción', 7000, 12000],
                    ['Torta de chocolate', 'cantidad', 'porción', 6000, 10000],
                ],
                'Desayunos' => [
                    ['Huevos al gusto', 'cantidad', 'porción', 7000, 12000],
                    ['Calentado paisa', 'cantidad', 'porción', 9000, 14000],
                    ['Sándwich', 'cantidad', 'unidad', 7000, 12000],
                ],
                'Infusiones' => [
                    ['Aromática', 'cantidad', 'unidad', 2000, 4000],
                    ['Té chai', 'cantidad', 'unidad', 4000, 6500],
                ],
            ],

            'bar' => [
                'Cervezas' => [
                    ['Cerveza nacional', 'cantidad', 'unidad', 3500, 6000],
                    ['Cerveza importada', 'cantidad', 'unidad', 7000, 12000],
                    ['Michelada', 'cantidad', 'unidad', 6000, 10000],
                ],
                'Licores' => [
                    ['Botella de aguardiente', 'cantidad', 'botella', 45000, 70000],
                    ['Botella de ron', 'cantidad', 'botella', 55000, 90000],
                    ['Trago de whisky', 'cantidad', 'trago', 10000, 18000],
                ],
                'Cocteles' => [
                    ['Mojito', 'cantidad', 'unidad', 12000, 20000],
                    ['Margarita', 'cantidad', 'unidad', 13000, 22000],
                    ['Cuba libre', 'cantidad', 'unidad', 10000, 16000],
                    ['Piña colada', 'cantidad', 'unidad', 13000, 21000],
                ],
                'Sin alcohol' => [
                    ['Gaseosa', 'cantidad', 'unidad', 3000, 5000],
                    ['Agua', 'cantidad', 'unidad', 2500, 4000],
                    ['Bebida energizante', 'cantidad', 'unidad', 6000, 10000],
                ],
                'Picadas' => [
                    ['Picada personal', 'cantidad', 'combo', 18000, 28000],
                    ['Picada para compartir', 'cantidad', 'combo', 38000, 60000],
                    ['Alitas BBQ x8', 'cantidad', 'porción', 18000, 28000],
                ],
            ],

            'heladeria' => [
                'Helados en cono' => [
                    ['Una bola', 'cantidad', 'unidad', 3000, 5000],
                    ['Dos bolas', 'cantidad', 'unidad', 5000, 8000],
                    ['Tres bolas', 'cantidad', 'unidad', 7000, 11000],
                ],
                'Helado a granel' => [
                    ['Helado artesanal', 'peso', 'kg', 22000, 36000],
                ],
                'Malteadas' => [
                    ['Malteada de vainilla', 'cantidad', 'unidad', 7000, 11000],
                    ['Malteada de oreo', 'cantidad', 'unidad', 8000, 12000],
                ],
                'Sundaes' => [
                    ['Sundae de chocolate', 'cantidad', 'unidad', 8000, 13000],
                    ['Banana split', 'cantidad', 'unidad', 10000, 16000],
                ],
                'Paletas' => [
                    ['Paleta de frutas', 'cantidad', 'unidad', 2500, 4500],
                    ['Paleta de crema', 'cantidad', 'unidad', 3000, 5000],
                ],
                'Toppings' => [
                    ['Topping extra', 'cantidad', 'unidad', 1000, 2500],
                ],
            ],

            'panaderia' => [
                'Pan' => [
                    ['Pan blanco', 'cantidad', 'unidad', 500, 1200],
                    ['Pan integral', 'cantidad', 'unidad', 800, 1500],
                    ['Mogolla', 'cantidad', 'unidad', 800, 1500],
                    ['Pandebono', 'cantidad', 'unidad', 1000, 2000],
                ],
                'Pasteles' => [
                    ['Pastel de pollo', 'cantidad', 'unidad', 2500, 4500],
                    ['Pastel de carne', 'cantidad', 'unidad', 2500, 4500],
                    ['Pastel de arequipe', 'cantidad', 'unidad', 2000, 4000],
                ],
                'Tortas' => [
                    ['Torta de vainilla', 'peso', 'libra', 12000, 20000],
                    ['Porción de torta', 'cantidad', 'porción', 4000, 7000],
                ],
                'Galletas' => [
                    ['Galletas surtidas', 'peso', 'libra', 9000, 15000],
                    ['Galleta artesanal', 'cantidad', 'unidad', 1500, 3000],
                ],
                'Por docena' => [
                    ['Pandebono x docena', 'cantidad', 'docena', 9000, 15000],
                    ['Almojábanas x docena', 'cantidad', 'docena', 10000, 16000],
                ],
                'Bebidas' => [
                    ['Avena', 'cantidad', 'unidad', 2500, 4500],
                    ['Café', 'cantidad', 'unidad', 1500, 3000],
                ],
            ],

            'papeleria' => [
                'Cuadernos' => [
                    ['Cuaderno 50 hojas', 'cantidad', 'unidad', 2500, 4500],
                    ['Cuaderno argollado', 'cantidad', 'unidad', 6000, 12000],
                ],
                'Escritura' => [
                    ['Lapicero', 'cantidad', 'unidad', 800, 2000],
                    ['Lápiz', 'cantidad', 'unidad', 500, 1500],
                    ['Marcador', 'cantidad', 'unidad', 2000, 4000],
                    ['Resaltador', 'cantidad', 'unidad', 1800, 3500],
                ],
                'Papel' => [
                    ['Resma carta', 'cantidad', 'unidad', 14000, 22000],
                    ['Pliego de cartulina', 'cantidad', 'unidad', 800, 1800],
                ],
                'Arte' => [
                    ['Colores x12', 'cantidad', 'paquete', 6000, 12000],
                    ['Plastilina', 'cantidad', 'paquete', 3000, 6000],
                    ['Témperas', 'cantidad', 'paquete', 5000, 10000],
                ],
                'Oficina' => [
                    ['Grapadora', 'cantidad', 'unidad', 8000, 16000],
                    ['Perforadora', 'cantidad', 'unidad', 9000, 18000],
                    ['Tijeras', 'cantidad', 'unidad', 3000, 6000],
                ],
                'Servicios de impresión' => [
                    ['Fotocopia', 'cantidad', 'unidad', 100, 300],
                    ['Impresión b/n', 'cantidad', 'unidad', 200, 500],
                    ['Impresión color', 'cantidad', 'unidad', 500, 1200],
                ],
            ],

            'ferreteria' => [
                'Herramientas' => [
                    ['Martillo', 'cantidad', 'unidad', 12000, 28000],
                    ['Destornillador', 'cantidad', 'unidad', 6000, 14000],
                    ['Alicate', 'cantidad', 'unidad', 10000, 22000],
                    ['Taladro', 'cantidad', 'unidad', 90000, 180000],
                ],
                'Tornillería' => [
                    ['Tornillo', 'cantidad', 'unidad', 100, 400],
                    ['Puntillas', 'peso', 'libra', 3000, 6000],
                ],
                'Eléctricos' => [
                    ['Cable eléctrico', 'longitud', 'metro', 1500, 4000],
                    ['Bombillo LED', 'cantidad', 'unidad', 6000, 14000],
                    ['Interruptor', 'cantidad', 'unidad', 4000, 9000],
                ],
                'Plomería' => [
                    ['Tubo PVC', 'cantidad', 'unidad', 8000, 18000],
                    ['Manguera', 'longitud', 'metro', 2000, 5000],
                    ['Llave de paso', 'cantidad', 'unidad', 9000, 20000],
                ],
                'Pinturas' => [
                    ['Pintura vinilo', 'volumen', 'litro', 12000, 22000],
                    ['Galón de pintura', 'cantidad', 'galón', 45000, 85000],
                ],
                'Construcción' => [
                    ['Bulto de cemento', 'cantidad', 'bulto', 28000, 42000],
                    ['Arena', 'cantidad', 'bulto', 15000, 25000],
                ],
            ],

            'ropa' => [
                'Camisetas' => [
                    ['Camiseta básica', 'cantidad', 'unidad', 18000, 35000],
                    ['Camiseta tipo polo', 'cantidad', 'unidad', 35000, 60000],
                ],
                'Pantalones' => [
                    ['Jean clásico', 'cantidad', 'unidad', 55000, 110000],
                    ['Pantalón de tela', 'cantidad', 'unidad', 50000, 95000],
                ],
                'Vestidos' => [
                    ['Vestido casual', 'cantidad', 'unidad', 45000, 90000],
                    ['Vestido de fiesta', 'cantidad', 'unidad', 90000, 180000],
                ],
                'Ropa interior' => [
                    ['Bóxer x3', 'cantidad', 'paquete', 25000, 45000],
                    ['Medias x6', 'cantidad', 'paquete', 18000, 32000],
                ],
                'Calzado' => [
                    ['Tenis deportivos', 'cantidad', 'par', 80000, 180000],
                    ['Sandalias', 'cantidad', 'par', 30000, 65000],
                ],
                'Accesorios' => [
                    ['Gorra', 'cantidad', 'unidad', 20000, 45000],
                    ['Correa de cuero', 'cantidad', 'unidad', 30000, 60000],
                    ['Billetera', 'cantidad', 'unidad', 35000, 70000],
                ],
                'Abrigo' => [
                    ['Chaqueta', 'cantidad', 'unidad', 70000, 150000],
                    ['Buzo con capota', 'cantidad', 'unidad', 50000, 95000],
                ],
            ],

            'fruteria' => [
                'Frutas' => [
                    ['Banano', 'peso', 'kg', 2500, 4500],
                    ['Manzana', 'peso', 'kg', 6000, 10000],
                    ['Naranja', 'peso', 'kg', 3000, 5500],
                    ['Fresa', 'peso', 'libra', 5000, 9000],
                ],
                'Verduras' => [
                    ['Tomate', 'peso', 'kg', 3000, 6000],
                    ['Cebolla cabezona', 'peso', 'kg', 3000, 6000],
                    ['Papa', 'peso', 'kg', 2500, 4500],
                    ['Zanahoria', 'peso', 'kg', 2500, 4500],
                ],
                'Granos' => [
                    ['Arroz', 'peso', 'kg', 3500, 5500],
                    ['Fríjol', 'peso', 'libra', 4000, 7000],
                    ['Lenteja', 'peso', 'libra', 3500, 6000],
                ],
                'Hierbas' => [
                    ['Cilantro', 'cantidad', 'manojo', 1000, 2500],
                    ['Cebollín', 'cantidad', 'manojo', 1000, 2500],
                ],
                'Jugos naturales' => [
                    ['Jugo de naranja', 'cantidad', 'unidad', 4000, 7000],
                    ['Salpicón', 'cantidad', 'unidad', 5000, 9000],
                ],
                'Combos' => [
                    ['Combo de frutas', 'cantidad', 'combo', 12000, 22000],
                ],
            ],

            'carniceria' => [
                'Res' => [
                    ['Carne molida', 'peso', 'kg', 16000, 26000],
                    ['Lomo de res', 'peso', 'kg', 22000, 38000],
                    ['Costilla de res', 'peso', 'kg', 14000, 24000],
                    ['Bistec', 'peso', 'kg', 18000, 30000],
                ],
                'Cerdo' => [
                    ['Costilla de cerdo', 'peso', 'kg', 14000, 24000],
                    ['Chuleta de cerdo', 'peso', 'kg', 15000, 25000],
                    ['Tocino', 'peso', 'kg', 12000, 20000],
                ],
                'Pollo' => [
                    ['Pechuga de pollo', 'peso', 'kg', 12000, 20000],
                    ['Pierna pernil', 'peso', 'kg', 9000, 16000],
                    ['Pollo entero', 'cantidad', 'unidad', 18000, 30000],
                ],
                'Embutidos' => [
                    ['Chorizo', 'cantidad', 'unidad', 2000, 4500],
                    ['Salchicha', 'cantidad', 'paquete', 8000, 15000],
                    ['Morcilla', 'cantidad', 'unidad', 2000, 4000],
                ],
                'Pescado' => [
                    ['Mojarra', 'peso', 'kg', 14000, 24000],
                    ['Bagre', 'peso', 'kg', 16000, 28000],
                ],
            ],

            'drogueria' => [
                'Medicamentos' => [
                    ['Acetaminofén', 'cantidad', 'caja', 4000, 9000],
                    ['Ibuprofeno', 'cantidad', 'caja', 5000, 11000],
                    ['Aspirina', 'cantidad', 'caja', 4000, 8000],
                ],
                'Cuidado personal' => [
                    ['Jabón de baño', 'cantidad', 'unidad', 3000, 6000],
                    ['Shampoo', 'cantidad', 'unidad', 9000, 18000],
                    ['Crema dental', 'cantidad', 'unidad', 5000, 10000],
                    ['Desodorante', 'cantidad', 'unidad', 8000, 16000],
                ],
                'Bebés' => [
                    ['Pañales', 'cantidad', 'paquete', 18000, 38000],
                    ['Pañitos húmedos', 'cantidad', 'paquete', 6000, 12000],
                ],
                'Primeros auxilios' => [
                    ['Curitas', 'cantidad', 'caja', 3000, 6000],
                    ['Alcohol antiséptico', 'volumen', 'litro', 6000, 12000],
                    ['Gasa', 'cantidad', 'unidad', 2000, 5000],
                ],
                'Cuidado femenino' => [
                    ['Toallas higiénicas', 'cantidad', 'paquete', 5000, 10000],
                ],
            ],

            'licoreria' => [
                'Cervezas' => [
                    ['Six pack nacional', 'cantidad', 'six pack', 14000, 24000],
                    ['Cerveza en lata', 'cantidad', 'unidad', 2500, 4500],
                    ['Cerveza importada', 'cantidad', 'unidad', 6000, 11000],
                ],
                'Aguardiente' => [
                    ['Aguardiente 750 ml', 'cantidad', 'botella', 38000, 60000],
                    ['Aguardiente media', 'cantidad', 'botella', 20000, 34000],
                    ['Garrafa', 'cantidad', 'botella', 70000, 120000],
                ],
                'Ron' => [
                    ['Ron 750 ml', 'cantidad', 'botella', 45000, 80000],
                    ['Ron media', 'cantidad', 'botella', 24000, 40000],
                ],
                'Whisky' => [
                    ['Whisky 750 ml', 'cantidad', 'botella', 80000, 220000],
                ],
                'Vinos' => [
                    ['Vino tinto', 'cantidad', 'botella', 25000, 70000],
                    ['Vino espumoso', 'cantidad', 'botella', 30000, 90000],
                ],
                'Acompañantes' => [
                    ['Gaseosa 1.5 L', 'cantidad', 'unidad', 4000, 7000],
                    ['Bolsa de hielo', 'cantidad', 'unidad', 3000, 6000],
                ],
            ],

            'minimercado' => [
                'Abarrotes' => [
                    ['Arroz', 'peso', 'kg', 3000, 5000],
                    ['Azúcar', 'peso', 'kg', 3500, 5500],
                    ['Aceite', 'volumen', 'litro', 9000, 16000],
                    ['Sal', 'peso', 'kg', 1500, 3000],
                ],
                'Lácteos' => [
                    ['Leche en bolsa', 'cantidad', 'unidad', 3000, 5000],
                    ['Queso campesino', 'peso', 'libra', 8000, 14000],
                    ['Yogurt', 'cantidad', 'unidad', 2500, 5000],
                ],
                'Aseo' => [
                    ['Detergente', 'cantidad', 'unidad', 8000, 16000],
                    ['Jabón en barra', 'cantidad', 'unidad', 2000, 4000],
                    ['Límpido', 'volumen', 'litro', 3000, 6000],
                ],
                'Bebidas' => [
                    ['Gaseosa 2 L', 'cantidad', 'unidad', 5000, 8500],
                    ['Agua', 'cantidad', 'unidad', 1500, 3000],
                    ['Jugo en caja', 'cantidad', 'unidad', 2000, 4000],
                ],
                'Snacks' => [
                    ['Papas fritas', 'cantidad', 'unidad', 1500, 4000],
                    ['Galletas', 'cantidad', 'unidad', 1500, 3500],
                    ['Chocolatina', 'cantidad', 'unidad', 1000, 2500],
                ],
                'Granos' => [
                    ['Fríjol', 'peso', 'libra', 4000, 7000],
                    ['Lenteja', 'peso', 'libra', 3500, 6000],
                    ['Arveja seca', 'peso', 'libra', 3500, 6000],
                ],
                'Enlatados' => [
                    ['Atún', 'cantidad', 'unidad', 4000, 8000],
                    ['Sardina', 'cantidad', 'unidad', 3000, 6000],
                ],
                'Huevos' => [
                    ['Panal de huevos x30', 'cantidad', 'panal', 14000, 22000],
                    ['Huevo', 'cantidad', 'unidad', 400, 800],
                ],
            ],
        ];

        return $catalogos[$tipo] ?? [];
    }
}
