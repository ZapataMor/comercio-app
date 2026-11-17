<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Ruta por calles entre dos puntos para la pantalla «Cómo llegar» de la app,
 * sin salir a Google Maps.
 *
 * La calcula un servidor OSRM (rutas sobre OpenStreetMap, los mismos datos
 * del mapa de la app). Las direcciones de los servidores van en
 * config/services.php → rutas: por defecto los públicos de prueba; para el
 * piloto, un OSRM propio en el VPS.
 *
 * Devuelve la línea para dibujar, la distancia, el tiempo y los pasos con su
 * indicación en español ("Gira a la derecha por la Carrera 15"). Cada paso
 * dice a cuántos metros del inicio está su maniobra (`en_m`): con eso la app
 * sabe cuál viene y a cuánto, según por dónde va la persona.
 */
class RutaCalles
{
    /** moto: por calles en vehículo (respeta los sentidos). pie: caminando. */
    public const MODOS = ['moto', 'pie'];

    /** Más lejos que esto no es un recorrido dentro de la ciudad. */
    public const MAX_KM = 60;

    /** Minutos que se guarda una ruta ya calculada (mismo origen y destino). */
    private const CACHE_MINUTOS = 10;

    /**
     * La ruta, o null si no hay camino por calles entre los dos puntos.
     *
     * @param  array{lat: float, lng: float}  $desde
     * @param  array{lat: float, lng: float}  $hasta
     * @return array{modo: string, distancia_m: int, duracion_s: int, linea: list<array{0: float, 1: float}>, pasos: list<array<string, mixed>>}|null
     *
     * @throws RuntimeException si el servidor de rutas no responde bien.
     */
    public static function calcular(array $desde, array $hasta, string $modo = 'moto'): ?array
    {
        // 4 decimales ≈ 11 m: quien pide la misma ruta desde casi el mismo
        // punto reutiliza la que ya se calculó.
        $desde = self::redondear($desde);
        $hasta = self::redondear($hasta);
        $clave = sprintf('ruta:%s:%.4F,%.4F:%.4F,%.4F', $modo, $desde['lat'], $desde['lng'], $hasta['lat'], $hasta['lng']);

        $ruta = Cache::get($clave);
        if ($ruta === null) {
            $ruta = self::pedir($desde, $hasta, $modo);
            // "Sin camino" también se guarda (como false) para no volver a preguntar.
            Cache::put($clave, $ruta ?? false, now()->addMinutes(self::CACHE_MINUTOS));
        }

        return $ruta ?: null;
    }

    /** @return array{lat: float, lng: float} */
    private static function redondear(array $p): array
    {
        return ['lat' => round((float) $p['lat'], 4), 'lng' => round((float) $p['lng'], 4)];
    }

    private static function pedir(array $desde, array $hasta, string $modo): ?array
    {
        $base = rtrim((string) config("services.rutas.{$modo}"), '/');
        $url = sprintf('%s/%.6F,%.6F;%.6F,%.6F', $base, $desde['lng'], $desde['lat'], $hasta['lng'], $hasta['lat']);

        $respuesta = Http::timeout((int) config('services.rutas.timeout', 8))
            ->withUserAgent('Vitrina/1.0')
            ->acceptJson()
            ->get($url, ['overview' => 'full', 'geometries' => 'geojson', 'steps' => 'true']);

        $codigo = $respuesta->json('code');
        // OSRM responde 400 con estos códigos cuando no hay calle cerca o no se puede llegar.
        if (in_array($codigo, ['NoRoute', 'NoSegment'], true)) {
            return null;
        }
        if (! $respuesta->successful() || $codigo !== 'Ok' || ! $respuesta->json('routes.0')) {
            throw new RuntimeException("El servidor de rutas respondió {$respuesta->status()} ({$codigo}).");
        }

        $ruta = $respuesta->json('routes.0');

        return [
            'modo' => $modo,
            'distancia_m' => (int) round($ruta['distance']),
            'duracion_s' => (int) round($ruta['duration']),
            'linea' => array_map(
                fn (array $c) => [round($c[0], 6), round($c[1], 6)],
                $ruta['geometry']['coordinates'] ?? [],
            ),
            'pasos' => self::pasos($ruta['legs'][0]['steps'] ?? []),
        ];
    }

