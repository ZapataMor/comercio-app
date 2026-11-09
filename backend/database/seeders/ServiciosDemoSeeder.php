<?php

namespace Database\Seeders;

use App\Models\Negocio;
use App\Models\TipoNegocio;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Veinte negocios de prueba: doce de servicios y ocho con productos y servicios. */
class ServiciosDemoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $dueno = User::firstOrCreate(['email' => 'comerciante@demo.co'], [
                'name' => 'Comerciante Demo', 'password' => 'password123',
            ]);
            $dueno->assignRole('usuario');
            foreach ($this->catalogo() as $i => [$nombre, $tipo, $servicio, $descripcion, $producto]) {
                $negocio = $dueno->negocio()->firstOrCreate(['nombre' => $nombre], [
                    'descripcion' => 'Negocio de demostración. '.$descripcion,
                    'categoria' => $tipo,
                    'direccion' => 'Calle '.(10 + $i).' # 12-'.(20 + $i),
                    'barrio' => ['Centro', 'El Carmen', 'Santander', 'Miraflores'][$i % 4],
                    'activo' => true,
                ]);
                $negocio->miembros()->syncWithoutDetaching([
                    $dueno->id => ['rol' => Negocio::ROL_PROPIETARIO, 'activo' => true],
                ]);
                $categoria = TipoNegocio::firstOrCreate(['slug' => Str::slug($tipo)], ['nombre' => $tipo]);
                $negocio->tiposNegocio()->syncWithoutDetaching([$categoria->id]);
                // No sobrescribe las ediciones del usuario ni duplica al ejecutarse otra vez.
                $negocio->servicios()->firstOrCreate(['nombre' => $servicio], [
                    'descripcion' => $descripcion, 'disponible' => true,
                ]);
                if ($producto) {
                    $negocio->productos()->firstOrCreate(['nombre' => $producto[0]], [
                        'descripcion' => 'Producto de demostración.',
                        'precio' => $producto[1], 'disponible' => true,
                    ]);
                }
            }
        });
    }

    private function catalogo(): array
    {
        return [
            ['Conecta Maicao', 'Internet y redes', 'Instalación de internet residencial', 'Instalación de fibra óptica y configuración inicial de la conexión para hogares. Consulta cobertura y planes con el negocio.', null],
            ['Electrohogar Soluciones', 'Reparación de electrodomésticos', 'Reparación de lavadoras', 'Diagnóstico de fallas de lavado, centrifugado y desagüe. Se acuerda una visita y se cotizan los repuestos antes de reparar.', null],
            ['Frío Guajiro', 'Refrigeración', 'Mantenimiento de neveras', 'Revisión del sistema de enfriamiento, limpieza y diagnóstico de fugas en neveras domésticas.', null],
            ['Taller Motor Caribe', 'Taller automotriz', 'Diagnóstico automotriz', 'Revisión de fallas del motor con escáner y diagnóstico del sistema eléctrico. Recibe orientación sobre las reparaciones necesarias.', null],
            ['Autos Limpios Maicao', 'Lavado de vehículos', 'Lavado completo de autos', 'Lavado exterior, aspirado y limpieza interior de vehículos. Consulta los turnos disponibles antes de visitar el local.', null],
            ['Aire Fresco Técnico', 'Aire acondicionado', 'Mantenimiento de aire acondicionado', 'Limpieza de filtros y serpentines, revisión de drenajes y comprobación del funcionamiento del equipo.', null],
            ['Plomería La Solución', 'Plomería', 'Reparación de fugas de agua', 'Detección y reparación de fugas en grifos, sanitarios y tuberías domésticas. La visita y los materiales se acuerdan previamente.', null],
            ['Electricista Seguro', 'Electricidad', 'Revisión de instalaciones eléctricas', 'Diagnóstico de tomas, interruptores y circuitos del hogar para identificar fallas y cotizar su reparación.', null],
            ['Hogar Impecable', 'Limpieza', 'Limpieza de casas y apartamentos', 'Servicio de aseo por jornada para viviendas. Acuerda con el negocio las áreas, los insumos y la duración de la visita.', null],
            ['Mudanzas La Frontera', 'Mudanzas', 'Mudanzas dentro de Maicao', 'Traslado de muebles y enseres dentro de la ciudad. La cotización depende del volumen, las distancias y el acceso a la vivienda.', null],
            ['Tapicería Renueva', 'Tapicería', 'Retapizado de muebles', 'Restauración de sofás y sillas, cambio de tela y reparación del relleno. Se cotiza según las medidas y el estado del mueble.', null],
            ['Costuras La Puntada', 'Confección y arreglos', 'Arreglos de prendas de vestir', 'Ajuste de tallas, dobladillos y cambio de cierres en prendas. Lleva la prenda para tomar medidas y acordar la entrega.', null],
            ['Llantería Ruta Segura', 'Llantería', 'Reparación de pinchazos', 'Inspección de llantas y reparación de pinchazos para automóviles. También puedes adquirir llantas en el mismo negocio.', ['Llanta para automóvil 185/65 R15', 220000]],
            ['Redes y Tecnología Wayuu', 'Internet y redes', 'Configuración de redes Wi-Fi', 'Instalación y optimización de la señal Wi-Fi en casas y locales. Revisión de puntos sin cobertura y configuración de equipos.', ['Router Wi-Fi doble banda', 145000]],
            ['Moto Repuestos Caribe', 'Taller de motos', 'Mantenimiento preventivo de motos', 'Revisión de frenos, tensión de cadena y estado general de la moto. Los repuestos se cotizan antes de hacer cambios.', ['Aceite para moto 20W-50', 28000]],
            ['CompuCentro Guajira', 'Servicio técnico', 'Mantenimiento de computadores', 'Limpieza interna, revisión de temperatura y diagnóstico del rendimiento de computadores portátiles y de escritorio.', ['Mouse inalámbrico', 35000]],
            ['Celulares Punto Móvil', 'Servicio técnico', 'Reparación de celulares', 'Diagnóstico de pantallas, conectores de carga y baterías. Consulta la disponibilidad de repuestos para tu modelo.', ['Cable USB-C', 18000]],
            ['Ferretería Manos a la Obra', 'Ferretería', 'Instalación de accesorios del hogar', 'Instalación de repisas, soportes y accesorios. Acuerda las medidas, el tipo de pared y los materiales necesarios.', ['Soporte de pared para televisor', 65000]],
            ['Papelería Copia Fácil', 'Papelería', 'Impresión y digitalización de documentos', 'Impresión en blanco y negro o a color, fotocopias y escaneo de documentos. Consulta formatos y tiempos con la papelería.', ['Resma de papel carta', 24000]],
            ['Jardín Verde Maicao', 'Jardinería', 'Mantenimiento de jardines', 'Poda, limpieza y cuidado de jardines residenciales y comerciales. Se cotiza según el área y los trabajos requeridos.', ['Tierra abonada de 5 kg', 16000]],
        ];
    }
}
