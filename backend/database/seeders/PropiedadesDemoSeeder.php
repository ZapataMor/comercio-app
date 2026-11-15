<?php

namespace Database\Seeders;

use App\Models\Propiedad;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Casas en venta, casas en alquiler y patios para eventos de prueba en
 * Maicao, publicados por los usuarios demo. Las fotos se descargan una vez
 * de LoremFlickr (como ImagenesDemoSeeder); sin internet quedan sin foto y
 * la app muestra el ícono. Se puede correr varias veces sin duplicar.
 */
class PropiedadesDemoSeeder extends Seeder
{
    private const PROPIEDADES = [
        [
            'tipo' => 'venta', 'titulo' => 'Casa esquinera de dos plantas',
            'descripcion' => "Casa esquinera recién pintada, con sala-comedor amplio, cocina integral y patio con árbol de mango.\nEscrituras al día y servicios públicos independientes.",
            'precio' => 280000000, 'negociable' => true, 'direccion' => 'Calle 14 # 12-30', 'barrio' => 'Centro',
            'lat' => 11.3841, 'lng' => -72.2419, 'habitaciones' => 4, 'banos' => 3, 'area_m2' => 160, 'estrato' => 3,
            'caracteristicas' => ['Garaje', 'Patio', 'Cocina integral', 'Tanque de agua', 'Rejas de seguridad'],
            'condiciones' => 'Se recibe crédito hipotecario. Visitas con cita previa.',
            'fotos' => 'house,facade',
        ],
        [
            'tipo' => 'venta', 'titulo' => 'Casa nueva en Los Laureles',
            'descripcion' => 'Casa de un piso para estrenar, con terraza y espacio para un carro. Cerca del colegio y del parque.',
            'precio' => 185000000, 'negociable' => false, 'direccion' => 'Carrera 20 # 8-15', 'barrio' => 'Los Laureles',
            'lat' => 11.3772, 'lng' => -72.2508, 'habitaciones' => 3, 'banos' => 2, 'area_m2' => 105, 'estrato' => 2,
            'caracteristicas' => ['Parqueadero', 'Terraza', 'Gas natural'],
            'condiciones' => null,
            'fotos' => 'house,modern',
        ],
        [
            'tipo' => 'venta', 'titulo' => 'Lote con casa para remodelar',
            'descripcion' => 'Casa antigua sobre lote amplio, ideal para construir apartamentos o local comercial.',
            'precio' => 120000000, 'negociable' => true, 'direccion' => 'Calle 9 # 25-40', 'barrio' => 'San José',
            'lat' => 11.3735, 'lng' => -72.2389, 'habitaciones' => 2, 'banos' => 1, 'area_m2' => 300, 'estrato' => 2,
            'caracteristicas' => ['Patio'],
            'condiciones' => 'Solo pago de contado.',
            'fotos' => 'house,old',
        ],
        [
            'tipo' => 'alquiler', 'titulo' => 'Casa amoblada cerca al centro',
            'descripcion' => 'Casa fresca y amoblada, con aire acondicionado en las habitaciones. Lista para entrar a vivir.',
            'precio' => 1300000, 'negociable' => false, 'direccion' => 'Carrera 11 # 13-08', 'barrio' => 'La Esmeralda',
            'lat' => 11.3829, 'lng' => -72.2451, 'habitaciones' => 3, 'banos' => 2, 'area_m2' => 110, 'estrato' => 3,
            'caracteristicas' => ['Amoblada', 'Aire acondicionado', 'Internet', 'Cocina integral'],
            'condiciones' => 'Un mes de depósito y fiador con finca raíz. Contrato mínimo de un año.',
            'fotos' => 'livingroom,interior',
        ],
        [
            'tipo' => 'alquiler', 'titulo' => 'Casa familiar en Villa del Sol',
            'descripcion' => 'Casa con patio grande y garaje, en calle tranquila y pavimentada.',
            'precio' => 850000, 'negociable' => true, 'direccion' => 'Calle 5 # 30-12', 'barrio' => 'Villa del Sol',
            'lat' => 11.3707, 'lng' => -72.2472, 'habitaciones' => 3, 'banos' => 1, 'area_m2' => 140, 'estrato' => 2,
            'caracteristicas' => ['Garaje', 'Patio', 'Mascotas permitidas'],
            'condiciones' => 'Depósito de un mes. Servicios no incluidos.',
            'fotos' => 'house,garden',
        ],
        [
            'tipo' => 'alquiler', 'titulo' => 'Apartaestudio en San Martín',
            'descripcion' => 'Segundo piso independiente, ideal para una o dos personas. Agua, luz e internet incluidos.',
            'precio' => 650000, 'negociable' => false, 'direccion' => 'Carrera 18 # 16-22', 'barrio' => 'San Martín',
            'lat' => 11.3868, 'lng' => -72.2490, 'habitaciones' => 1, 'banos' => 1, 'area_m2' => 40, 'estrato' => 2,
            'caracteristicas' => ['Internet', 'Aire acondicionado', 'Balcón'],
            'condiciones' => 'Pago por adelantado los primeros cinco días del mes.',
            'fotos' => 'apartment,bedroom',
        ],
        [
            'tipo' => 'eventos', 'titulo' => 'Patio La Ceiba',
            'descripcion' => "Patio arborizado para cumpleaños, primeras comuniones y reuniones familiares.\nIncluye mesas y sillas para 120 personas y kiosco techado.",
            'precio' => 600000, 'negociable' => true, 'direccion' => 'Calle 18 # 22-50', 'barrio' => 'Paraíso',
            'lat' => 11.3893, 'lng' => -72.2433, 'capacidad' => 120, 'area_m2' => 500,
            'caracteristicas' => ['Mesas y sillas', 'Kiosco o techo', 'Baños', 'Zona verde', 'Iluminación'],
            'condiciones' => 'Valor por evento de hasta 8 horas. Música hasta la 1 a. m.',
            'fotos' => 'garden,party',
        ],
        [
            'tipo' => 'eventos', 'titulo' => 'Quinta El Paraíso con piscina',
            'descripcion' => 'Quinta con piscina, sonido profesional y planta eléctrica. Perfecta para quince años y matrimonios.',
            'precio' => 1500000, 'negociable' => false, 'direccion' => 'Carrera 30 # 2-10', 'barrio' => 'Villa Inés',
            'lat' => 11.3689, 'lng' => -72.2530, 'capacidad' => 250, 'area_m2' => 1200,
            'caracteristicas' => ['Piscina', 'Sonido', 'Planta eléctrica', 'Parqueadero', 'Baños', 'Cocina'],
            'condiciones' => 'Se separa con el 50 %. El resto, el día del evento.',
            'fotos' => 'pool,party',
        ],
        [
            'tipo' => 'eventos', 'titulo' => 'Salón y patio Los Mangos',
            'descripcion' => 'Espacio cubierto con aire acondicionado y patio al aire libre. Ideal para reuniones de empresa.',
            'precio' => 450000, 'negociable' => true, 'direccion' => 'Calle 11 # 5-18', 'barrio' => 'El Carmen',
            'lat' => 11.3801, 'lng' => -72.2368, 'capacidad' => 80, 'area_m2' => 300,
            'caracteristicas' => ['Aire acondicionado', 'Mesas y sillas', 'Sonido', 'Baños'],
            'condiciones' => null,
            'fotos' => 'hall,event',
        ],
    ];

