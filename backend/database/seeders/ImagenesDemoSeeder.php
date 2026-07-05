<?php

namespace Database\Seeders;

use App\Models\Negocio;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Descarga pools de imágenes temáticas y las reparte aleatoriamente.
 *
 * No intenta hacer clasificación visual local. En su lugar, evita imágenes
 * genéricas usando búsquedas por tipo de negocio/producto en LoremFlickr.
 * Solo reemplaza registros sin imagen o con imágenes demo previas.
 */
class ImagenesDemoSeeder extends Seeder
{
    private const NEGOCIO_POOL = 3;
    private const PRODUCTO_POOL = 5;

    /** @var array<string, array<int, string>> */
    private array $poolCache = [];

    public function run(): void
    {
        $this->prepararDirectorios();

        Negocio::query()
            ->with('tiposNegocio')
            ->orderBy('id')
            ->get()
            ->each(function (Negocio $negocio) {
                if (! $this->puedeReemplazar($negocio->imagen)) {
                    return;
                }

                $grupo = $this->grupoNegocio(
                    $negocio->tiposNegocio->pluck('nombre')->implode(' ') ?: $negocio->categoria,
                    $negocio->nombre,
                );
                $ruta = $this->tomarImagen('negocios', $grupo, self::NEGOCIO_POOL, 1200, 760);

                if ($ruta) {
                    $negocio->forceFill(['imagen' => $ruta])->save();
                }
            });

        Producto::withTrashed()
            ->with(['categoria', 'negocio.tiposNegocio'])
            ->orderBy('id')
            ->get()
            ->each(function (Producto $producto) {
                if (! $this->puedeReemplazar($producto->imagen)) {
                    return;
                }

                $grupo = $this->grupoProducto(
                    $producto->nombre,
                    $producto->categoria?->nombre,
                    $producto->negocio?->tiposNegocio?->pluck('nombre')->implode(' ') ?: $producto->negocio?->categoria,
                );
                $ruta = $this->tomarImagen('productos', $grupo, self::PRODUCTO_POOL, 900, 700);

                if ($ruta) {
                    $producto->forceFill(['imagen' => $ruta])->save();
                }
            });
    }

    private function prepararDirectorios(): void
    {
        foreach (['negocios', 'productos'] as $carpeta) {
            if (! Storage::disk('public')->exists($carpeta)) {
                Storage::disk('public')->makeDirectory($carpeta);
            }
        }
    }

    private function puedeReemplazar(?string $ruta): bool
    {
        if (! $ruta) {
            return true;
        }

        $nombre = basename($ruta);

        return str_starts_with($nombre, 'demo-') || str_starts_with($nombre, 'tematico-');
    }

    private function tomarImagen(string $carpeta, string $grupo, int $cantidad, int $ancho, int $alto): ?string
    {
        $cacheKey = "{$carpeta}:{$grupo}";

        if (! isset($this->poolCache[$cacheKey])) {
            $this->poolCache[$cacheKey] = $this->crearPool($carpeta, $grupo, $cantidad, $ancho, $alto);
        }

        $pool = $this->poolCache[$cacheKey];

        if ($pool === []) {
            return null;
        }

        return $pool[array_rand($pool)];
    }

    /**
     * @return array<int, string>
     */
    private function crearPool(string $carpeta, string $grupo, int $cantidad, int $ancho, int $alto): array
    {
        $rutas = [];
        $tags = $this->tags($grupo);

        for ($i = 1; $i <= $cantidad; $i++) {
            $ruta = "{$carpeta}/tematico-{$grupo}-".str_pad((string) $i, 2, '0', STR_PAD_LEFT).'.jpg';
            $rutas[] = $ruta;

            if (Storage::disk('public')->exists($ruta)) {
                continue;
            }

            $seed = abs(crc32("vitrina-{$carpeta}-{$grupo}-{$i}"));
            $url = "https://loremflickr.com/{$ancho}/{$alto}/{$tags}?lock={$seed}";

            try {
                $respuesta = Http::timeout(30)->retry(2, 700)->get($url);
            } catch (ConnectionException) {
                $this->command?->warn("No se pudo conectar para descargar {$url}");
                array_pop($rutas);

                continue;
            }

            if (! $respuesta->successful()) {
                $this->command?->warn("No se pudo descargar {$url}");
                array_pop($rutas);

                continue;
            }

            Storage::disk('public')->put($ruta, $respuesta->body());
        }

        return array_values(array_filter(
            $rutas,
            fn (string $ruta) => Storage::disk('public')->exists($ruta)
        ));
    }

    private function grupoNegocio(?string $categoria, string $nombre): string
    {
        $texto = $this->normalizar(($categoria ?? '').' '.$nombre);

        return match (true) {
            str_contains($texto, 'restaurante') || str_contains($texto, 'asadero') || str_contains($texto, 'comida') => 'restaurant',
            str_contains($texto, 'cafe') || str_contains($texto, 'cafeteria') => 'coffee-shop',
            str_contains($texto, 'bar') => 'bar',
            str_contains($texto, 'helad') => 'ice-cream-shop',
            str_contains($texto, 'panader') => 'bakery',
            str_contains($texto, 'papeler') => 'stationery-store',
            str_contains($texto, 'ferreter') => 'hardware-store',
            str_contains($texto, 'ropa') || str_contains($texto, 'boutique') || str_contains($texto, 'moda') => 'clothing-store',
            str_contains($texto, 'frut') || str_contains($texto, 'verdura') => 'produce-store',
            str_contains($texto, 'carn') => 'butcher-shop',
            str_contains($texto, 'drogu') || str_contains($texto, 'farma') => 'pharmacy',
            str_contains($texto, 'licor') => 'liquor-store',
            default => 'grocery-store',
        };
    }

