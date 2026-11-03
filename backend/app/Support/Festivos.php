<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Días festivos de Colombia (Ley 51 de 1983, "Ley Emiliani").
 *
 *  - Fijos: 1 ene, 1 may, 20 jul, 7 ago, 8 dic y 25 dic.
 *  - Se corren al lunes siguiente (si no caen en lunes): Reyes (6 ene),
 *    San José (19 mar), San Pedro y San Pablo (29 jun), Asunción (15 ago),
 *    Día de la Raza (12 oct), Todos los Santos (1 nov) e Independencia de
 *    Cartagena (11 nov).
 *  - Según la Pascua: Jueves y Viernes Santo, y corridos al lunes la
 *    Ascensión, Corpus Christi y el Sagrado Corazón.
 */
class Festivos
{
    /** @var array<int, array<string, true>> Festivos por año ('m-d' => true). */
    private static array $porAnio = [];

    public static function esFestivo(CarbonInterface $fecha): bool
    {
        return isset(self::delAnio($fecha->year)[$fecha->format('m-d')]);
    }

    /** @return array<string, true> Los festivos del año como 'm-d' => true. */
    public static function delAnio(int $anio): array
    {
        if (isset(self::$porAnio[$anio])) {
            return self::$porAnio[$anio];
        }

        $fecha = fn (string $md) => Carbon::parse("{$anio}-{$md}");
        $alLunes = fn (Carbon $f) => $f->isMonday() ? $f : $f->next(CarbonInterface::MONDAY);
        $pascua = self::pascua($anio);

        $dias = [
            ...array_map($fecha, ['01-01', '05-01', '07-20', '08-07', '12-08', '12-25']),
            ...array_map(fn ($md) => $alLunes($fecha($md)), ['01-06', '03-19', '06-29', '08-15', '10-12', '11-01', '11-11']),
            $pascua->copy()->subDays(3), // Jueves Santo
            $pascua->copy()->subDays(2), // Viernes Santo
            $alLunes($pascua->copy()->addDays(39)), // Ascensión
            $alLunes($pascua->copy()->addDays(60)), // Corpus Christi
            $alLunes($pascua->copy()->addDays(68)), // Sagrado Corazón
        ];

        $festivos = [];
        foreach ($dias as $dia) {
            $festivos[$dia->format('m-d')] = true;
        }

        return self::$porAnio[$anio] = $festivos;
    }

    /** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Jones/Butcher). */
    private static function pascua(int $anio): Carbon
    {
        $a = $anio % 19;
        $b = intdiv($anio, 100);
        $c = $anio % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $mes = intdiv($h + $l - 7 * $m + 114, 31);
        $dia = (($h + $l - 7 * $m + 114) % 31) + 1;

        return Carbon::create($anio, $mes, $dia)->startOfDay();
    }
}