    public function run(): void
    {
        $duenos = User::whereIn('email', ['cliente@demo.co', 'comerciante@demo.co'])->orderBy('email')->get()->values();
        if ($duenos->isEmpty()) {
            return;
        }
        Storage::disk('public')->makeDirectory('propiedades');

        foreach (self::PROPIEDADES as $i => $datos) {
            $dueno = $duenos[$i % $duenos->count()];
            $tags = $datos['fotos'];
            unset($datos['fotos']);
            $propiedad = Propiedad::firstOrNew(['titulo' => $datos['titulo']]);
            $propiedad->fill($datos + [
                'contacto_nombre' => $dueno->name,
                'contacto_telefono' => $dueno->telefono ?: '30012345'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                'disponible' => true,
            ]);
            $propiedad->user()->associate($dueno);
            if (! $propiedad->galeria) {
                $propiedad->galeria = $this->fotos($tags, $i);
            }
            $propiedad->save();
        }
    }

    /** Hasta tres fotos por propiedad; las que no se puedan bajar se omiten. */
    private function fotos(string $tags, int $i): array
    {
        $rutas = [];
        for ($n = 1; $n <= 3; $n++) {
            $ruta = 'propiedades/demo-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT)."-{$n}.jpg";
            if (! Storage::disk('public')->exists($ruta) && getenv('IMAGENES_DEMO_SOLO_LOCALES') !== '1') {
                try {
                    $lock = abs(crc32("vitrina-propiedad-{$i}-{$n}"));
                    $respuesta = Http::timeout(20)->get("https://loremflickr.com/1200/800/{$tags}?lock={$lock}");
                    if ($respuesta->successful() && str_starts_with((string) $respuesta->header('Content-Type'), 'image/')) {
                        Storage::disk('public')->put($ruta, $respuesta->body());
                    }
                } catch (Throwable) {
                    // Sin internet: sin foto.
                }
            }
            if (Storage::disk('public')->exists($ruta)) {
                $rutas[] = "/storage/{$ruta}";
            }
        }

        return $rutas;
    }
}