    private function grupoProducto(string $nombre, ?string $categoria, ?string $negocioCategoria): string
    {
        $texto = $this->normalizar($nombre.' '.($categoria ?? '').' '.($negocioCategoria ?? ''));

        return match (true) {
            str_contains($texto, 'cafe') || str_contains($texto, 'capuchino') || str_contains($texto, 'latte') || str_contains($texto, 'tinto') => 'coffee',
            str_contains($texto, 'gaseosa') || str_contains($texto, 'jugo') || str_contains($texto, 'agua') || str_contains($texto, 'bebida') || str_contains($texto, 'limonada') => 'drink',
            str_contains($texto, 'cerveza') || str_contains($texto, 'ron') || str_contains($texto, 'whisky') || str_contains($texto, 'vino') || str_contains($texto, 'aguardiente') => 'liquor',
            str_contains($texto, 'helado') || str_contains($texto, 'malteada') || str_contains($texto, 'sundae') || str_contains($texto, 'paleta') => 'ice-cream',
            str_contains($texto, 'pan') || str_contains($texto, 'pastel') || str_contains($texto, 'torta') || str_contains($texto, 'galleta') || str_contains($texto, 'croissant') => 'bakery',
            str_contains($texto, 'pollo') || str_contains($texto, 'res') || str_contains($texto, 'cerdo') || str_contains($texto, 'carne') || str_contains($texto, 'bistec') || str_contains($texto, 'chorizo') || str_contains($texto, 'mojarra') => 'meat',
            str_contains($texto, 'fruta') || str_contains($texto, 'banano') || str_contains($texto, 'manzana') || str_contains($texto, 'naranja') || str_contains($texto, 'fresa') => 'fruit',
            str_contains($texto, 'verdura') || str_contains($texto, 'tomate') || str_contains($texto, 'cebolla') || str_contains($texto, 'papa') || str_contains($texto, 'zanahoria') || str_contains($texto, 'cilantro') => 'vegetables',
            str_contains($texto, 'arroz') || str_contains($texto, 'azucar') || str_contains($texto, 'aceite') || str_contains($texto, 'sal') || str_contains($texto, 'atun') || str_contains($texto, 'huevo') => 'groceries',
            str_contains($texto, 'camiseta') || str_contains($texto, 'jean') || str_contains($texto, 'vestido') || str_contains($texto, 'tenis') || str_contains($texto, 'gorra') || str_contains($texto, 'chaqueta') => 'clothing',
            str_contains($texto, 'cuaderno') || str_contains($texto, 'lapicero') || str_contains($texto, 'lapiz') || str_contains($texto, 'papel') || str_contains($texto, 'cartulina') || str_contains($texto, 'colores') => 'stationery',
            str_contains($texto, 'martillo') || str_contains($texto, 'tornillo') || str_contains($texto, 'taladro') || str_contains($texto, 'cable') || str_contains($texto, 'pintura') || str_contains($texto, 'cemento') => 'tools',
            str_contains($texto, 'acetaminofen') || str_contains($texto, 'ibuprofeno') || str_contains($texto, 'shampoo') || str_contains($texto, 'jabon') || str_contains($texto, 'panal') || str_contains($texto, 'alcohol') => 'pharmacy-product',
            default => 'food',
        };
    }

    private function tags(string $grupo): string
    {
        return match ($grupo) {
            'restaurant' => 'restaurant,food',
            'coffee-shop' => 'coffee,cafe',
            'bar' => 'bar,drinks',
            'ice-cream-shop' => 'icecream,dessert',
            'bakery' => 'bakery,bread',
            'stationery-store' => 'stationery,office',
            'hardware-store' => 'hardware,tools',
            'clothing-store' => 'clothes,fashion',
            'produce-store' => 'fruit,vegetables',
            'butcher-shop' => 'meat,butcher',
            'pharmacy' => 'pharmacy,medicine',
            'liquor-store' => 'liquor,bottles',
            'grocery-store' => 'grocery,store',
            'coffee' => 'coffee,cup',
            'drink' => 'drink,beverage',
            'liquor' => 'liquor,bottle',
            'ice-cream' => 'icecream,dessert',
            'meat' => 'meat,food',
            'fruit' => 'fruit,fresh',
            'vegetables' => 'vegetables,fresh',
            'groceries' => 'groceries,food',
            'clothing' => 'clothing,fashion',
            'stationery' => 'stationery,school',
            'tools' => 'tools,hardware',
            'pharmacy-product' => 'medicine,pharmacy',
            default => 'food,product',
        };
    }

    private function normalizar(string $texto): string
    {
        return Str::of($texto)->ascii()->lower()->toString();
    }
}
