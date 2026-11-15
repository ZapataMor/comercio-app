<?php

namespace Database\Seeders;

use App\Models\Negocio;
use App\Models\TipoNegocio;
use App\Models\TipoProducto;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Cinco cuentas de prueba (usuarios prueba1 a prueba5, contraseña
 * 'password123'), cada una dueña de un negocio con 10 productos.
 *
 * A diferencia de DatabaseSeeder, este SÍ está pensado para correr en el VPS
 * de pruebas (para que los negocios salgan en el APK):
 *
 *     php8.4 artisan db:seed --class=UsuariosPruebaSeeder --force
 *
 * No depende de los seeders demo (que no están en el servidor). Se puede
 * correr varias veces: el perfil de cada negocio vuelve a quedar como aquí y
 * del catálogo solo añade lo que falta, sin revivir lo que se haya borrado.
 */
class UsuariosPruebaSeeder extends Seeder
{
    private const CONTRASENA = 'password123';

    public function run(): void
    {
        $tipos = TipoProducto::pluck('id', 'slug')->all();

        DB::transaction(function () use ($tipos) {
            foreach ($this->negocios() as $numero => $datos) {
                $dueno = $this->usuario($numero);
                $this->sembrar($dueno, $datos, $tipos);
            }
        });
    }

    private function usuario(int $numero): User
    {
        $user = User::firstOrNew(['username' => "prueba{$numero}"]);
        $user->fill([
            'name' => 'Prueba',
            'apellidos' => (string) $numero,
            'password' => self::CONTRASENA, // se hashea solo (cast 'hashed')
        ]);
        $user->forceFill(['terminos_aceptados_at' => $user->terminos_aceptados_at ?? now()])->save();
        $user->syncRoles(User::rolesDelTipo('usuario'));

        return $user;
    }

    /** @param  array<string, int>  $tipos */
    private function sembrar(User $dueno, array $datos, array $tipos): void
    {
        $negocio = $dueno->negocio()->where('nombre', $datos['nombre'])->first()
            ?? $dueno->negocio()->create(['nombre' => $datos['nombre']]);

        $negocio->fill([
            'descripcion' => $datos['descripcion'],
            'categoria' => $datos['tipos'][0],
            'direccion' => $datos['direccion'],
            'barrio' => $datos['barrio'],
            'telefono' => $datos['telefono'],
            'lat' => $datos['lat'],
            'lng' => $datos['lng'],
            'horario' => $this->horario(...$datos['horario']),
            'tiempo_preparacion' => $datos['preparacion'],
            'activo' => true,
        ])->save();

        $negocio->miembros()->syncWithoutDetaching([
            $dueno->id => ['rol' => Negocio::ROL_PROPIETARIO, 'activo' => true],
        ]);

        $negocio->tiposNegocio()->sync(collect($datos['tipos'])->map(
            fn (string $nombre) => TipoNegocio::firstOrCreate(['slug' => Str::slug($nombre)], ['nombre' => $nombre])->id,
        ));

        foreach ($datos['catalogo'] as $nombreCategoria => [$tipo, $productos]) {
            $categoria = $negocio->categorias()->firstOrCreate(['nombre' => $nombreCategoria]);

            foreach ($productos as $producto) {
                [$nombre, $precio, $descripcion, $atributos] = $producto;
                $extra = $producto[4] ?? [];

                if ($negocio->productos()->withTrashed()->where('nombre', $nombre)->exists()) {
                    continue;
                }

                $negocio->productos()->create([
                    'nombre' => $nombre,
                    'descripcion' => $descripcion,
                    'precio' => $precio,
                    'tipo_venta' => $extra['venta'] ?? 'cantidad',
                    'unidad_medida' => $extra['unidad'] ?? 'unidad',
                    'disponible' => true,
                    'categoria_id' => $categoria->id,
                    'tipo_producto_id' => $tipos[$tipo] ?? $tipos['otro'],
                    'atributos' => $atributos,
                    'colores' => $tipo === TipoProducto::SLUG_ROPA ? ($extra['colores'] ?? []) : null,
                ]);
            }
        }
    }

