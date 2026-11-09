<?php

namespace Database\Seeders;

use App\Models\Negocio;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/** Fotos locales para los veinte negocios de servicios del catálogo demo. */
class ImagenesServiciosDemoSeeder extends Seeder
{
    public function run(): void
    {
        $fotos = [
            'Conecta Maicao' => 'electronics',
            'Electrohogar Soluciones' => 'tools',
            'Frío Guajiro' => 'tools',
            'Taller Motor Caribe' => 'mechanic',
            'Autos Limpios Maicao' => 'cleaning',
            'Aire Fresco Técnico' => 'electrical',
            'Plomería La Solución' => 'tools',
            'Electricista Seguro' => 'electrical',
            'Hogar Impecable' => 'cleaning',
            'Mudanzas La Frontera' => 'moving',
            'Tapicería Renueva' => 'sewing',
            'Costuras La Puntada' => 'sewing',
            'Llantería Ruta Segura' => 'mechanic',
            'Redes y Tecnología Wayuu' => 'electronics',
            'Moto Repuestos Caribe' => 'mechanic',
            'CompuCentro Guajira' => 'technology',
            'Celulares Punto Móvil' => 'electronics',
            'Ferretería Manos a la Obra' => 'tools',
            'Papelería Copia Fácil' => 'technology',
            'Jardín Verde Maicao' => 'gardening',
        ];
        foreach (array_unique($fotos) as $foto) {
            $origen = public_path("images/demo-servicios/{$foto}.jpg");
            if (! is_file($origen)) {
                throw new \RuntimeException("Falta la foto demo: {$foto}");
            }
            Storage::disk('public')->put("negocios/servicios-demo/{$foto}.jpg", file_get_contents($origen));
        }
        Negocio::whereIn('nombre', array_keys($fotos))
            ->whereHas('servicios')
            ->whereHas('user', fn ($q) => $q->where('email', 'comerciante@demo.co'))
            ->each(function (Negocio $negocio) use ($fotos) {
                $actual = $negocio->imagen;
                if ($actual && ! str_starts_with($actual, 'negocios/servicios-demo/')
                    && ! str_starts_with(basename($actual), 'demo-')
                    && ! str_starts_with(basename($actual), 'tematico-')) {
                    return;
                }
                $negocio->forceFill(['imagen' => 'negocios/servicios-demo/'.$fotos[$negocio->nombre].'.jpg'])->save();
            });
    }
}
