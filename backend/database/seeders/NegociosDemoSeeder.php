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
 * Los 30 negocios de demostración de Vitrina, en Maicao.
 *
 * Doce venden comida (restaurantes, asaderos, cafés, bar, heladería y
 * panadería): todos sus productos traen ingredientes que el cliente puede
 * quitar o pedir de más. Los otros dieciocho son ferreterías, ropa, calzado,
 * droguerías, papelería, frutería, carnicería, supermercado, licorería,
 * tecnología, belleza, mascotas, repuestos, óptica y barbería; sus productos
 * traen tallas y colores, para qué sirven o sus características, y algunos
 * ofrecen además servicios con cita.
 *
 * Cada negocio tiene su pin en el mapa, barrio, dirección, teléfono y horario
 * semanal (con almuerzo y festivos donde aplica), y al menos 10 productos.
 *
 * El dueño de cada negocio es `{slug}@demo.co` (contraseña 'password123'),
 * salvo "Panaderia La Espiga", que es de comerciante@demo.co; esa cuenta
 * también administra "El Rincón Paisa".
 *
 * Pensado para desarrollo. Se puede correr varias veces: el perfil de cada
 * negocio vuelve a quedar como aquí, pero de su catálogo solo añade lo que
 * falta, sin revivir lo que el comerciante haya borrado.
 */
class NegociosDemoSeeder extends Seeder
{
    private const TALLAS_ROPA = ['S', 'M', 'L', 'XL'];

    private const TALLAS_PANTALON = ['28', '30', '32', '34', '36'];

    private const TALLAS_DAMA = ['XS', 'S', 'M', 'L'];

    private const TALLAS_CALZADO = ['36', '37', '38', '39', '40', '41', '42', '43'];

    /** Fotos locales (public/images/demo-servicios) para negocios sin foto temática. */
    private const FOTOS_LOCALES = [
        'Celulares Punto Móvil' => 'electronics',
        'Moto Repuestos Caribe' => 'mechanic',
    ];

    public function run(): void
    {
        $tipos = TipoProducto::pluck('id', 'slug');

        DB::transaction(function () use ($tipos) {
            foreach ($this->negocios() as $datos) {
                $this->sembrar($datos, $tipos->all());
            }

            // La cuenta demo "de negocio" también administra un restaurante.
            $demo = User::where('email', 'comerciante@demo.co')->first();
            $rincon = Negocio::where('nombre', 'El Rincón Paisa')->first();
            if ($demo && $rincon) {
                $rincon->miembros()->syncWithoutDetaching([
                    $demo->id => ['rol' => Negocio::ROL_PROPIETARIO, 'activo' => true],
                ]);
            }
        });
    }

    /** @param  array<string, int>  $tipos */
    private function sembrar(array $datos, array $tipos): void
    {
        $dueno = $this->dueno($datos);

        $negocio = Negocio::where('nombre', $datos['nombre'])->first()
            ?? $dueno->negocio()->create(['nombre' => $datos['nombre']]);

        $negocio->fill([
            'descripcion' => $datos['descripcion'],
            'categoria' => $datos['tipos'][0],
            'direccion' => $datos['direccion'],
            'barrio' => $datos['barrio'],
            'telefono' => $datos['telefono'],
            'lat' => $datos['lat'],
            'lng' => $datos['lng'],
            'horario' => $this->horario($datos['horario']),
            'tiempo_preparacion' => $datos['preparacion'],
        ])->save();

        $negocio->miembros()->syncWithoutDetaching([
            $dueno->id => ['rol' => Negocio::ROL_PROPIETARIO, 'activo' => true],
        ]);

        $negocio->tiposNegocio()->sync(collect($datos['tipos'])->map(
            fn (string $nombre) => TipoNegocio::firstOrCreate(['slug' => Str::slug($nombre)], ['nombre' => $nombre])->id,
        ));

        foreach ($datos['catalogo'] as $categoria => [$tipo, $productos]) {
            $this->sembrarCategoria($negocio, $categoria, $tipos[$tipo], $tipo, $productos);
        }

        foreach ($datos['servicios'] ?? [] as [$nombre, $minutos, $precio, $descripcion]) {
            $negocio->servicios()->firstOrCreate(['nombre' => $nombre], [
                'descripcion' => $descripcion,
                'duracion_minutos' => $minutos,
                'precio' => $precio,
                'permite_citas' => true,
                'disponible' => true,
            ]);
        }

        if (! $negocio->imagen && isset(self::FOTOS_LOCALES[$negocio->nombre])) {
            $foto = self::FOTOS_LOCALES[$negocio->nombre];
            $origen = public_path("images/demo-servicios/{$foto}.jpg");
            if (is_file($origen)) {
                \Illuminate\Support\Facades\Storage::disk('public')
                    ->put("negocios/servicios-demo/{$foto}.jpg", file_get_contents($origen));
                $negocio->forceFill(['imagen' => "negocios/servicios-demo/{$foto}.jpg"])->save();
            }
        }
    }

    private function dueno(array $datos): User
    {
        $email = $datos['dueno'] ?? Str::slug($datos['nombre']).'@demo.co';
        $dueno = User::where('email', $email)->first();

        if (! $dueno) {
            $dueno = User::create(['email' => $email, 'name' => $datos['nombre'], 'password' => 'password123']);
            $dueno->syncRoles(User::rolesDelTipo('usuario'));
        }

        return $dueno;
    }

    private function sembrarCategoria(Negocio $negocio, string $nombre, int $tipoId, string $tipo, array $productos): void
    {
        $categoria = $negocio->categorias()->firstOrCreate(['nombre' => $nombre]);

        foreach ($productos as $producto) {
            [$nombreProducto, $precio, $descripcion, $atributos] = $producto;
            $extra = $producto[4] ?? [];

            // No duplica ni revive lo que el comerciante borró.
            if ($negocio->productos()->withTrashed()->where('nombre', $nombreProducto)->exists()) {
                continue;
            }

            $negocio->productos()->create([
                'nombre' => $nombreProducto,
                'descripcion' => $descripcion,
                'precio' => $precio,
                'tipo_venta' => $extra['venta'] ?? 'cantidad',
                'unidad_medida' => $extra['unidad'] ?? 'unidad',
                'disponible' => $extra['disponible'] ?? true,
                'categoria_id' => $categoria->id,
                'tipo_producto_id' => $tipoId,
                'atributos' => $atributos,
                'colores' => $tipo === TipoProducto::SLUG_ROPA ? ($extra['colores'] ?? []) : null,
            ]);
        }
    }

    /** Horarios típicos según el tipo de negocio (ver App\Support\HorarioNegocio). */
    private function horario(string $tipo): array
    {
        $dia = fn (string $abre, string $cierra, ?array $almuerzo = null) => array_filter([
            'abre' => $abre,
            'cierra' => $cierra,
            'almuerzo' => $almuerzo ? ['inicio' => $almuerzo[0], 'fin' => $almuerzo[1]] : null,
        ]);
        $semana = fn (?array $lunASab, ?array $dom, ?array $fes = null) => [
            'lun' => $lunASab, 'mar' => $lunASab, 'mie' => $lunASab, 'jue' => $lunASab,
            'vie' => $lunASab, 'sab' => $lunASab, 'dom' => $dom, 'fes' => $fes ?? $dom,
        ];

        return match ($tipo) {
            'restaurante' => $semana($dia('11:00', '22:00'), $dia('11:00', '17:00')),
            'asadero' => $semana($dia('10:30', '22:30'), $dia('10:30', '21:00')),
            'cafe' => $semana($dia('06:30', '20:00'), $dia('07:00', '13:00')),
            'panaderia' => $semana($dia('05:30', '20:30'), $dia('06:00', '13:00')),
            'heladeria' => $semana($dia('10:00', '22:00'), $dia('11:00', '22:30')),
            'bar' => [
                'lun' => null, 'mar' => null,
                'mie' => $dia('18:00', '01:00'), 'jue' => $dia('18:00', '01:00'),
                'vie' => $dia('18:00', '03:00'), 'sab' => $dia('18:00', '03:00'),
                'dom' => $dia('16:00', '00:00'), 'fes' => $dia('16:00', '01:00'),
            ],
            'comercio' => $semana($dia('08:00', '18:30', ['12:00', '14:00']), null),
            'almacen' => $semana($dia('08:30', '19:30'), $dia('09:00', '13:00')),
            'drogueria' => $semana($dia('07:00', '22:00'), $dia('08:00', '20:00')),
            'mercado' => $semana($dia('06:00', '17:00', ['12:30', '14:00']), $dia('06:00', '12:00')),
            'supermercado' => $semana($dia('07:00', '21:00'), $dia('07:00', '20:00')),
            'licoreria' => $semana($dia('10:00', '00:00'), $dia('10:00', '22:00'), $dia('10:00', '00:00')),
            'barberia' => [
                'lun' => null,
                'mar' => $dia('09:00', '20:00', ['13:00', '14:00']), 'mie' => $dia('09:00', '20:00', ['13:00', '14:00']),
                'jue' => $dia('09:00', '20:00', ['13:00', '14:00']), 'vie' => $dia('09:00', '21:00'),
                'sab' => $dia('08:00', '21:00'), 'dom' => $dia('09:00', '14:00'), 'fes' => $dia('09:00', '14:00'),
            ],
        };
    }