    /** Lunes a sábado con el horario dado; domingo y festivos con el suyo (o cerrado). */
    private function horario(string $abre, string $cierra, ?string $abreDom = null, ?string $cierraDom = null): array
    {
        $dia = ['abre' => $abre, 'cierra' => $cierra];
        $dom = $abreDom ? ['abre' => $abreDom, 'cierra' => $cierraDom] : null;

        return [
            'lun' => $dia, 'mar' => $dia, 'mie' => $dia, 'jue' => $dia, 'vie' => $dia, 'sab' => $dia,
            'dom' => $dom, 'fes' => $dom,
        ];
    }

    /**
     * Número de usuario => negocio.
     * Catálogo: categoría => [slug del tipo de producto, [[nombre, precio, descripción, atributos, extra?], ...]].
     *
     * @return array<int, array<string, mixed>>
     */
    private function negocios(): array
    {
        return [
            1 => [
                'nombre' => 'Arepas El Fogón',
                'tipos' => ['Comidas rápidas'],
                'descripcion' => 'Arepas rellenas, patacones y perros calientes hechos al momento.',
                'barrio' => 'Centro', 'direccion' => 'Calle 12 # 11-30', 'telefono' => '3001112201',
                'lat' => 11.3791, 'lng' => -72.2428, 'horario' => ['07:00', '22:00', '16:00', '22:00'], 'preparacion' => 20,
                'catalogo' => [
                    'Arepas' => ['comida', [
                        ['Arepa de queso', 6000, 'Arepa asada con bastante queso costeño.', ['Arepa de maíz', 'Queso costeño', 'Mantequilla']],
                        ['Arepa mixta', 12000, 'Rellena de carne desmechada y pollo.', ['Arepa de maíz', 'Carne desmechada', 'Pollo desmechado', 'Queso', 'Salsa de la casa']],
                        ['Arepa reina pepiada', 11000, 'Pollo con aguacate y mayonesa.', ['Arepa de maíz', 'Pollo desmechado', 'Aguacate', 'Mayonesa', 'Cilantro']],
                        ['Arepa de huevo', 5000, 'Frita al momento, con huevo entero.', ['Arepa de maíz', 'Huevo', 'Carne molida']],
                    ]],
                    'Patacones' => ['comida', [
                        ['Patacón con todo', 16000, 'Patacón grande con carne, pollo y queso gratinado.', ['Patacón', 'Carne desmechada', 'Pollo', 'Queso gratinado', 'Ensalada', 'Salsas']],
                        ['Patacón con hogao', 8000, 'Dos patacones con hogao casero.', ['Patacón', 'Hogao', 'Queso costeño']],
                    ]],
                    'Perros' => ['comida', [
                        ['Perro sencillo', 8000, 'Salchicha americana con papita triturada.', ['Pan', 'Salchicha', 'Papita triturada', 'Cebolla', 'Salsas']],
                        ['Perro especial', 13000, 'Con tocineta, queso y huevo de codorniz.', ['Pan', 'Salchicha', 'Tocineta', 'Queso gratinado', 'Huevo de codorniz', 'Papita triturada', 'Salsas']],
                    ]],
                    'Bebidas' => ['comida', [
                        ['Avena fría', 4000, 'Avena casera con canela.', ['Avena', 'Leche', 'Canela', 'Azúcar']],
                        ['Gaseosa 400 ml', 3500, 'Bien fría.', ['Gaseosa']],
                    ]],
                ],
            ],
            2 => [
                'nombre' => 'Minimercado Don Pepe',
                'tipos' => ['Supermercado'],
                'descripcion' => 'Lo de la casa a la vuelta de la esquina: granos, lácteos, aseo y bebidas.',
                'barrio' => 'Majupay', 'direccion' => 'Carrera 18 # 14-07', 'telefono' => '3001112202',
                'lat' => 11.3839, 'lng' => -72.2489, 'horario' => ['07:00', '21:00', '07:00', '14:00'], 'preparacion' => 15,
                'catalogo' => [
                    'Granos' => ['otro', [
                        ['Arroz Diana 1 kg', 5200, 'Arroz blanco de grano largo.', ['Grano largo', '1 kg']],
                        ['Fríjol cargamanto', 9800, 'Se vende por libra.', ['Seco', 'Por libra'], ['venta' => 'peso', 'unidad' => 'libra']],
                        ['Lenteja 500 g', 3900, 'Lenteja seleccionada.', ['500 g']],
                    ]],
                    'Lácteos y huevos' => ['otro', [
                        ['Leche entera 1 L', 4800, 'Bolsa de un litro.', ['Entera', '1 litro']],
                        ['Huevos AA x30', 16500, 'Panal de 30 huevos rojos.', ['Rojos', 'Tamaño AA']],
                        ['Queso costeño', 18000, 'Fresco, por libra.', ['Fresco', 'Por libra'], ['venta' => 'peso', 'unidad' => 'libra']],
                    ]],
                    'Aseo' => ['belleza-y-aseo', [
                        ['Jabón en barra x3', 6900, 'Para ropa, aroma limón.', ['Lavar ropa']],
                        ['Detergente en polvo 1 kg', 12500, 'Rinde hasta 20 lavadas.', ['Lavar ropa']],
                        ['Papel higiénico x4', 7800, 'Doble hoja.', ['Hogar']],
                    ]],
                    'Bebidas' => ['otro', [
                        ['Agua en bolsa x6', 3000, 'Bolsas de 600 ml.', ['600 ml', 'Paquete x6']],
                    ]],
                ],
            ],
            3 => [
                'nombre' => 'Deportes Gol de Oro',
                'tipos' => ['Ropa', 'Calzado'],
                'descripcion' => 'Camisetas de fútbol, tenis, balones y todo para entrenar.',
                'barrio' => 'Boscán', 'direccion' => 'Calle 16 # 8-21', 'telefono' => '3001112203',
                'lat' => 11.3822, 'lng' => -72.2371, 'horario' => ['09:00', '19:30', '09:00', '13:00'], 'preparacion' => 15,
                'catalogo' => [
                    'Camisetas' => ['ropa-y-calzado', [
                        ['Camiseta Selección Colombia', 89000, 'Réplica, tela dry-fit.', ['S', 'M', 'L', 'XL'], ['colores' => ['Amarillo', 'Azul']]],
                        ['Camiseta deportiva básica', 35000, 'Secado rápido, ideal para entrenar.', ['S', 'M', 'L', 'XL'], ['colores' => ['Negro', 'Blanco', 'Rojo', 'Azul']]],
                        ['Esqueleto de gimnasio', 30000, 'Sisa amplia, tela liviana.', ['S', 'M', 'L', 'XL'], ['colores' => ['Negro', 'Gris']]],
                    ]],
                    'Pantalonetas y sudaderas' => ['ropa-y-calzado', [
                        ['Pantaloneta de fútbol', 28000, 'Con cordón ajustable.', ['S', 'M', 'L', 'XL'], ['colores' => ['Negro', 'Blanco', 'Azul']]],
                        ['Sudadera jogger', 69000, 'Perchada por dentro, con bolsillos.', ['S', 'M', 'L', 'XL'], ['colores' => ['Negro', 'Gris']]],
                    ]],
                    'Calzado' => ['ropa-y-calzado', [
                        ['Guayos para grama sintética', 149000, 'Taches cortos, buen agarre.', ['37', '38', '39', '40', '41', '42', '43'], ['colores' => ['Negro', 'Blanco']]],
                        ['Tenis para correr', 179000, 'Suela con amortiguación.', ['36', '37', '38', '39', '40', '41', '42', '43'], ['colores' => ['Negro', 'Blanco', 'Azul']]],
                        ['Chanclas deportivas', 39000, 'Plantilla acolchada.', ['37', '38', '39', '40', '41', '42', '43'], ['colores' => ['Negro', 'Azul']]],
                    ]],
                    'Accesorios' => ['ropa-y-calzado', [
                        ['Medias de fútbol', 15000, 'Largas, hasta la rodilla.', ['Talla única'], ['colores' => ['Blanco', 'Negro', 'Rojo']]],
                        ['Balón de fútbol N.º 5', 65000, 'Cosido a máquina, para cancha y grama.', ['Talla única'], ['colores' => ['Blanco']]],
                    ]],
                ],
            ],
            4 => [
                'nombre' => 'Jugos y Batidos Tropical',
                'tipos' => ['Cafetería'],
                'descripcion' => 'Jugos naturales, batidos, salpicón y algo de comer para acompañar.',
                'barrio' => 'La Esmeralda', 'direccion' => 'Carrera 12 # 20-15', 'telefono' => '3001112204',
                'lat' => 11.3868, 'lng' => -72.2413, 'horario' => ['07:00', '20:00', '08:00', '18:00'], 'preparacion' => 10,
                'catalogo' => [
                    'Jugos' => ['comida', [
                        ['Jugo de mango', 5000, 'En agua o en leche.', ['Mango', 'Azúcar', 'Hielo']],
                        ['Jugo de maracuyá', 5000, 'Bien frío y ácido.', ['Maracuyá', 'Azúcar', 'Hielo']],
                        ['Limonada de coco', 8000, 'Cremosa.', ['Limón', 'Crema de coco', 'Azúcar', 'Hielo']],
                    ]],
                    'Batidos' => ['comida', [
                        ['Batido de fresa', 9000, 'Con leche y helado de vainilla.', ['Fresa', 'Leche', 'Helado de vainilla', 'Azúcar']],
                        ['Batido verde', 10000, 'Espinaca, piña y manzana.', ['Espinaca', 'Piña', 'Manzana verde', 'Jengibre']],
                        ['Batido proteico', 14000, 'Banano, avena y proteína.', ['Banano', 'Avena', 'Leche', 'Proteína en polvo', 'Mantequilla de maní']],
                    ]],
                    'Frutas' => ['comida', [
                        ['Salpicón', 8000, 'Frutas picadas en jugo de sandía.', ['Sandía', 'Papaya', 'Banano', 'Mango', 'Fresa', 'Leche condensada']],
                        ['Ensalada de frutas', 12000, 'Con helado, queso y crema.', ['Frutas de temporada', 'Helado', 'Queso rallado', 'Crema de leche']],
                    ]],
                    'Para acompañar' => ['comida', [
                        ['Sándwich de pollo', 10000, 'En pan integral.', ['Pan integral', 'Pollo desmechado', 'Lechuga', 'Tomate', 'Queso', 'Mayonesa']],
                        ['Pandebono', 2500, 'Recién horneado.', ['Almidón de yuca', 'Queso']],
                    ]],
                ],
            ],
            5 => [
                'nombre' => 'Tecno Accesorios Maicao',
                'tipos' => ['Tecnología'],
                'descripcion' => 'Cargadores, audífonos, forros y accesorios para celular y computador.',
                'barrio' => 'Paraíso', 'direccion' => 'Calle 10 # 15-42', 'telefono' => '3001112205',
                'lat' => 11.3761, 'lng' => -72.2462, 'horario' => ['09:00', '19:00'], 'preparacion' => 15,
                'catalogo' => [
                    'Celulares' => ['tecnologia', [
                        ['Cargador rápido USB-C 20 W', 35000, 'Con cable de 1 m.', ['Carga rápida', 'USB-C']],
                        ['Cable Lightning 1 m', 18000, 'Reforzado, para iPhone.', ['Lightning', '1 metro']],
                        ['Forro antigolpes', 20000, 'Bordes reforzados, transparente.', ['Protección', 'Transparente']],
                        ['Vidrio templado', 12000, 'Protector de pantalla 9H.', ['Protección', 'Instalación gratis']],
                    ]],
                    'Audio' => ['tecnologia', [
                        ['Audífonos inalámbricos', 75000, 'Bluetooth 5.3, estuche de carga.', ['Bluetooth', '20 h de batería']],
                        ['Parlante portátil', 89000, 'Resistente al agua, 10 W.', ['Bluetooth', 'Resistente al agua']],
                    ]],
                    'Computador' => ['tecnologia', [
                        ['Mouse inalámbrico', 32000, 'Receptor USB, silencioso.', ['Inalámbrico', 'USB']],
                        ['Teclado USB', 38000, 'En español, con ñ.', ['USB', 'Español']],
                        ['Memoria USB 64 GB', 29000, 'USB 3.0.', ['64 GB', 'USB 3.0']],
                    ]],
                    'Energía' => ['tecnologia', [
                        ['Power bank 10.000 mAh', 69000, 'Dos salidas USB y una USB-C.', ['10.000 mAh', 'Carga rápida']],
                    ]],
                ],
            ],
        ];
    }
}
