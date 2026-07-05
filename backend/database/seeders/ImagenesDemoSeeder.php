<?php

namespace Database\Seeders;

use App\Models\Negocio;
use App\Models\Producto;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Asigna imágenes de prueba descargadas desde Picsum.
 *
 * Es idempotente: no reemplaza imágenes existentes y reutiliza archivos ya
 * descargados en storage/app/public.
 */
class ImagenesDemoSeeder extends Seeder
{
    private const NEGOCIOS_OBJETIVO = 30;
    private const PRODUCTOS_OBJETIVO = 160;

    public function run(): void
    {
        $this->prepararDirectorio('negocios');
        $this->prepararDirectorio('productos');

        $negociosFaltantes = max(0, self::NEGOCIOS_OBJETIVO - Negocio::query()->whereNotNull('imagen')->count());
        $productosFaltantes = max(0, self::PRODUCTOS_OBJETIVO - Producto::query()->whereNotNull('imagen')->count());

        Negocio::query()
            ->whereNull('imagen')
            ->orderBy('id')
            ->limit($negociosFaltantes)
            ->get()
            ->each(function (Negocio $negocio, int $indice) {
                $ruta = $this->imagen(
                    carpeta: 'negocios',
                    seed: 'vitrina-negocio-'.$negocio->id.'-'.$this->slug($negocio->nombre),
                    ancho: 1100,
                    alto: 680,
                    indice: $indice,
                );

                if ($ruta) {
                    $negocio->forceFill(['imagen' => $ruta])->save();
                }
            });

        Producto::query()
            ->whereNull('imagen')
            ->where('disponible', true)
            ->orderBy('id')
            ->limit($productosFaltantes)
            ->get()
            ->each(function (Producto $producto, int $indice) {
                $ruta = $this->imagen(
                    carpeta: 'productos',
                    seed: 'vitrina-producto-'.$producto->id.'-'.$this->slug($producto->nombre),
                    ancho: 900,
                    alto: 700,
                    indice: $indice,
                );

                if ($ruta) {
                    $producto->forceFill(['imagen' => $ruta])->save();
                }
            });
    }

    private function prepararDirectorio(string $carpeta): void
    {
        if (! Storage::disk('public')->exists($carpeta)) {
            Storage::disk('public')->makeDirectory($carpeta);
        }
    }

    private function imagen(string $carpeta, string $seed, int $ancho, int $alto, int $indice): ?string
    {
        $nombre = 'demo-'.str_pad((string) ($indice + 1), 3, '0', STR_PAD_LEFT).'-'.$seed.'.jpg';
        $ruta = $carpeta.'/'.$nombre;

        if (Storage::disk('public')->exists($ruta)) {
            return $ruta;
        }

        $url = "https://picsum.photos/seed/{$seed}/{$ancho}/{$alto}.jpg";
        try {
            $respuesta = Http::timeout(25)->retry(2, 500)->get($url);
        } catch (ConnectionException $e) {
            $this->command?->warn("No se pudo conectar para descargar {$url}");

            return null;
        }

        if (! $respuesta->successful()) {
            $this->command?->warn("No se pudo descargar {$url}");

            return null;
        }

        Storage::disk('public')->put($ruta, $respuesta->body());

        return $ruta;
    }

    private function slug(string $texto): string
    {
        return Str::slug($texto) ?: Str::random(8);
    }
}