    /**
     * Cada negocio: perfil, ubicación y catálogo.
     * Catálogo: categoría => [slug del tipo de producto, [[nombre, precio, descripción, atributos, extra?], ...]].
     * Extra: venta (cantidad|peso|volumen|longitud), unidad, colores, disponible.
     *
     * @return array<int, array<string, mixed>>
     */
    private function negocios(): array
    {
        return [
            ...$this->restaurantes(),
            ...$this->comercios(),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function restaurantes(): array
    {
        return [
            [
                'nombre' => 'El Rincón Paisa',
                'tipos' => ['Restaurante', 'Comidas rápidas'],
                'descripcion' => 'Comida paisa de la de antes: bandeja, sancocho y fríjoles, y por la noche hamburguesas y salchipapas.',
                'barrio' => 'Centro', 'direccion' => 'Calle 13 # 10-24', 'telefono' => '3004518832',
                'lat' => 11.3802, 'lng' => -72.2415, 'horario' => 'restaurante', 'preparacion' => 25,
                'catalogo' => [
                    'Platos típicos' => ['comida', [
                        ['Bandeja paisa', 26000, 'La bandeja completa, para llegar con hambre.', ['Fríjoles', 'Arroz', 'Carne molida', 'Chicharrón', 'Huevo frito', 'Plátano maduro', 'Chorizo', 'Arepa', 'Aguacate'], ['unidad' => 'porción']],
                        ['Sancocho de gallina', 18000, 'Sancocho de gallina criolla con su presa y arroz aparte.', ['Gallina criolla', 'Yuca', 'Papa', 'Plátano verde', 'Mazorca', 'Cilantro', 'Arroz', 'Aguacate'], ['unidad' => 'porción']],
                        ['Fríjoles con garra', 19000, 'Fríjoles cargamanto con garra de cerdo, como los hace la abuela.', ['Fríjol cargamanto', 'Garra de cerdo', 'Hogao', 'Arroz', 'Plátano maduro', 'Arepa'], ['unidad' => 'porción']],
                        ['Chicharrón con arepa', 14000, 'Chicharrón carnudo y crocante con arepa de maíz.', ['Chicharrón', 'Arepa de maíz', 'Limón', 'Ají'], ['unidad' => 'porción']],
                    ]],
                    'Hamburguesas' => ['comida', [
                        ['Hamburguesa sencilla', 15000, 'Carne de res a la plancha en pan artesanal, con papas.', ['Pan artesanal', 'Carne de res 150 g', 'Queso cheddar', 'Lechuga', 'Tomate', 'Cebolla', 'Salsa de la casa', 'Papa a la francesa']],
                        ['Hamburguesa doble carne', 22000, 'Dos carnes, doble queso y tocineta crocante.', ['Pan artesanal', 'Carne de res 150 g x2', 'Queso cheddar x2', 'Tocineta', 'Lechuga', 'Tomate', 'Cebolla caramelizada', 'Papa a la francesa']],
                    ]],
                    'Salchipapas' => ['comida', [
                        ['Salchipapa sencilla', 12000, 'Papas y salchicha en rodajas para una persona.', ['Papa a la francesa', 'Salchicha', 'Salsa de tomate', 'Mayonesa', 'Mostaza'], ['unidad' => 'porción']],
                        ['Salchipapa especial', 18000, 'Con queso gratinado, tocineta y huevos de codorniz.', ['Papa a la francesa', 'Salchicha', 'Queso gratinado', 'Tocineta', 'Huevo de codorniz', 'Salsa rosada'], ['unidad' => 'porción']],
                    ]],
                    'Bebidas' => ['comida', [
                        ['Limonada de panela', 4500, 'Bien fría, endulzada con panela.', ['Limón', 'Panela', 'Hielo']],
                        ['Jugo de mora en leche', 6000, 'Mora fresca licuada en leche.', ['Mora', 'Leche', 'Azúcar', 'Hielo']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Sazón de la Abuela',
                'tipos' => ['Restaurante'],
                'descripcion' => 'Cocina guajira y costeña: chivo, friche, arroz de camarón y pescado frito con patacón.',
                'barrio' => 'Santander', 'direccion' => 'Carrera 14 # 9-51', 'telefono' => '3012247795',
                'lat' => 11.3768, 'lng' => -72.2452, 'horario' => 'restaurante', 'preparacion' => 30,
                'catalogo' => [
                    'Comida guajira' => ['comida', [
                        ['Chivo guisado', 28000, 'Chivo guajiro en guiso, con arroz con coco.', ['Chivo', 'Arroz con coco', 'Yuca cocida', 'Plátano maduro', 'Ensalada'], ['unidad' => 'porción']],
                        ['Friche', 30000, 'Chivo frito tradicional de La Guajira.', ['Chivo', 'Yuca cocida', 'Arepa de maíz', 'Suero costeño'], ['unidad' => 'porción']],
                        ['Cayeye con queso', 12000, 'Puré de guineo verde con queso y huevo.', ['Guineo verde', 'Queso costeño', 'Hogao', 'Huevo frito'], ['unidad' => 'porción']],
                    ]],
                    'Del mar' => ['comida', [
                        ['Mojarra frita', 27000, 'Mojarra entera, frita y crocante.', ['Mojarra', 'Patacón', 'Arroz con coco', 'Ensalada', 'Limón'], ['unidad' => 'porción']],
                        ['Arroz de camarón', 26000, 'Arroz costeño con camarones salteados.', ['Arroz', 'Camarón', 'Pimentón', 'Cebolla', 'Ajo', 'Patacón'], ['unidad' => 'porción']],
                        ['Cazuela de mariscos', 38000, 'Cremosa, con leche de coco y mariscos del día.', ['Camarón', 'Calamar', 'Mejillones', 'Pescado', 'Leche de coco', 'Crema de leche', 'Arroz con coco', 'Patacón'], ['unidad' => 'porción']],
                    ]],
                    'Arepas y fritos' => ['comida', [
                        ['Arepa de huevo', 5000, 'Frita al momento, con huevo y carne molida.', ['Arepa de maíz', 'Huevo', 'Carne molida', 'Ají']],
                        ['Empanada costeña', 2500, 'Empanada de maíz rellena de carne y papa.', ['Masa de maíz', 'Carne', 'Papa', 'Ají']],
                        ['Carimañola', 3000, 'De yuca, rellena de carne y queso.', ['Yuca', 'Carne molida', 'Queso costeño']],
                    ]],
                    'Bebidas' => ['comida', [
                        ['Jugo de corozo', 5000, 'El jugo de la costa, dulce y ácido.', ['Corozo', 'Azúcar', 'Hielo']],
                        ['Chicha de arroz', 5000, 'Bebida tradicional de arroz y canela.', ['Arroz', 'Leche', 'Canela', 'Azúcar']],
                    ]],
                ],
            ],
            [
                'nombre' => 'La Fonda Antioqueña',
                'tipos' => ['Restaurante'],
                'descripcion' => 'Almuerzos ejecutivos todos los días, carnes a la parrilla y picadas para compartir.',
                'barrio' => 'Centro', 'direccion' => 'Calle 15 # 9-12', 'telefono' => '3105562901',
                'lat' => 11.3815, 'lng' => -72.2398, 'horario' => 'restaurante', 'preparacion' => 25,
                'catalogo' => [
                    'Almuerzos' => ['comida', [
                        ['Almuerzo ejecutivo', 16000, 'Sopa del día, seco, ensalada y jugo.', ['Sopa del día', 'Arroz', 'Carne del día', 'Fríjoles', 'Ensalada', 'Jugo natural'], ['unidad' => 'porción']],
                        ['Pechuga a la plancha', 21000, 'Pechuga jugosa con arroz y papa.', ['Pechuga', 'Arroz', 'Papa salada', 'Ensalada'], ['unidad' => 'porción']],
                        ['Arroz con pollo', 18000, 'Arroz amarillo con pollo desmechado.', ['Arroz', 'Pollo', 'Arveja', 'Zanahoria', 'Papa a la francesa', 'Mayonesa'], ['unidad' => 'porción']],
                    ]],
                    'Parrilla' => ['comida', [
                        ['Churrasco', 34000, '300 g de carne de res a la parrilla.', ['Carne de res', 'Papa a la francesa', 'Ensalada', 'Chimichurri'], ['unidad' => 'porción']],
                        ['Costillas BBQ', 32000, 'Costillas de cerdo en salsa BBQ.', ['Costilla de cerdo', 'Salsa BBQ', 'Papa a la francesa', 'Ensalada de repollo'], ['unidad' => 'porción']],
                        ['Punta de anca', 36000, 'Con su grasita, término al gusto.', ['Punta de anca', 'Papa criolla', 'Arepa', 'Ensalada', 'Chimichurri'], ['unidad' => 'porción']],
                    ]],
                    'Picadas' => ['comida', [
                        ['Picada para dos', 45000, 'Carnes a la parrilla con acompañantes para dos.', ['Carne de res', 'Pechuga', 'Chicharrón', 'Chorizo', 'Morcilla', 'Papa criolla', 'Patacón', 'Arepa', 'Guacamole'], ['unidad' => 'porción']],
                        ['Picada familiar', 85000, 'Bandeja grande para cuatro o cinco personas.', ['Carne de res', 'Costilla de cerdo', 'Pechuga', 'Chicharrón', 'Chorizo', 'Morcilla', 'Papa criolla', 'Yuca frita', 'Patacón', 'Arepa', 'Guacamole'], ['unidad' => 'porción']],
                    ]],
                    'Postres' => ['comida', [
                        ['Torta tres leches', 7000, 'Húmeda y con canela por encima.', ['Bizcocho', 'Leche condensada', 'Leche evaporada', 'Crema de leche', 'Canela'], ['unidad' => 'porción']],
                        ['Flan de caramelo', 6000, 'Flan casero bañado en caramelo.', ['Huevo', 'Leche', 'Caramelo'], ['unidad' => 'porción']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Doña Rosa Restaurante',
                'tipos' => ['Restaurante', 'Comidas rápidas'],
                'descripcion' => 'Pizzas al horno, pastas y lasañas hechas en casa.',
                'barrio' => 'Miraflores', 'direccion' => 'Carrera 16 # 18-40', 'telefono' => '3157784410',
                'lat' => 11.3858, 'lng' => -72.2471, 'horario' => 'restaurante', 'preparacion' => 30,
                'catalogo' => [
                    'Pizzas' => ['comida', [
                        ['Pizza hawaiana personal', 16000, 'Masa delgada de 20 cm, horneada al momento.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Jamón', 'Piña']],
                        ['Pizza de pepperoni personal', 17000, 'Masa delgada de 20 cm con pepperoni.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Pepperoni', 'Orégano']],
                        ['Pizza mexicana mediana', 34000, 'Ocho porciones con carne y jalapeños.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Carne molida', 'Maíz tierno', 'Pimentón', 'Jalapeños']],
                        ['Pizza de la casa grande', 46000, 'Doce porciones con pollo, champiñones y tocineta.', ['Masa de pizza', 'Salsa napolitana', 'Queso mozzarella', 'Pollo', 'Champiñones', 'Tocineta', 'Cebolla']],
                    ]],
                    'Pastas' => ['comida', [
                        ['Espagueti boloñesa', 19000, 'Con salsa de carne cocinada a fuego lento.', ['Espagueti', 'Carne molida', 'Salsa de tomate', 'Queso parmesano'], ['unidad' => 'porción']],
                        ['Lasaña de carne', 22000, 'Capas de pasta, carne y bechamel gratinada.', ['Pasta', 'Carne molida', 'Salsa bechamel', 'Queso gratinado'], ['unidad' => 'porción']],
                        ['Fettuccini Alfredo', 21000, 'En salsa cremosa de queso.', ['Fettuccini', 'Crema de leche', 'Queso parmesano', 'Mantequilla', 'Pollo'], ['unidad' => 'porción']],
                    ]],
                    'Entradas' => ['comida', [
                        ['Pan de ajo', 7000, 'Seis tajadas gratinadas.', ['Pan baguette', 'Mantequilla', 'Ajo', 'Queso mozzarella', 'Perejil'], ['unidad' => 'porción']],
                        ['Ensalada César', 15000, 'Con pollo a la plancha y crutones.', ['Lechuga', 'Pollo', 'Crutones', 'Queso parmesano', 'Aderezo César'], ['unidad' => 'porción']],
                    ]],
                    'Bebidas' => ['comida', [
                        ['Limonada de coco', 8000, 'Cremosa y bien fría.', ['Limón', 'Crema de coco', 'Azúcar', 'Hielo']],
                        ['Té helado de durazno', 5000, 'Preparado en casa.', ['Té negro', 'Durazno', 'Azúcar', 'Hielo']],
                    ]],
                ],
            ],
            [
                'nombre' => 'El Buen Sabor',
                'tipos' => ['Restaurante', 'Comidas rápidas'],
                'descripcion' => 'Comida árabe de Maicao: shawarma, kibbe, falafel y quipe, con todo el sabor del Medio Oriente.',
                'barrio' => 'Centro', 'direccion' => 'Calle 12 # 11-08', 'telefono' => '3046691288',
                'lat' => 11.3790, 'lng' => -72.2378, 'horario' => 'restaurante', 'preparacion' => 20,
                'catalogo' => [
                    'Shawarmas' => ['comida', [
                        ['Shawarma de pollo', 16000, 'Pollo marinado en pan árabe.', ['Pan árabe', 'Pollo marinado', 'Lechuga', 'Tomate', 'Cebolla', 'Salsa de ajo']],
                        ['Shawarma de carne', 18000, 'Carne marinada con especias árabes.', ['Pan árabe', 'Carne de res', 'Tomate', 'Cebolla', 'Perejil', 'Salsa tahini']],
                        ['Shawarma mixto', 19000, 'Pollo y carne en el mismo pan.', ['Pan árabe', 'Pollo marinado', 'Carne de res', 'Tomate', 'Cebolla', 'Salsa de ajo', 'Salsa tahini']],
                    ]],
                    'Fritos árabes' => ['comida', [
                        ['Kibbe frito x3', 12000, 'Tres kibbes de carne y trigo, con limón.', ['Trigo', 'Carne molida', 'Cebolla', 'Hierbabuena', 'Limón'], ['unidad' => 'porción']],
                        ['Falafel x6', 13000, 'Croquetas de garbanzo con salsa tahini.', ['Garbanzo', 'Perejil', 'Ajo', 'Comino', 'Salsa tahini'], ['unidad' => 'porción']],
                        ['Sambusak x3', 10000, 'Empanaditas rellenas de queso.', ['Masa', 'Queso blanco', 'Perejil', 'Ajonjolí'], ['unidad' => 'porción']],
                    ]],
                    'Platos' => ['comida', [
                        ['Plato mixto árabe', 32000, 'Para probar de todo un poco.', ['Kibbe', 'Falafel', 'Hummus', 'Tabule', 'Arroz con almendras', 'Pan árabe'], ['unidad' => 'porción']],
                        ['Arroz con almendras y pollo', 22000, 'Arroz con fideos, almendras y pollo.', ['Arroz', 'Fideos', 'Almendras', 'Pollo', 'Canela'], ['unidad' => 'porción']],
                        ['Hummus con pan árabe', 11000, 'Crema de garbanzo con aceite de oliva.', ['Garbanzo', 'Tahini', 'Limón', 'Ajo', 'Aceite de oliva', 'Pan árabe'], ['unidad' => 'porción']],
                        ['Tabule', 9000, 'Ensalada fresca de perejil y trigo.', ['Perejil', 'Trigo', 'Tomate', 'Hierbabuena', 'Limón', 'Aceite de oliva'], ['unidad' => 'porción']],
                    ]],
                    'Bebidas' => ['comida', [
                        ['Limonada de hierbabuena', 6000, 'Refrescante, licuada con hielo.', ['Limón', 'Hierbabuena', 'Azúcar', 'Hielo']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Asadero El Carbón',
                'tipos' => ['Comidas rápidas', 'Restaurante'],
                'descripcion' => 'Pollo asado al carbón, costillas y combos para compartir en familia.',
                'barrio' => 'San José', 'direccion' => 'Carrera 10 # 5-33', 'telefono' => '3128840017',
                'lat' => 11.3742, 'lng' => -72.2410, 'horario' => 'asadero', 'preparacion' => 20,
                'catalogo' => [
                    'Pollo asado' => ['comida', [
                        ['Pollo entero asado', 36000, 'Asado al carbón, con papa salada y arepas.', ['Pollo', 'Papa salada', 'Arepa', 'Ají', 'Salsa de la casa']],
                        ['Medio pollo asado', 20000, 'Medio pollo con acompañantes.', ['Pollo', 'Papa salada', 'Arepa', 'Ají', 'Salsa de la casa']],
                        ['Cuarto de pollo', 12000, 'Pierna o pechuga, a elección.', ['Pollo', 'Papa salada', 'Arepa', 'Ají']],
                    ]],
                    'Combos' => ['comida', [
                        ['Combo personal', 17000, 'Cuarto de pollo con papas y gaseosa.', ['Cuarto de pollo', 'Papa a la francesa', 'Arepa', 'Ensalada', 'Gaseosa personal'], ['unidad' => 'combo']],
                        ['Combo familiar', 58000, 'Pollo entero, papas, arroz y gaseosa 1.5 L.', ['Pollo entero asado', 'Papa a la francesa', 'Arroz', 'Arepas', 'Ensalada', 'Gaseosa 1.5 L'], ['unidad' => 'combo']],
                    ]],
                    'Costillas y alitas' => ['comida', [
                        ['Costillas al carbón', 30000, 'Costillas de cerdo ahumadas al carbón.', ['Costilla de cerdo', 'Salsa BBQ', 'Yuca frita', 'Ensalada de repollo'], ['unidad' => 'porción']],
                        ['Alitas BBQ x8', 19000, 'Ocho alitas bañadas en BBQ.', ['Alitas', 'Salsa BBQ', 'Papa a la francesa', 'Salsa ranch'], ['unidad' => 'porción']],
                    ]],
                    'Acompañantes' => ['comida', [
                        ['Yuca frita', 6000, 'Con suero costeño.', ['Yuca', 'Sal', 'Suero costeño'], ['unidad' => 'porción']],
                        ['Plátano maduro con queso', 6000, 'Maduro asado con queso costeño.', ['Plátano maduro', 'Queso costeño'], ['unidad' => 'porción']],
                        ['Arroz con coco', 5000, 'Arroz con coco titoté.', ['Arroz', 'Coco', 'Panela', 'Uvas pasas'], ['unidad' => 'porción']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Pollos La Brasa Dorada',
                'tipos' => ['Comidas rápidas'],
                'descripcion' => 'Pollo broaster crocante, alitas y salchipapas hasta tarde.',
                'barrio' => 'Los Olivos', 'direccion' => 'Calle 20 # 12-15', 'telefono' => '3173305562',
                'lat' => 11.3881, 'lng' => -72.2390, 'horario' => 'asadero', 'preparacion' => 20,
                'catalogo' => [
                    'Broaster' => ['comida', [
                        ['Broaster 2 presas', 14000, 'Pollo apanado y crocante con papas.', ['Pollo apanado', 'Papa a la francesa', 'Ensalada', 'Salsa de la casa']],
                        ['Broaster 4 presas', 26000, 'Para dos, con papas y arepas.', ['Pollo apanado', 'Papa a la francesa', 'Arepa', 'Ensalada', 'Salsa de la casa']],
                        ['Broaster 8 presas', 48000, 'Para la familia.', ['Pollo apanado', 'Papa a la francesa', 'Arepa', 'Ensalada', 'Salsa de la casa', 'Salsa de ajo']],
                    ]],
                    'Alitas' => ['comida', [
                        ['Alitas picantes x8', 19000, 'Con salsa picante de la casa.', ['Alitas', 'Salsa picante', 'Papa a la francesa', 'Salsa ranch', 'Apio'], ['unidad' => 'porción']],
                        ['Alitas para compartir x20', 42000, 'Veinte alitas con dos salsas.', ['Alitas', 'Salsa BBQ', 'Salsa picante', 'Papa a la francesa', 'Salsa ranch'], ['unidad' => 'porción']],
                    ]],
                    'Salchipapas' => ['comida', [
                        ['Salchipollo', 19000, 'Salchipapa con pollo apanado.', ['Papa a la francesa', 'Salchicha', 'Pollo apanado', 'Queso gratinado', 'Salsa de ajo'], ['unidad' => 'porción']],
                        ['Salchipapa para compartir', 32000, 'Porción grande para dos o tres.', ['Papa a la francesa', 'Salchicha', 'Chorizo', 'Pollo desmechado', 'Queso gratinado', 'Tocineta', 'Maíz tierno', 'Salsa rosada'], ['unidad' => 'porción']],
                    ]],
                    'Sándwiches' => ['comida', [
                        ['Sándwich de pollo', 14000, 'Pollo desmechado en salsa cremosa.', ['Pan baguette', 'Pollo desmechado', 'Queso mozzarella', 'Lechuga', 'Tomate', 'Salsa de ajo']],
                        ['Sándwich cubano', 15000, 'Prensado y caliente.', ['Pan baguette', 'Cerdo', 'Jamón', 'Queso', 'Pepinillos', 'Mostaza']],
                    ]],
                    'Bebidas' => ['comida', [
                        ['Jugo de lulo', 5000, 'En agua o en leche.', ['Lulo', 'Azúcar', 'Hielo']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Café de la Esquina',
                'tipos' => ['Café'],
                'descripcion' => 'Café de origen colombiano, desayunos y algo dulce para la tarde.',
                'barrio' => 'Centro', 'direccion' => 'Calle 14 # 12-02', 'telefono' => '3009923471',
                'lat' => 11.3808, 'lng' => -72.2432, 'horario' => 'cafe', 'preparacion' => 10,
                'catalogo' => [
                    'Café caliente' => ['comida', [
                        ['Tinto', 2000, 'Café negro de la Sierra Nevada.', ['Café', 'Agua', 'Azúcar']],
                        ['Capuchino', 6000, 'Espresso con leche espumada.', ['Espresso', 'Leche', 'Espuma de leche', 'Canela']],
                        ['Latte de vainilla', 7000, 'Suave, con sirope de vainilla.', ['Espresso', 'Leche', 'Sirope de vainilla']],
                        ['Mocaccino', 7500, 'Café con chocolate y crema.', ['Espresso', 'Leche', 'Chocolate', 'Crema batida']],
                    ]],
                    'Bebidas frías' => ['comida', [
                        ['Frappé de café', 9000, 'Granizado con crema batida.', ['Café', 'Leche', 'Hielo', 'Crema batida', 'Arequipe']],
                        ['Malteada de arequipe', 10000, 'Espesa y cremosa.', ['Helado de vainilla', 'Leche', 'Arequipe', 'Crema batida']],
                    ]],
                    'Desayunos' => ['comida', [
                        ['Huevos al gusto', 9000, 'Revueltos, pericos o fritos, con arepa.', ['Huevos', 'Tomate', 'Cebolla', 'Arepa', 'Mantequilla'], ['unidad' => 'porción']],
                        ['Calentado paisa', 12000, 'Arroz y fríjoles del día con huevo.', ['Arroz', 'Fríjoles', 'Huevo frito', 'Chorizo', 'Arepa'], ['unidad' => 'porción']],
                        ['Sándwich de jamón y queso', 9000, 'En pan de masa madre.', ['Pan de masa madre', 'Jamón', 'Queso', 'Lechuga', 'Tomate', 'Mayonesa']],
                    ]],
                    'Para acompañar' => ['comida', [
                        ['Croissant de almendras', 5500, 'Hojaldrado y relleno de crema de almendras.', ['Masa hojaldre', 'Mantequilla', 'Crema de almendras', 'Almendras']],
                        ['Cheesecake de frutos rojos', 9000, 'Base de galleta y salsa de frutos rojos.', ['Queso crema', 'Galleta', 'Mantequilla', 'Frutos rojos', 'Azúcar'], ['unidad' => 'porción']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Aroma Café',
                'tipos' => ['Café'],
                'descripcion' => 'Cafetería de especialidad con métodos de filtrado, bowls y repostería artesanal.',
                'barrio' => 'El Carmen', 'direccion' => 'Carrera 7 # 16-21', 'telefono' => '3186674520',
                'lat' => 11.3835, 'lng' => -72.2355, 'horario' => 'cafe', 'preparacion' => 10,
                'catalogo' => [
                    'Métodos' => ['comida', [
                        ['Café en V60', 8000, 'Filtrado a mano, notas a panela y cítricos.', ['Café de especialidad', 'Agua']],
                        ['Café en prensa francesa', 9000, 'Cuerpo intenso, para compartir.', ['Café de especialidad', 'Agua']],
                        ['Cold brew', 8500, 'Extraído en frío durante 18 horas.', ['Café de especialidad', 'Agua', 'Hielo']],
                        ['Americano', 4500, 'Espresso alargado con agua caliente.', ['Espresso', 'Agua']],
                    ]],
                    'Bowls' => ['comida', [
                        ['Bowl de açaí', 16000, 'Con granola y fruta fresca.', ['Açaí', 'Banano', 'Fresa', 'Granola', 'Miel', 'Coco rallado'], ['unidad' => 'porción']],
                        ['Bowl de yogur griego', 13000, 'Yogur natural, frutas y semillas.', ['Yogur griego', 'Mango', 'Arándanos', 'Chía', 'Granola', 'Miel'], ['unidad' => 'porción']],
                    ]],
                    'Repostería' => ['comida', [
                        ['Brownie de chocolate', 6000, 'Con nueces, húmedo por dentro.', ['Chocolate', 'Mantequilla', 'Huevo', 'Harina', 'Nueces']],
                        ['Galleta de avena', 3500, 'Con uvas pasas y canela.', ['Avena', 'Mantequilla', 'Azúcar morena', 'Uvas pasas', 'Canela']],
                        ['Torta de zanahoria', 8000, 'Con frosting de queso crema.', ['Zanahoria', 'Harina', 'Nueces', 'Canela', 'Queso crema'], ['unidad' => 'porción']],
                    ]],
                    'Tés' => ['comida', [
                        ['Té chai latte', 7500, 'Especiado, con leche espumada.', ['Té negro', 'Canela', 'Cardamomo', 'Jengibre', 'Leche']],
                        ['Aromática de frutas', 4000, 'Infusión caliente de frutas frescas.', ['Manzana', 'Fresa', 'Naranja', 'Canela', 'Agua']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Luna Bar',
                'tipos' => ['Bar'],
                'descripcion' => 'Gastrobar con cocteles de autor, micheladas y picadas para la noche.',
                'barrio' => 'La Floresta', 'direccion' => 'Calle 18 # 5-60', 'telefono' => '3015518824',
                'lat' => 11.3870, 'lng' => -72.2338, 'horario' => 'bar', 'preparacion' => 15,
                'catalogo' => [
                    'Cocteles' => ['comida', [
                        ['Mojito', 16000, 'Ron blanco, hierbabuena y limón.', ['Ron blanco', 'Hierbabuena', 'Limón', 'Azúcar', 'Soda', 'Hielo']],
                        ['Margarita', 18000, 'Tequila y limón con borde de sal.', ['Tequila', 'Triple sec', 'Limón', 'Sal', 'Hielo']],
                        ['Piña colada', 17000, 'Cremosa, de ron y coco.', ['Ron blanco', 'Crema de coco', 'Jugo de piña', 'Hielo']],
                        ['Gin tonic de frutos rojos', 22000, 'Ginebra, tónica y frutos rojos.', ['Ginebra', 'Agua tónica', 'Frutos rojos', 'Romero', 'Hielo']],
                    ]],
                    'Cervezas preparadas' => ['comida', [
                        ['Michelada clásica', 9000, 'Cerveza con limón y sal.', ['Cerveza', 'Limón', 'Sal', 'Hielo']],
                        ['Michelada de mango biche', 12000, 'Con mango biche y ají.', ['Cerveza', 'Mango biche', 'Limón', 'Sal', 'Ají en polvo', 'Hielo']],
                    ]],
                    'Picadas' => ['comida', [
                        ['Picada personal', 25000, 'Un poco de todo para una persona.', ['Chicharrón', 'Chorizo', 'Carne de res', 'Papa criolla', 'Arepa', 'Guacamole', 'Limón'], ['unidad' => 'porción']],
                        ['Nachos con todo', 22000, 'Totopos con carne, queso y guacamole.', ['Totopos', 'Carne molida', 'Queso cheddar', 'Guacamole', 'Pico de gallo', 'Crema agria', 'Jalapeños'], ['unidad' => 'porción']],
                        ['Dedos de queso x8', 16000, 'Con salsa de mora.', ['Queso mozzarella', 'Masa', 'Salsa de mora'], ['unidad' => 'porción']],
                        ['Chicharrones de pollo', 18000, 'Crocantes, con salsa de miel mostaza.', ['Pollo', 'Apanado', 'Salsa miel mostaza', 'Limón'], ['unidad' => 'porción']],
                    ]],
                    'Sin alcohol' => ['comida', [
                        ['Soda de maracuyá', 8000, 'Soda con pulpa de maracuyá.', ['Maracuyá', 'Soda', 'Azúcar', 'Hielo']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Helados La Nieve',
                'tipos' => ['Heladería', 'Postres'],
                'descripcion' => 'Helados artesanales de frutas tropicales, malteadas y postres fríos para el calor de Maicao.',
                'barrio' => 'Centro', 'direccion' => 'Carrera 13 # 13-05', 'telefono' => '3142256690',
                'lat' => 11.3796, 'lng' => -72.2448, 'horario' => 'heladeria', 'preparacion' => 10,
                'catalogo' => [
                    'Conos y vasos' => ['comida', [
                        ['Cono de una bola', 4000, 'Elige tu sabor en el local o en notas.', ['Cono de galleta', 'Helado artesanal']],
                        ['Vaso de dos bolas', 7000, 'Dos sabores con salsa.', ['Helado artesanal x2', 'Salsa de chocolate', 'Galleta']],
                        ['Helado de mango biche', 6000, 'Con sal y limón, bien costeño.', ['Mango biche', 'Azúcar', 'Limón', 'Sal']],
                    ]],
                    'Copas' => ['comida', [
                        ['Banana split', 14000, 'Tres bolas sobre banano, con salsas y crema.', ['Banano', 'Helado de vainilla', 'Helado de fresa', 'Helado de chocolate', 'Crema batida', 'Salsa de chocolate', 'Cereza']],
                        ['Copa brownie', 13000, 'Brownie tibio con helado.', ['Brownie', 'Helado de vainilla', 'Salsa de chocolate', 'Maní']],
                        ['Ensalada de frutas', 12000, 'Con helado, crema y queso.', ['Papaya', 'Mango', 'Banano', 'Fresa', 'Helado de vainilla', 'Crema de leche', 'Queso rallado']],
                    ]],
                    'Malteadas' => ['comida', [
                        ['Malteada de oreo', 11000, 'Con galleta triturada.', ['Helado de vainilla', 'Leche', 'Galleta Oreo', 'Crema batida']],
                        ['Malteada de fresa', 10000, 'Con fresas naturales.', ['Helado de fresa', 'Leche', 'Fresa', 'Crema batida']],
                    ]],
                    'Paletas' => ['comida', [
                        ['Paleta de maracuyá', 4000, 'De agua, con pulpa natural.', ['Maracuyá', 'Agua', 'Azúcar']],
                        ['Paleta de coco', 4500, 'Cremosa, con coco rallado.', ['Coco', 'Leche', 'Azúcar']],
                    ]],
                    'Helado para llevar' => ['comida', [
                        ['Helado artesanal por litro', 22000, 'Hasta dos sabores por litro.', ['Leche', 'Crema de leche', 'Azúcar', 'Fruta o sabor a elegir'], ['venta' => 'volumen', 'unidad' => 'litro']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Panaderia La Espiga',
                'dueno' => 'comerciante@demo.co',
                'tipos' => ['Panadería'],
                'descripcion' => 'Pan fresco todos los días, pasteles horneados y tortas por encargo.',
                'barrio' => '20 de Julio', 'direccion' => 'Calle 12 #8-30, Maicao', 'telefono' => '3001234567',
                'lat' => 11.3834973, 'lng' => -72.2438286, 'horario' => 'panaderia', 'preparacion' => 15,
                'catalogo' => [
                    'Pan' => ['comida', [
                        ['Pan francés', 1000, 'Recién salido del horno.', ['Harina de trigo', 'Levadura', 'Sal', 'Agua']],
                        ['Pandebono', 1800, 'Calientito, con queso costeño.', ['Almidón de yuca', 'Queso costeño', 'Huevo']],
                        ['Almojábana', 2000, 'Suave, de cuajada.', ['Harina de maíz', 'Cuajada', 'Queso', 'Huevo', 'Mantequilla']],
                        ['Pan de coco', 2500, 'Dulce, con coco rallado.', ['Harina de trigo', 'Coco rallado', 'Azúcar', 'Mantequilla', 'Levadura']],
                        ['Mogolla integral', 1500, 'Con salvado de trigo.', ['Harina integral', 'Salvado', 'Miel', 'Levadura']],
                    ]],
                    'Pasteles' => ['comida', [
                        ['Pastel de pollo', 3500, 'Hojaldre relleno de pollo y verduras.', ['Masa hojaldre', 'Pollo', 'Arveja', 'Zanahoria', 'Salsa blanca']],
                        ['Pastel gloria', 3000, 'Hojaldre con bocadillo y arequipe.', ['Masa hojaldre', 'Bocadillo', 'Arequipe', 'Azúcar']],
                        ['Roscón de arequipe', 3500, 'Pan dulce relleno.', ['Harina de trigo', 'Arequipe', 'Azúcar', 'Mantequilla']],
                    ]],
                    'Tortas' => ['comida', [
                        ['Torta negra', 6000, 'Con frutas y vino, la de las fiestas.', ['Harina de trigo', 'Frutas confitadas', 'Uvas pasas', 'Vino tinto', 'Panela'], ['unidad' => 'porción']],
                        ['Torta de chocolate por libra', 18000, 'Por encargo, con cobertura de chocolate.', ['Bizcocho de chocolate', 'Cobertura de chocolate', 'Arequipe'], ['venta' => 'peso', 'unidad' => 'libra']],
                    ]],
                    'Bebidas' => ['comida', [
                        ['Avena fría', 3500, 'Avena en hojuelas con leche y canela.', ['Avena', 'Leche', 'Canela', 'Azúcar']],
                        ['Chocolate caliente', 3000, 'En leche, con su queso.', ['Chocolate', 'Leche', 'Queso']],
                    ]],
                ],
            ],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function comercios(): array
    {
        return [
            [
                'nombre' => 'Ferretería El Tornillo',
                'tipos' => ['Ferretería'],
                'descripcion' => 'Herramientas, eléctricos, plomería y pinturas para el hogar y el taller.',
                'barrio' => 'Alfonso López', 'direccion' => 'Carrera 9 # 7-44', 'telefono' => '3116602345',
                'lat' => 11.3755, 'lng' => -72.2365, 'horario' => 'comercio', 'preparacion' => 15,
                'catalogo' => [
                    'Herramientas manuales' => ['herramienta', [
                        ['Martillo de uña 16 oz', 22000, 'Mango de fibra antideslizante.', ['Carpintería', 'Construcción']],
                        ['Juego de destornilladores x6', 28000, 'Punta de pala y estrella, imantados.', ['Electricidad', 'Carpintería', 'Mecánica']],
                        ['Alicate universal 8"', 19000, 'Con corte lateral y mango aislado.', ['Electricidad', 'Plomería', 'Mecánica']],
                        ['Flexómetro 5 m', 12000, 'Cinta metálica con freno.', ['Construcción', 'Carpintería']],
                        ['Llave expansiva 10"', 24000, 'Abre hasta 30 mm.', ['Plomería', 'Mecánica']],
                    ]],
                    'Herramientas eléctricas' => ['herramienta', [
                        ['Taladro percutor 600 W', 189000, 'Con maletín y juego de brocas.', ['Construcción', 'Carpintería', 'Electricidad']],
                        ['Pulidora 4 1/2"', 165000, 'Para cortar y pulir metal o cerámica.', ['Construcción', 'Mecánica']],
                    ]],
                    'Eléctricos' => ['herramienta', [
                        ['Cable eléctrico calibre 12', 3200, 'Cable de cobre THHN, se vende por metro.', ['Electricidad'], ['venta' => 'longitud', 'unidad' => 'metro']],
                        ['Bombillo LED 12 W', 7500, 'Luz blanca, rosca E27.', ['Electricidad']],
                        ['Cinta aislante', 3000, 'Negra, 10 m.', ['Electricidad']],
                    ]],
                    'Plomería y pintura' => ['herramienta', [
                        ['Tubo PVC 1/2" x 6 m', 14000, 'Presión, para agua potable.', ['Plomería']],
                        ['Pegante PVC 1/4', 11000, 'Soldadura líquida para tubería.', ['Plomería']],
                        ['Pintura vinilo blanca galón', 62000, 'Tipo 1, lavable.', ['Pintura']],
                        ['Brocha 3"', 6500, 'Cerda natural.', ['Pintura']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Construrey',
                'tipos' => ['Ferretería', 'Construcción'],
                'descripcion' => 'Depósito de materiales: cemento, varilla, bloque, arena y todo para la obra.',
                'barrio' => 'Las Américas', 'direccion' => 'Troncal del Caribe # 3-150', 'telefono' => '3205543218',
                'lat' => 11.3720, 'lng' => -72.2470, 'horario' => 'comercio', 'preparacion' => 30,
                'catalogo' => [
                    'Obra negra' => ['herramienta', [
                        ['Bulto de cemento gris 50 kg', 34000, 'Uso general, para mampostería y concreto.', ['Construcción']],
                        ['Varilla corrugada 1/2"', 26000, 'Barra de 6 m.', ['Construcción']],
                        ['Bloque de cemento #4', 2600, 'Para muros divisorios.', ['Construcción']],
                        ['Arena lavada', 20000, 'Bulto de 40 kg.', ['Construcción'], ['unidad' => 'bulto']],
                        ['Gravilla', 22000, 'Bulto de 40 kg.', ['Construcción'], ['unidad' => 'bulto']],
                        ['Alambre negro', 9000, 'Para amarrar varilla, por kilo.', ['Construcción'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Puntilla 2"', 7000, 'Con cabeza, por libra.', ['Carpintería', 'Construcción'], ['venta' => 'peso', 'unidad' => 'libra']],
                    ]],
                    'Acabados' => ['herramienta', [
                        ['Pegacor gris 25 kg', 28000, 'Para pegar cerámica en piso y pared.', ['Construcción']],
                        ['Estuco plástico galón', 38000, 'Listo para aplicar.', ['Pintura', 'Construcción']],
                        ['Teja de zinc 3 m', 45000, 'Calibre 34.', ['Construcción']],
                    ]],
                    'Herramienta de obra' => ['herramienta', [
                        ['Pala cuadrada', 32000, 'Con mango de madera.', ['Construcción', 'Jardinería']],
                        ['Carretilla', 210000, 'Llanta neumática, platón de 90 L.', ['Construcción']],
                        ['Palustre 8"', 15000, 'Acero templado.', ['Construcción']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Moda Urbana',
                'tipos' => ['Ropa'],
                'descripcion' => 'Ropa juvenil para hombre: camisetas, jeans, sudaderas y gorras.',
                'barrio' => 'Centro', 'direccion' => 'Calle 14 # 11-37, local 3', 'telefono' => '3022218876',
                'lat' => 11.3812, 'lng' => -72.2420, 'horario' => 'almacen', 'preparacion' => 10,
                'catalogo' => [
                    'Camisetas' => ['ropa-y-calzado', [
                        ['Camiseta básica algodón', 25000, '100 % algodón, cuello redondo.', self::TALLAS_ROPA, ['colores' => ['Negro', 'Blanco', 'Gris', 'Azul']]],
                        ['Camiseta oversize estampada', 39000, 'Corte amplio con estampado.', self::TALLAS_ROPA, ['colores' => ['Negro', 'Blanco', 'Beige']]],
                        ['Camiseta tipo polo', 48000, 'Piqué con bordado en el pecho.', self::TALLAS_ROPA, ['colores' => ['Azul', 'Blanco', 'Verde', 'Rojo']]],
                    ]],
                    'Pantalones' => ['ropa-y-calzado', [
                        ['Jean slim fit', 89000, 'Denim con elastano.', self::TALLAS_PANTALON, ['colores' => ['Azul', 'Negro']]],
                        ['Jogger cargo', 75000, 'Con bolsillos laterales.', self::TALLAS_ROPA, ['colores' => ['Negro', 'Verde', 'Beige']]],
                        ['Bermuda de jean', 59000, 'Para el calor guajiro.', self::TALLAS_PANTALON, ['colores' => ['Azul']]],
                    ]],
                    'Abrigos' => ['ropa-y-calzado', [
                        ['Buzo con capota', 85000, 'Perchado por dentro.', [...self::TALLAS_ROPA, 'XXL'], ['colores' => ['Negro', 'Gris', 'Azul']]],
                        ['Chaqueta de jean', 120000, 'Clásica, con botones metálicos.', self::TALLAS_ROPA, ['colores' => ['Azul', 'Negro']]],
                    ]],
                    'Accesorios' => ['ropa-y-calzado', [
                        ['Gorra plana', 35000, 'Ajustable atrás.', ['Talla única'], ['colores' => ['Negro', 'Blanco', 'Rojo']]],
                        ['Medias deportivas x3', 18000, 'Tobilleras.', ['Talla única'], ['colores' => ['Blanco', 'Negro']]],
                        ['Correa de cuero', 45000, 'Hebilla metálica.', ['30', '32', '34', '36'], ['colores' => ['Negro', 'Café']]],
                    ]],
                ],
            ],
            [
                'nombre' => 'Boutique Elegancia',
                'tipos' => ['Ropa'],
                'descripcion' => 'Moda femenina: vestidos, blusas y conjuntos para el día y para la fiesta.',
                'barrio' => 'Centro', 'direccion' => 'Carrera 11 # 12-60', 'telefono' => '3168871234',
                'lat' => 11.3785, 'lng' => -72.2402, 'horario' => 'almacen', 'preparacion' => 10,
                'catalogo' => [
                    'Vestidos' => ['ropa-y-calzado', [
                        ['Vestido casual de lino', 79000, 'Fresco, largo a la rodilla.', self::TALLAS_DAMA, ['colores' => ['Blanco', 'Beige', 'Verde']]],
                        ['Vestido de fiesta largo', 165000, 'Con abertura lateral.', self::TALLAS_DAMA, ['colores' => ['Negro', 'Rojo', 'Azul']]],
                        ['Vestido camisero', 89000, 'Con cinturón.', self::TALLAS_DAMA, ['colores' => ['Azul', 'Rosado', 'Blanco']]],
                    ]],
                    'Blusas' => ['ropa-y-calzado', [
                        ['Blusa de seda', 65000, 'Manga larga, caída suave.', self::TALLAS_DAMA, ['colores' => ['Blanco', 'Negro', 'Rosado']]],
                        ['Crop top', 35000, 'Tejido acanalado.', self::TALLAS_DAMA, ['colores' => ['Negro', 'Blanco', 'Amarillo']]],
                        ['Blusa off shoulder', 49000, 'Hombros descubiertos.', self::TALLAS_DAMA, ['colores' => ['Blanco', 'Rojo', 'Verde']]],
                    ]],
                    'Pantalones y faldas' => ['ropa-y-calzado', [
                        ['Pantalón palazzo', 75000, 'Tiro alto, bota ancha.', self::TALLAS_DAMA, ['colores' => ['Negro', 'Beige', 'Blanco']]],
                        ['Falda midi plisada', 69000, 'Con pretina elástica.', self::TALLAS_DAMA, ['colores' => ['Negro', 'Verde', 'Rosado']]],
                        ['Jean mom', 95000, 'Tiro alto, corte recto.', ['6', '8', '10', '12', '14'], ['colores' => ['Azul']]],
                    ]],
                    'Accesorios' => ['ropa-y-calzado', [
                        ['Bolso de mano', 89000, 'Cuero sintético.', ['Talla única'], ['colores' => ['Negro', 'Café', 'Beige']]],
                        ['Sandalias de tacón', 110000, 'Tacón de 7 cm.', ['35', '36', '37', '38', '39'], ['colores' => ['Negro', 'Beige']]],
                    ]],
                ],
            ],
            [
                'nombre' => 'Punto Fashion',
                'tipos' => ['Calzado'],
                'descripcion' => 'Calzado para toda la familia: tenis, sandalias, zapatos de vestir y escolares.',
                'barrio' => 'Centro', 'direccion' => 'Calle 15 # 10-10', 'telefono' => '3045529981',
                'lat' => 11.3826, 'lng' => -72.2410, 'horario' => 'almacen', 'preparacion' => 10,
                'catalogo' => [
                    'Tenis' => ['ropa-y-calzado', [
                        ['Tenis deportivos running', 179000, 'Suela con amortiguación.', self::TALLAS_CALZADO, ['colores' => ['Negro', 'Blanco', 'Azul']]],
                        ['Tenis blancos urbanos', 139000, 'Clásicos de cuero sintético.', self::TALLAS_CALZADO, ['colores' => ['Blanco']]],
                        ['Tenis de lona', 79000, 'Caña baja.', self::TALLAS_CALZADO, ['colores' => ['Negro', 'Blanco', 'Rojo']]],
                    ]],
                    'Sandalias' => ['ropa-y-calzado', [
                        ['Chanclas playeras', 25000, 'Livianas y resistentes al agua.', self::TALLAS_CALZADO, ['colores' => ['Negro', 'Azul', 'Verde']]],
                        ['Sandalias de cuero', 69000, 'Hechas a mano.', self::TALLAS_CALZADO, ['colores' => ['Café', 'Negro']]],
                        ['Guaireñas', 45000, 'Tradicionales de La Guajira.', self::TALLAS_CALZADO, ['colores' => ['Café', 'Negro', 'Rojo']]],
                    ]],
                    'Formal' => ['ropa-y-calzado', [
                        ['Zapato de vestir hombre', 159000, 'Cuero, con cordón.', ['38', '39', '40', '41', '42', '43', '44'], ['colores' => ['Negro', 'Café']]],
                        ['Mocasín', 129000, 'Cómodo, sin cordones.', ['38', '39', '40', '41', '42', '43'], ['colores' => ['Café', 'Negro']]],
                        ['Baleta', 69000, 'Para dama, suela plana.', ['34', '35', '36', '37', '38', '39'], ['colores' => ['Negro', 'Beige', 'Rosado']]],
                    ]],
                    'Escolar' => ['ropa-y-calzado', [
                        ['Zapato escolar colegial', 89000, 'Cuero negro, suela antideslizante.', ['28', '30', '32', '34', '36', '38'], ['colores' => ['Negro']]],
                        ['Tenis escolares blancos', 75000, 'Para educación física.', ['28', '30', '32', '34', '36', '38'], ['colores' => ['Blanco']]],
                    ]],
                ],
            ],
            [
                'nombre' => 'Droguería La Salud',
                'tipos' => ['Droguería'],
                'descripcion' => 'Medicamentos, cuidado personal y productos para bebé. Domicilios todo el día.',
                'barrio' => 'San Martín', 'direccion' => 'Calle 10 # 4-18', 'telefono' => '3134456789',
                'lat' => 11.3762, 'lng' => -72.2330, 'horario' => 'drogueria', 'preparacion' => 10,
                'catalogo' => [
                    'Medicamentos' => ['medicamento', [
                        ['Acetaminofén 500 mg x10', 3500, 'Tabletas. Lee las indicaciones del empaque.', ['Dolor de cabeza', 'Fiebre', 'Dolor muscular'], ['unidad' => 'caja']],
                        ['Ibuprofeno 400 mg x10', 5000, 'Tabletas recubiertas.', ['Dolor muscular', 'Fiebre', 'Cólicos'], ['unidad' => 'caja']],
                        ['Loratadina 10 mg x10', 6000, 'Antihistamínico.', ['Alergias'], ['unidad' => 'caja']],
                        ['Sales de rehidratación oral', 3000, 'Sobre para un litro de agua.', ['Diarrea']],
                        ['Jarabe para la tos 120 ml', 14000, 'Expectorante.', ['Tos', 'Gripa']],
                        ['Omeprazol 20 mg x14', 8000, 'Cápsulas.', ['Gastritis'], ['unidad' => 'caja']],
                        ['Vitamina C 1 g x10', 12000, 'Tabletas efervescentes.', ['Vitaminas', 'Gripa'], ['unidad' => 'tubo']],
                    ]],
                    'Cuidado personal' => ['belleza-y-aseo', [
                        ['Protector solar FPS 50', 42000, '120 ml, resistente al agua.', ['Piel']],
                        ['Crema dental x3', 14000, 'Con flúor.', ['Aseo personal'], ['unidad' => 'paquete']],
                        ['Alcohol antiséptico', 9000, 'Por litro.', ['Aseo personal'], ['venta' => 'volumen', 'unidad' => 'litro']],
                    ]],
                    'Bebés' => ['belleza-y-aseo', [
                        ['Pañales etapa 3 x30', 38000, 'De 8 a 13 kg.', ['Aseo personal'], ['unidad' => 'paquete']],
                        ['Pañitos húmedos x100', 11000, 'Sin alcohol.', ['Aseo personal', 'Piel'], ['unidad' => 'paquete']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Farma Express',
                'tipos' => ['Droguería', 'Belleza'],
                'descripcion' => 'Farmacia de barrio con primeros auxilios, dermocosmética y toma de presión.',
                'barrio' => 'Villa Inés', 'direccion' => 'Carrera 12 # 24-09', 'telefono' => '3009987612',
                'lat' => 11.3902, 'lng' => -72.2445, 'horario' => 'drogueria', 'preparacion' => 10,
                'catalogo' => [
                    'Medicamentos' => ['medicamento', [
                        ['Naproxeno 250 mg x10', 7000, 'Tabletas.', ['Dolor muscular', 'Cólicos'], ['unidad' => 'caja']],
                        ['Antigripal x12', 9000, 'Cápsulas para síntomas de gripa.', ['Gripa', 'Fiebre', 'Dolor de cabeza'], ['unidad' => 'caja']],
                        ['Antiácido masticable x12', 6000, 'Sabor menta.', ['Gastritis'], ['unidad' => 'caja']],
                        ['Multivitamínico x30', 28000, 'Tabletas diarias.', ['Vitaminas'], ['unidad' => 'frasco']],
                    ]],
                    'Primeros auxilios' => ['medicamento', [
                        ['Curitas x20', 4500, 'Bandas adhesivas.', ['Heridas'], ['unidad' => 'caja']],
                        ['Gasa estéril x10', 5000, 'Compresas de 7,5 x 7,5 cm.', ['Heridas'], ['unidad' => 'paquete']],
                        ['Termómetro digital', 18000, 'Lectura en 60 segundos.', ['Fiebre']],
                    ]],
                    'Dermocosmética' => ['belleza-y-aseo', [
                        ['Gel limpiador facial', 38000, 'Para piel grasa.', ['Piel']],
                        ['Crema hidratante corporal', 26000, '400 ml, con avena.', ['Piel']],
                        ['Shampoo anticaspa', 24000, '400 ml.', ['Cabello']],
                        ['Repelente de insectos', 16000, 'Spray de 120 ml.', ['Piel']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Papelería El Lápiz Feliz',
                'tipos' => ['Papelería'],
                'descripcion' => 'Útiles escolares y de oficina, fotocopias, impresiones y plastificado.',
                'barrio' => 'Simón Bolívar', 'direccion' => 'Calle 8 # 10-27', 'telefono' => '3217789043',
                'lat' => 11.3730, 'lng' => -72.2385, 'horario' => 'comercio', 'preparacion' => 10,
                'catalogo' => [
                    'Escolar' => ['otro', [
                        ['Cuaderno cosido 100 hojas', 5500, 'Cuadriculado o rayado.', ['Escolar', 'Cuadriculado', 'Rayado']],
                        ['Cuaderno argollado 5 materias', 14000, 'Con separadores.', ['Escolar', 'Universitario']],
                        ['Caja de colores x12', 9000, 'Colores largos.', ['Escolar', 'Arte']],
                        ['Lápiz negro #2', 1000, 'Con borrador.', ['Escolar']],
                        ['Kit de geometría', 6000, 'Regla, escuadras y transportador.', ['Escolar']],
                    ]],
                    'Oficina' => ['otro', [
                        ['Resma papel carta', 24000, '500 hojas de 75 g.', ['Oficina', 'Impresión']],
                        ['Lapicero x3', 3500, 'Negro, azul y rojo.', ['Oficina', 'Escolar'], ['unidad' => 'paquete']],
                        ['Grapadora', 14000, 'Para 20 hojas.', ['Oficina']],
                        ['Carpeta plástica', 2500, 'Con gancho legajador.', ['Oficina', 'Escolar']],
                    ]],
                    'Arte y manualidades' => ['otro', [
                        ['Pliego de cartulina', 1200, 'Colores surtidos.', ['Arte', 'Escolar']],
                        ['Silicona líquida 250 ml', 6000, 'Para papel y tela.', ['Arte', 'Manualidades']],
                        ['Témperas x6', 8000, 'Colores básicos.', ['Arte', 'Escolar'], ['unidad' => 'paquete']],
                    ]],
                ],
                'servicios' => [
                    ['Impresión y fotocopias', 15, 300, 'Impresión en blanco y negro o a color, fotocopias y escaneo. El precio es por hoja en blanco y negro.'],
                    ['Plastificado de documentos', 15, 3000, 'Plastificado de carnés, diplomas y documentos hasta tamaño oficio.'],
                ],
            ],
            [
                'nombre' => 'Frutas y Verduras El Campo',
                'tipos' => ['Frutería', 'Verduras'],
                'descripcion' => 'Frutas y verduras frescas que llegan cada mañana del campo y de la Sierra.',
                'barrio' => 'La Unión', 'direccion' => 'Calle 11 # 15-03, frente al mercado', 'telefono' => '3148890123',
                'lat' => 11.3775, 'lng' => -72.2475, 'horario' => 'mercado', 'preparacion' => 15,
                'catalogo' => [
                    'Frutas' => ['otro', [
                        ['Mango de azúcar', 5000, 'Dulce y maduro, por kilo.', ['Fresco', 'De temporada'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Banano', 3500, 'Por kilo.', ['Fresco'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Papaya', 4000, 'Por kilo.', ['Fresco'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Limón tahití', 4500, 'Por kilo.', ['Fresco'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Aguacate', 3000, 'Por unidad, listo para comer.', ['Fresco', 'Maduro']],
                        ['Patilla', 2500, 'Por kilo.', ['Fresco', 'De temporada'], ['venta' => 'peso', 'unidad' => 'kg']],
                    ]],
                    'Verduras' => ['otro', [
                        ['Tomate chonto', 4500, 'Por kilo.', ['Fresco'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Cebolla cabezona', 4000, 'Por kilo.', ['Fresco'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Papa pastusa', 3500, 'Por kilo.', ['Fresco'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Yuca', 3000, 'Por kilo.', ['Fresco'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Plátano verde', 1200, 'Por unidad.', ['Fresco']],
                        ['Cilantro', 1500, 'Por manojo.', ['Fresco'], ['unidad' => 'manojo']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Carnes Finas El Novillo',
                'tipos' => ['Carnicería'],
                'descripcion' => 'Carnes de res, cerdo, pollo y chivo, cortadas al gusto y empacadas al vacío.',
                'barrio' => 'La Unión', 'direccion' => 'Calle 11 # 16-20', 'telefono' => '3107765432',
                'lat' => 11.3770, 'lng' => -72.2490, 'horario' => 'mercado', 'preparacion' => 15,
                'catalogo' => [
                    'Res' => ['otro', [
                        ['Carne molida de res', 22000, 'Molida al momento, por kilo.', ['Res', 'Molida'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Lomo fino', 38000, 'Por kilo.', ['Res', 'Corte fino'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Costilla de res', 19000, 'Para sudado o sancocho, por kilo.', ['Res'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Punta de anca', 34000, 'Por kilo.', ['Res', 'Parrilla'], ['venta' => 'peso', 'unidad' => 'kg']],
                    ]],
                    'Cerdo' => ['otro', [
                        ['Chuleta de cerdo', 21000, 'Por kilo.', ['Cerdo'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Costilla de cerdo', 20000, 'Por kilo.', ['Cerdo', 'Parrilla'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Tocino', 16000, 'Para chicharrón, por kilo.', ['Cerdo'], ['venta' => 'peso', 'unidad' => 'kg']],
                    ]],
                    'Pollo y chivo' => ['otro', [
                        ['Pechuga de pollo', 17000, 'Sin hueso, por kilo.', ['Pollo'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Pollo entero', 24000, 'Limpio, de 1,8 kg aprox.', ['Pollo']],
                        ['Carne de chivo', 28000, 'Chivo guajiro, por kilo.', ['Chivo', 'Guajiro'], ['venta' => 'peso', 'unidad' => 'kg']],
                    ]],
                    'Embutidos' => ['otro', [
                        ['Chorizo santarrosano x5', 12000, 'Para asar.', ['Cerdo', 'Parrilla'], ['unidad' => 'paquete']],
                        ['Butifarra soledeña x10', 10000, 'La de la costa.', ['Res', 'Cerdo'], ['unidad' => 'paquete']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Supermercado El Ahorro',
                'tipos' => ['Supermercado', 'Minimercado'],
                'descripcion' => 'Mercado completo: víveres, aseo, lácteos y bebidas a buen precio.',
                'barrio' => 'Paraíso', 'direccion' => 'Carrera 6 # 22-14', 'telefono' => '3156612098',
                'lat' => 11.3895, 'lng' => -72.2365, 'horario' => 'supermercado', 'preparacion' => 20,
                'catalogo' => [
                    'Despensa' => ['otro', [
                        ['Arroz Diana 1 kg', 4800, 'Arroz blanco de grano largo.', ['Despensa']],
                        ['Aceite vegetal 1 L', 11000, 'Aceite de soya.', ['Despensa']],
                        ['Azúcar 1 kg', 4500, 'Azúcar blanca.', ['Despensa']],
                        ['Café molido 250 g', 9500, 'Tostión media.', ['Despensa', 'Desayuno']],
                        ['Atún en lata', 6500, 'En aceite, 160 g.', ['Despensa', 'Enlatados']],
                        ['Panela x2', 4000, 'Panela redonda.', ['Despensa'], ['unidad' => 'paquete']],
                    ]],
                    'Lácteos y huevos' => ['otro', [
                        ['Leche entera 1 L', 4200, 'Larga vida.', ['Lácteos', 'Desayuno']],
                        ['Queso costeño', 11000, 'Por libra.', ['Lácteos'], ['venta' => 'peso', 'unidad' => 'libra']],
                        ['Huevos AA x30', 18000, 'Panal.', ['Desayuno'], ['unidad' => 'panal']],
                    ]],
                    'Aseo' => ['belleza-y-aseo', [
                        ['Detergente en polvo 1 kg', 12000, 'Para ropa blanca y de color.', ['Limpieza del hogar']],
                        ['Papel higiénico x12', 17000, 'Doble hoja.', ['Aseo personal'], ['unidad' => 'paquete']],
                        ['Lavaloza en crema 500 g', 6000, 'Aroma limón.', ['Limpieza del hogar']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Licorería El Brindis',
                'tipos' => ['Licorería'],
                'descripcion' => 'Licores nacionales e importados, cerveza fría y hielo. Domicilios hasta medianoche.',
                'barrio' => 'Los Laureles', 'direccion' => 'Calle 17 # 3-45', 'telefono' => '3018834567',
                'lat' => 11.3848, 'lng' => -72.2312, 'horario' => 'licoreria', 'preparacion' => 10,
                'catalogo' => [
                    'Cervezas' => ['otro', [
                        ['Six pack cerveza nacional', 18000, 'Seis latas de 330 ml bien frías.', ['Nacional', 'Fría'], ['unidad' => 'six pack']],
                        ['Cerveza importada 355 ml', 7500, 'Botella.', ['Importado', 'Fría']],
                        ['Canasta de cerveza x30', 85000, 'Botella retornable.', ['Nacional'], ['unidad' => 'canasta']],
                    ]],
                    'Licores' => ['otro', [
                        ['Aguardiente 750 ml', 52000, 'Tradicional o sin azúcar.', ['Nacional', '750 ml'], ['unidad' => 'botella']],
                        ['Ron añejo 750 ml', 62000, '8 años.', ['Nacional', '750 ml'], ['unidad' => 'botella']],
                        ['Whisky escocés 750 ml', 145000, '12 años.', ['Importado', '750 ml'], ['unidad' => 'botella']],
                        ['Tequila reposado 750 ml', 120000, '100 % agave.', ['Importado', '750 ml'], ['unidad' => 'botella']],
                        ['Vino tinto chileno', 42000, 'Cabernet sauvignon.', ['Importado', '750 ml'], ['unidad' => 'botella']],
                    ]],
                    'Acompañantes' => ['otro', [
                        ['Bolsa de hielo 3 kg', 5000, 'Hielo en cubos.', ['Frío']],
                        ['Gaseosa 1,5 L', 6000, 'Cola o naranja.', ['Mezclador']],
                        ['Soda 300 ml', 3000, 'Para cocteles.', ['Mezclador']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Celulares Punto Móvil',
                'tipos' => ['Tecnología', 'Servicios técnicos'],
                'descripcion' => 'Celulares, accesorios y servicio técnico: pantallas, baterías y puertos de carga.',
                'barrio' => 'Centro', 'direccion' => 'Calle 13 # 11-50, local 12', 'telefono' => '3192245671',
                'lat' => 11.3799, 'lng' => -72.2392, 'horario' => 'almacen', 'preparacion' => 10,
                'catalogo' => [
                    'Celulares' => ['tecnologia', [
                        ['Celular gama media 128 GB', 899000, 'Pantalla de 6,6", batería de 5000 mAh.', ['128 GB', '6 GB RAM', 'Doble SIM', 'Cámara de 50 MP']],
                        ['Celular básico 64 GB', 499000, 'Ideal para WhatsApp y redes.', ['64 GB', '4 GB RAM', 'Doble SIM']],
                    ]],
                    'Accesorios' => ['tecnologia', [
                        ['Cargador rápido 20 W', 39000, 'Con cable USB-C.', ['Carga rápida', 'USB-C']],
                        ['Cable USB-C 1 m', 18000, 'Trenzado.', ['USB-C', '1 metro']],
                        ['Audífonos inalámbricos', 89000, 'Estuche de carga, 20 h de batería.', ['Bluetooth 5.3', 'Estuche de carga', 'Micrófono']],
                        ['Power bank 10.000 mAh', 69000, 'Dos salidas USB.', ['10.000 mAh', 'Carga rápida']],
                        ['Vidrio templado', 15000, 'Para la mayoría de modelos.', ['9H', 'Instalación gratis']],
                        ['Funda antigolpes', 25000, 'Bordes reforzados.', ['Antigolpes', 'Transparente']],
                        ['Memoria micro SD 64 GB', 32000, 'Clase 10.', ['64 GB', 'Clase 10']],
                        ['Soporte de celular para moto', 35000, 'Ajustable y con agarre.', ['Ajustable', 'Para moto']],
                    ]],
                ],
                'servicios' => [
                    ['Cambio de pantalla', 90, 150000, 'Cambio de pantalla de celular con repuesto de buena calidad. El precio varía según el modelo; se confirma al revisar el equipo.'],
                    ['Cambio de batería', 45, 80000, 'Diagnóstico y cambio de batería para equipos que no duran la carga.'],
                    ['Reparación de puerto de carga', 60, 50000, 'Limpieza o cambio del puerto cuando el celular no carga.'],
                ],
            ],
            [
                'nombre' => 'Glamour Cosméticos',
                'tipos' => ['Belleza'],
                'descripcion' => 'Maquillaje, cuidado del cabello y de la piel, perfumes y uñas.',
                'barrio' => 'Centro', 'direccion' => 'Carrera 10 # 14-22', 'telefono' => '3125567843',
                'lat' => 11.3817, 'lng' => -72.2381, 'horario' => 'almacen', 'preparacion' => 10,
                'catalogo' => [
                    'Maquillaje' => ['belleza-y-aseo', [
                        ['Base líquida', 45000, 'Cobertura media, acabado mate.', ['Maquillaje', 'Piel']],
                        ['Labial mate', 22000, 'Larga duración.', ['Maquillaje']],
                        ['Pestañina a prueba de agua', 28000, 'Volumen y largo.', ['Maquillaje']],
                        ['Paleta de sombras', 39000, '12 tonos.', ['Maquillaje']],
                    ]],
                    'Cabello' => ['belleza-y-aseo', [
                        ['Shampoo de keratina', 32000, '400 ml, para cabello maltratado.', ['Cabello']],
                        ['Mascarilla capilar', 28000, 'Hidratación profunda.', ['Cabello']],
                        ['Tinte permanente', 18000, 'Varios tonos.', ['Cabello']],
                    ]],
                    'Piel' => ['belleza-y-aseo', [
                        ['Sérum de vitamina C', 55000, 'Ilumina y unifica el tono.', ['Piel']],
                        ['Crema de manos', 15000, 'Con manteca de karité.', ['Piel']],
                    ]],
                    'Uñas y perfumes' => ['belleza-y-aseo', [
                        ['Esmalte semipermanente', 16000, 'Requiere lámpara UV.', ['Uñas']],
                        ['Perfume floral 100 ml', 85000, 'Para dama.', ['Fragancia']],
                        ['Loción para hombre 100 ml', 89000, 'Notas amaderadas.', ['Fragancia']],
                    ]],
                ],
            ],
            [
                'nombre' => 'Mascotas Felices',
                'tipos' => ['Mascotas', 'Veterinaria'],
                'descripcion' => 'Concentrados, accesorios y veterinaria para perros y gatos. Baño y peluquería con cita.',
                'barrio' => 'Villa Fátima', 'direccion' => 'Calle 25 # 9-31', 'telefono' => '3176678901',
                'lat' => 11.3912, 'lng' => -72.2405, 'horario' => 'comercio', 'preparacion' => 15,
                'catalogo' => [
                    'Alimento' => ['otro', [
                        ['Concentrado para perro adulto 8 kg', 98000, 'Croquetas de pollo y arroz.', ['Perros', 'Adulto']],
                        ['Concentrado para cachorro 2 kg', 36000, 'Con DHA.', ['Perros', 'Cachorro']],
                        ['Concentrado para gato 1,5 kg', 32000, 'Sabor salmón.', ['Gatos']],
                        ['Concentrado a granel para perro', 9000, 'Por kilo.', ['Perros'], ['venta' => 'peso', 'unidad' => 'kg']],
                        ['Galletas para perro', 12000, 'Premios para el entrenamiento.', ['Perros', 'Snack']],
                    ]],
                    'Accesorios' => ['otro', [
                        ['Collar ajustable', 18000, 'Con hebilla de seguridad.', ['Perros', 'Gatos']],
                        ['Correa de 1,5 m', 22000, 'Reflectiva.', ['Perros']],
                        ['Cama acolchada', 75000, 'Tamaño mediano.', ['Perros', 'Gatos']],
                        ['Arena para gato 4 kg', 19000, 'Aglomerante.', ['Gatos']],
                    ]],
                    'Salud' => ['medicamento', [
                        ['Antipulgas en pipeta', 28000, 'Para perros de 10 a 20 kg.', ['Pulgas', 'Garrapatas']],
                        ['Desparasitante para perro', 15000, 'Tableta.', ['Parásitos']],
                        ['Shampoo para mascotas', 21000, 'Con avena.', ['Baño', 'Piel']],
                    ]],
                ],
                'servicios' => [
                    ['Baño y peluquería canina', 90, 45000, 'Baño, corte de pelo, corte de uñas y limpieza de oídos. El precio varía según el tamaño de la mascota.'],
                    ['Consulta veterinaria', 30, 40000, 'Revisión general de tu mascota con el veterinario.'],
                    ['Vacunación', 20, 35000, 'Aplicación de vacunas para perros y gatos según su carné.'],
                ],
            ],
            [
                'nombre' => 'Moto Repuestos Caribe',
                'tipos' => ['Repuestos', 'Taller de motos'],
                'descripcion' => 'Repuestos y lubricantes para moto, con taller de mantenimiento.',
                'barrio' => 'San Agustín', 'direccion' => 'Carrera 15 # 4-12', 'telefono' => '3203398765',
                'lat' => 11.3710, 'lng' => -72.2425, 'horario' => 'comercio', 'preparacion' => 15,
                'catalogo' => [
                    'Lubricantes' => ['herramienta', [
                        ['Aceite para moto 20W-50', 28000, 'Litro, motor de 4 tiempos.', ['Mecánica']],
                        ['Aceite 2 tiempos', 22000, 'Litro.', ['Mecánica']],
                        ['Lubricante de cadena', 18000, 'Spray de 400 ml.', ['Mecánica']],
                    ]],
                    'Repuestos' => ['herramienta', [
                        ['Kit de arrastre', 95000, 'Cadena, piñón y corona.', ['Mecánica']],
                        ['Pastillas de freno', 25000, 'Delanteras.', ['Mecánica']],
                        ['Bujía', 12000, 'Para motos de 100 a 200 cc.', ['Mecánica']],
                        ['Batería para moto 12 V', 120000, 'Libre de mantenimiento.', ['Mecánica', 'Electricidad']],
                        ['Llanta trasera 90/90-18', 135000, 'Para calle.', ['Mecánica']],
                        ['Filtro de aire', 18000, 'Según el modelo.', ['Mecánica']],
                    ]],
                    'Accesorios' => ['ropa-y-calzado', [
                        ['Casco certificado', 180000, 'Abatible, con visor.', ['S', 'M', 'L', 'XL'], ['colores' => ['Negro', 'Blanco', 'Rojo']]],
                        ['Guantes para moto', 45000, 'Con protecciones.', ['S', 'M', 'L', 'XL'], ['colores' => ['Negro']]],
                        ['Impermeable de dos piezas', 65000, 'Chaqueta y pantalón.', ['M', 'L', 'XL', 'XXL'], ['colores' => ['Negro', 'Azul']]],
                    ]],
                ],
                'servicios' => [
                    ['Mantenimiento preventivo', 120, 60000, 'Revisión de frenos, tensión de cadena, luces y estado general. Los repuestos se cotizan antes de cambiarlos.'],
                    ['Cambio de aceite', 20, 10000, 'Mano de obra del cambio de aceite; el aceite se paga aparte.'],
                ],
            ],
            [
                'nombre' => 'Óptica Visión Clara',
                'tipos' => ['Óptica'],
                'descripcion' => 'Monturas, lentes formulados y de sol, con examen visual por optómetra.',
                'barrio' => 'Centro', 'direccion' => 'Calle 15 # 12-08', 'telefono' => '3114432109',
                'lat' => 11.3829, 'lng' => -72.2425, 'horario' => 'comercio', 'preparacion' => 10,
                'catalogo' => [
                    'Monturas' => ['otro', [
                        ['Montura de acetato', 120000, 'Liviana y resistente.', ['Unisex', 'Acetato']],
                        ['Montura metálica', 110000, 'Con plaquetas ajustables.', ['Unisex', 'Metálica']],
                        ['Montura infantil flexible', 85000, 'No se rompe al doblarse.', ['Niños', 'Flexible']],
                    ]],
                    'Lentes' => ['otro', [
                        ['Lentes antirreflejo', 150000, 'Par de lentes formulados.', ['Formulado', 'Antirreflejo'], ['unidad' => 'par']],
                        ['Lentes fotocromáticos', 260000, 'Se oscurecen con el sol.', ['Formulado', 'Fotocromático'], ['unidad' => 'par']],
                        ['Lentes de contacto mensuales', 95000, 'Caja de seis.', ['Contacto'], ['unidad' => 'caja']],
                    ]],
                    'Gafas de sol' => ['otro', [
                        ['Gafas de sol polarizadas', 140000, 'Protección UV400.', ['Polarizado', 'UV400']],
                        ['Gafas de sol deportivas', 95000, 'Envolventes.', ['UV400', 'Deportivo']],
                    ]],
                    'Cuidado' => ['otro', [
                        ['Solución para lentes de contacto', 32000, '360 ml.', ['Contacto', 'Limpieza']],
                        ['Kit de limpieza para gafas', 15000, 'Spray y paño de microfibra.', ['Limpieza']],
                        ['Estuche rígido', 18000, 'Protege tus gafas.', ['Accesorio']],
                    ]],
                ],
                'servicios' => [
                    ['Examen visual', 30, 30000, 'Examen de agudeza visual con optómetra y fórmula para tus lentes.'],
                    ['Ajuste de monturas', 15, null, 'Ajuste y cambio de plaquetas o tornillos de tus gafas.'],
                ],
            ],
            [
                'nombre' => 'Barbería El Patrón',
                'tipos' => ['Barbería'],
                'descripcion' => 'Cortes clásicos y modernos, barba con toalla caliente y productos para el cabello.',
                'barrio' => 'Majupay', 'direccion' => 'Calle 9 # 18-36', 'telefono' => '3027781120',
                'lat' => 11.3745, 'lng' => -72.2510, 'horario' => 'barberia', 'preparacion' => 10,
                'catalogo' => [
                    'Cabello' => ['belleza-y-aseo', [
                        ['Cera para el cabello', 22000, 'Fijación fuerte, acabado mate.', ['Cabello']],
                        ['Gel fijador', 12000, 'Fijación extrema.', ['Cabello']],
                        ['Pomada a base de agua', 28000, 'Brillo medio, sale con agua.', ['Cabello']],
                        ['Shampoo para hombre', 25000, 'Mentolado.', ['Cabello']],
                        ['Tónico anticaída', 38000, 'Con biotina.', ['Cabello']],
                    ]],
                    'Barba' => ['belleza-y-aseo', [
                        ['Aceite para barba', 30000, 'Suaviza e hidrata.', ['Barba', 'Piel']],
                        ['Bálsamo para barba', 32000, 'Peina y da forma.', ['Barba']],
                        ['Shampoo para barba', 24000, 'Limpieza suave.', ['Barba']],
                    ]],
                    'Afeitado' => ['belleza-y-aseo', [
                        ['Espuma de afeitar', 15000, 'Para piel sensible.', ['Piel', 'Aseo personal']],
                        ['Loción after shave', 26000, 'Calma la piel después de afeitar.', ['Piel']],
                        ['Máquina patillera', 85000, 'Recargable, con tres peinillas.', ['Aseo personal']],
                    ]],
                ],
                'servicios' => [
                    ['Corte de cabello', 40, 15000, 'Corte clásico o moderno, con lavado.'],
                    ['Corte y barba', 60, 25000, 'Corte de cabello y perfilado de barba con toalla caliente.'],
                    ['Arreglo de barba', 30, 12000, 'Perfilado y rebajado de barba con navaja.'],
                    ['Diseño o figura', 20, 5000, 'Líneas o figuras con navaja, como adicional al corte.'],
                ],
            ],
        ];
    }
}
