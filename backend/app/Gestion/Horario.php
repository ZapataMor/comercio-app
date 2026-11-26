<?php

namespace App\Gestion;

use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Días y horas de trabajo de una persona en el negocio.
 *
 * Se guarda como {"1": {"entrada": "08:00", "salida": "17:00"}, "6": {...}}:
 * 1 = lunes … 7 = domingo (ISO). El día que no está es de descanso; la hora
 * es opcional (hay quien va «por la mañana» sin hora fija). NULL = sin definir.
 */
final class Horario
{
    public const DIAS = [1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo'];

    public const INICIALES = [1 => 'L', 2 => 'M', 3 => 'M', 4 => 'J', 5 => 'V', 6 => 'S', 7 => 'D'];

    /** Atajos del formulario. */
    public const ATAJOS = [
        'Toda la semana' => [1, 2, 3, 4, 5, 6, 7],
        'Lunes a viernes' => [1, 2, 3, 4, 5],
        'Lunes a sábado' => [1, 2, 3, 4, 5, 6],
        'Fines de semana' => [6, 7],
    ];

    /** Horas que se pueden elegir: cada media hora. @return array<string, string> valor => texto */
    public static function horas(): array
    {
        $horas = [];
        for ($m = 0; $m < 24 * 60; $m += 30) {
            $valor = sprintf('%02d:%02d', intdiv($m, 60), $m % 60);
            $horas[$valor] = self::hora($valor);
        }

        return $horas;
    }

    /** «08:30» → «8:30 a. m.» */
    public static function hora(?string $valor): string
    {
        if (! $valor || ! preg_match('/\A(\d{2}):(\d{2})\z/', $valor, $m)) {
            return '';
        }
        $h = (int) $m[1];

        return (($h % 12) ?: 12).':'.$m[2].($h < 12 ? ' a. m.' : ' p. m.');
    }

    /** Lee lo guardado (texto JSON del pivote o arreglo). @return array<int, array{entrada: ?string, salida: ?string}>|null */
    public static function leer(mixed $guardado): ?array
    {
        if (is_string($guardado)) {
            $guardado = json_decode($guardado, true);
        }
        if (! is_array($guardado)) {
            return null;
        }
        $dias = [];
        foreach ($guardado as $dia => $horas) {
            $dia = (int) $dia;
            if (isset(self::DIAS[$dia])) {
                $dias[$dia] = ['entrada' => $horas['entrada'] ?? null, 'salida' => $horas['salida'] ?? null];
            }
        }
        ksort($dias);

        return $dias;
    }

    /**
     * Del formulario (dias[], entrada[d], salida[d]) a lo que se guarda.
     * Sin ningún día marcado queda «sin definir» (NULL).
     *
     * @return array<string, array{entrada: ?string, salida: ?string}>|null
     */
    public static function desdeFormulario(array $entrada): ?array
    {
        $dias = array_values(array_unique(array_map('intval', array_filter((array) ($entrada['dias'] ?? []), 'is_scalar'))));
        $dias = array_values(array_filter($dias, fn ($d) => isset(self::DIAS[$d])));
        sort($dias);
        if (! $dias) {
            return null;
        }

        $horas = self::horas();
        $horario = [];
        foreach ($dias as $d) {
            $desde = $entrada['entrada'][$d] ?? null;
            $hasta = $entrada['salida'][$d] ?? null;
            $desde = is_string($desde) && isset($horas[$desde]) ? $desde : null;
            $hasta = is_string($hasta) && isset($horas[$hasta]) ? $hasta : null;
            if (($desde === null) !== ($hasta === null)) {
                throw ValidationException::withMessages(['horario' => 'El '.mb_strtolower(self::DIAS[$d]).' necesita la hora de entrada y la de salida (o ninguna de las dos).']);
            }
            if ($desde !== null && $desde === $hasta) {
                throw ValidationException::withMessages(['horario' => 'El '.mb_strtolower(self::DIAS[$d]).' la entrada y la salida no pueden ser a la misma hora.']);
            }
            $horario[(string) $d] = ['entrada' => $desde, 'salida' => $hasta];
        }

        return $horario;
    }

    /** «Lunes a viernes», «Fines de semana», «Lunes, miércoles y viernes»… */
    public static function resumen(?array $horario): string
    {
        if ($horario === null) {
            return 'Días sin definir';
        }
        $dias = array_keys($horario);
        if (! $dias) {
            return 'Sin días de trabajo';
        }
        foreach (self::ATAJOS as $texto => $atajo) {
            if ($dias === $atajo) {
                return $texto;
            }
        }
        // Seguidos (de 3 o más): «Martes a sábado».
        if (count($dias) >= 3 && end($dias) - $dias[0] === count($dias) - 1) {
            return self::DIAS[$dias[0]].' a '.mb_strtolower(self::DIAS[end($dias)]);
        }
        $nombres = array_map(fn ($d) => mb_strtolower(self::DIAS[$d]), $dias);
        $ultimo = array_pop($nombres);
        $texto = $nombres ? implode(', ', $nombres).' y '.$ultimo : $ultimo;

        return mb_strtoupper(mb_substr($texto, 0, 1)).mb_substr($texto, 1);
    }

    /** Horas de un día: «8:00 a. m. – 5:00 p. m.» o null si no tiene hora. */
    public static function horasDelDia(?array $horario, int $dia): ?string
    {
        $h = $horario[$dia] ?? null;
        if (! $h || ! $h['entrada']) {
            return null;
        }

        return self::hora($h['entrada']).' – '.self::hora($h['salida']);
    }

    public static function trabaja(?array $horario, CarbonInterface $fecha): bool
    {
        return $horario !== null && isset($horario[$fecha->isoWeekday()]);
    }
}