    /** Cada paso con su indicación, su ícono y en qué metro del recorrido está. */
    private static function pasos(array $pasos): array
    {
        $resultado = [];
        $recorrido = 0.0;

        foreach ($pasos as $paso) {
            $m = $paso['maneuver'] ?? [];
            $tipo = $m['type'] ?? 'turn';
            $calle = trim((string) ($paso['name'] ?? ''));

            // "Notificación" no es una maniobra: solo avisa algo de la vía.
            if ($tipo !== 'notification') {
                $resultado[] = [
                    'texto' => self::indicacion($tipo, $m['modifier'] ?? null, $calle, $m['exit'] ?? null),
                    'icono' => self::icono($tipo, $m['modifier'] ?? null),
                    'calle' => $calle !== '' ? $calle : null,
                    'en_m' => (int) round($recorrido),
                    'punto' => ['lat' => round($m['location'][1] ?? 0, 6), 'lng' => round($m['location'][0] ?? 0, 6)],
                ];
            }
            $recorrido += (float) ($paso['distance'] ?? 0);
        }

        return $resultado;
    }

    /** La indicación en español de una maniobra de OSRM. */
    public static function indicacion(string $tipo, ?string $giro, string $calle = '', ?int $salida = null): string
    {
        $por = $calle !== '' ? ' por '.self::conArticulo($calle) : '';
        $hacia = $calle !== '' ? ' hacia '.self::conArticulo($calle) : '';

        return match ($tipo) {
            'depart' => 'Arranca'.$por,
            'arrive' => match ($giro) {
                'right', 'slight right', 'sharp right' => 'Llegas: el destino queda a la derecha',
                'left', 'slight left', 'sharp left' => 'Llegas: el destino queda a la izquierda',
                default => 'Llegas al destino',
            },
            'roundabout', 'rotary' => 'En la glorieta, toma la '.self::ordinal($salida).' salida'.$hacia,
            'roundabout turn' => 'En la glorieta, '.lcfirst(self::giro($giro)).$por,
            'exit roundabout', 'exit rotary' => 'Sal de la glorieta'.$por,
            'fork' => 'En la bifurcación, '.self::mantente($giro).$por,
            'end of road' => 'Al final de la vía, '.lcfirst(self::giro($giro)).$por,
            'merge' => 'Incorpórate'.$por,
            'new name', 'continue', 'use lane' => in_array($giro, [null, 'straight'], true)
                ? 'Sigue derecho'.$por
                : self::giro($giro).$por,
            default => self::giro($giro).$por,
        };
    }

    /** "Gira a la derecha", "Gira levemente a la izquierda", "Sigue derecho"... */
    private static function giro(?string $giro): string
    {
        return match ($giro) {
            'right' => 'Gira a la derecha',
            'left' => 'Gira a la izquierda',
            'slight right' => 'Gira levemente a la derecha',
            'slight left' => 'Gira levemente a la izquierda',
            'sharp right' => 'Gira cerrado a la derecha',
            'sharp left' => 'Gira cerrado a la izquierda',
            'uturn' => 'Da la vuelta en U',
            default => 'Sigue derecho',
        };
    }

    private static function mantente(?string $giro): string
    {
        return match (true) {
            str_contains((string) $giro, 'right') => 'mantente a la derecha',
            str_contains((string) $giro, 'left') => 'mantente a la izquierda',
            default => 'sigue derecho',
        };
    }

    private static function ordinal(?int $n): string
    {
        return [1 => 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta'][$n ?? 1] ?? "{$n}.ª";
    }

    /** "la Carrera 15", "el Callejón ...", o el nombre tal cual si no se sabe. */
    private static function conArticulo(string $calle): string
    {
        if (preg_match('/^(calle|carrera|avenida|av\.|transversal|diagonal|v[ií]a|troncal|autopista|circunvalar|variante|carretera|ruta)\b/iu', $calle)) {
            return 'la '.$calle;
        }
        if (preg_match('/^(paseo|boulevard|bulevar|callej[oó]n|camino|anillo|pasaje|sendero)\b/iu', $calle)) {
            return 'el '.$calle;
        }

        return $calle;
    }

    /**
     * Para el ícono de la indicación: izquierda, derecha, recto, vuelta (en U),
     * glorieta, llegada o salida.
     */
    private static function icono(string $tipo, ?string $giro): string
    {
        return match (true) {
            $tipo === 'depart' => 'salida',
            $tipo === 'arrive' => 'llegada',
            in_array($tipo, ['roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary'], true) => 'glorieta',
            $giro === 'uturn' => 'vuelta',
            str_contains((string) $giro, 'right') => 'derecha',
            str_contains((string) $giro, 'left') => 'izquierda',
            default => 'recto',
        };
    }
}
