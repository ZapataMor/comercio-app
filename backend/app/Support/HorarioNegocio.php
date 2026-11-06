<?php

namespace App\Support;

use App\Models\Negocio;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Horario semanal de un negocio: abre y cierra solo a sus horas.
 *
 * Formato: ['lun' => ['abre' => '07:00', 'cierra' => '20:00'], 'mar' => null, ...]
 * (null = ese día no abre). Si `cierra` es menor o igual que `abre`, cierra
 * al día siguiente (un bar de 18:00 a 02:00).
 *
 * Además de los 7 días va 'fes': el horario de los festivos (ver Festivos),
 * que esos días reemplaza al del día de la semana. Un horario guardado antes
 * de existir 'fes' toma en festivos el del domingo.
 *
 * El switch Abierto/Cerrado sigue mandando: si el dueño lo toca a mano, se
 * respeta hasta la siguiente hora de apertura o cierre del horario.
 *
 * Antes de cerrar se le pregunta al dueño si cierra a esa hora. Si da otra,
 * vale solo para ese cierre (el "ajuste"): el horario semanal no cambia.
 */
class HorarioNegocio
{
    /** Días en orden ISO (lunes = 1 … domingo = 7). */
    public const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

    /** A cuántos minutos del cierre se le advierte al cliente antes de pedir. */
    public const AVISO_CIERRE_MINUTOS = 10;

    /** Cuántos minutos antes del cierre se le pregunta al dueño si cierra a esa hora. */
    public const PREGUNTA_CIERRE_MINUTOS = 20;

    /** Lo más tarde que se puede correr un cierre, en horas. */
    public const MAX_HORAS_AJUSTE = 12;

    /** Clave del horario de los días festivos. */
    public const FESTIVO = 'fes';

    /** Todas las claves del horario: los 7 días y el festivo. */
    public const CLAVES = [...self::DIAS, self::FESTIVO];

    private const NOMBRES = [
        'lun' => 'lunes', 'mar' => 'martes', 'mie' => 'miércoles', 'jue' => 'jueves',
        'vie' => 'viernes', 'sab' => 'sábado', 'dom' => 'domingo', 'fes' => 'festivos',
    ];

    /** Reglas de validación para `horario` en el formulario del negocio. */
    public static function reglas(): array
    {
        $reglas = ['horario' => ['sometimes', 'nullable', 'array']];
        foreach (self::CLAVES as $dia) {
            $reglas["horario.{$dia}"] = ['nullable', 'array'];
            $reglas["horario.{$dia}.abre"] = ["required_with:horario.{$dia}", 'date_format:H:i'];
            $reglas["horario.{$dia}.cierra"] = ["required_with:horario.{$dia}", 'date_format:H:i', "different:horario.{$dia}.abre"];
        }

        return $reglas;
    }

    /**
     * Deja solo los 7 días y el festivo con {abre, cierra} o null; null si no
     * abre nunca. Sin 'fes' (horario de antes de los festivos), en festivos
     * abre como el domingo.
     */
    public static function normalizar(?array $horario): ?array
    {
        if (! $horario) {
            return null;
        }

        if (! array_key_exists(self::FESTIVO, $horario)) {
            $horario[self::FESTIVO] = $horario['dom'] ?? null;
        }

        $limpio = [];
        foreach (self::CLAVES as $dia) {
            $d = $horario[$dia] ?? null;
            $limpio[$dia] = is_array($d) && ! empty($d['abre']) && ! empty($d['cierra'])
                ? ['abre' => $d['abre'], 'cierra' => $d['cierra']]
                : null;
        }

        return array_filter($limpio) ? $limpio : null;
    }

    /** Clave del horario que rige ese día: 'fes' si es festivo, o la del día de la semana. */
    public static function claveDelDia(CarbonInterface $dia): string
    {
        return Festivos::esFestivo($dia) ? self::FESTIVO : self::DIAS[$dia->dayOfWeekIso - 1];
    }

    /**
     * Cierre de hoy que el dueño cambió, o null.
     *
     * @return array{de: CarbonInterface, a: CarbonInterface}|null
     */
    public static function ajusteDe(Negocio $negocio): ?array
    {
        return $negocio->cierre_original && $negocio->cierre_ajustado
            ? ['de' => $negocio->cierre_original, 'a' => $negocio->cierre_ajustado]
            : null;
    }

    /**
     * Franjas abiertas [abre, cierra] de los días alrededor de $ahora (la
     * semana anterior basta para saber el último cambio). Con `$ajuste`, la
     * franja que cerraba a esa hora exacta cierra a la nueva.
     *
     * @return array<int, array{0: CarbonInterface, 1: CarbonInterface}>
     */
    private static function franjas(array $horario, CarbonInterface $ahora, ?array $ajuste = null): array
    {
        $horario = self::normalizar($horario) ?? [];
        $franjas = [];
        for ($atras = 7; $atras >= 0; $atras--) {
            $dia = Carbon::instance($ahora)->subDays($atras)->startOfDay();
            $h = $horario[self::claveDelDia($dia)] ?? null;
            if (! $h) {
                continue;
            }

            $abre = $dia->copy()->setTimeFromTimeString($h['abre']);
            $cierra = $dia->copy()->setTimeFromTimeString($h['cierra']);
            if ($cierra->lte($abre)) {
                $cierra->addDay();
            }
            $franjas[] = [$abre, $ajuste && $cierra->eq($ajuste['de']) ? $ajuste['a'] : $cierra];
        }

        return $franjas;
    }

    /** ¿Según el horario debería estar abierto en este momento? */
    public static function deberiaEstarAbierto(array $horario, CarbonInterface $ahora, ?array $ajuste = null): bool
    {
        foreach (self::franjas($horario, $ahora, $ajuste) as [$abre, $cierra]) {
            if ($ahora->gte($abre) && $ahora->lt($cierra)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Minutos que faltan para que el horario cierre el negocio, si es dentro de
     * AVISO_CIERRE_MINUTOS; null si no cierra tan pronto o no tiene horario.
     */
    public static function minutosParaCerrar(?array $horario, CarbonInterface $ahora, ?array $ajuste = null): ?int
    {
        $horario = self::normalizar($horario);
        if (! $horario) {
            return null;
        }

        foreach (self::franjas($horario, $ahora, $ajuste) as [$abre, $cierra]) {
            if ($ahora->lt($abre) || $ahora->gte($cierra)) {
                continue;
            }
            // Si otra franja empieza justo ahí, sigue abierto.
            if (self::deberiaEstarAbierto($horario, $cierra, $ajuste)) {
                continue;
            }

            $minutos = (int) ceil($ahora->diffInSeconds($cierra) / 60);

            return $minutos <= self::AVISO_CIERRE_MINUTOS ? $minutos : null;
        }

        return null;
    }

    /**
     * Cierre del horario que se le debe preguntar al dueño: el que viene en los
     * próximos PREGUNTA_CIERRE_MINUTOS, si está abierto y aún no respondió.
     */
    public static function cierreSinConfirmar(Negocio $negocio, CarbonInterface $ahora): ?CarbonInterface
    {
        $horario = self::normalizar($negocio->horario);
        if (! $horario || ! $negocio->activo) {
            return null;
        }

        foreach (self::franjas($horario, $ahora) as [$abre, $cierra]) {
            if ($ahora->lt($abre) || $ahora->gte($cierra) || self::deberiaEstarAbierto($horario, $cierra)) {
                continue;
            }

            $faltan = $ahora->diffInSeconds($cierra);
            $yaRespondio = $negocio->cierre_original?->eq($cierra);

            return $faltan <= self::PREGUNTA_CIERRE_MINUTOS * 60 && ! $yaRespondio ? $cierra : null;
        }

        return null;
    }

    /** La respuesta del dueño: `$nuevo` null = sí cierra a la hora del horario. */
    public static function responderCierre(Negocio $negocio, CarbonInterface $cierre, ?CarbonInterface $nuevo): void
    {
        $negocio->forceFill(['cierre_original' => $cierre, 'cierre_ajustado' => $nuevo])->save();
    }

    /** La última hora de apertura o cierre que ya pasó. */
    public static function ultimoCambio(array $horario, CarbonInterface $ahora, ?array $ajuste = null): ?CarbonInterface
    {
        $ultimo = null;
        foreach (self::franjas($horario, $ahora, $ajuste) as $franja) {
            foreach ($franja as $momento) {
                if ($momento->lte($ahora) && (! $ultimo || $momento->gt($ultimo))) {
                    $ultimo = $momento;
                }
            }
        }

        return $ultimo;
    }

    /**
     * Abre o cierra el negocio si el horario lo pide. No pisa un cambio
     * manual hecho después de la última hora de apertura/cierre.
     * Devuelve true si cambió.
     */
    public static function aplicar(Negocio $negocio, CarbonInterface $ahora): bool
    {
        $horario = self::normalizar($negocio->horario);
        if (! $horario) {
            return false;
        }

        $ajuste = self::ajusteDe($negocio);
        $debe = self::deberiaEstarAbierto($horario, $ahora, $ajuste);
        if ($negocio->activo === $debe) {
            return false;
        }

        $ultimo = self::ultimoCambio($horario, $ahora, $ajuste);
        if (! $ultimo || ($negocio->activo_cambiado_at && $negocio->activo_cambiado_at->gte($ultimo))) {
            return false;
        }

        $negocio->forceFill(['activo' => $debe, 'activo_cambiado_at' => $ahora])->save();

        return true;
    }

    /**
     * Texto para el cliente: "Hoy de 7:00 a. m. a 8:00 p. m." / "Hoy no abre",
     * y en festivo "Hoy es festivo: de 8:00 a. m. a 1:00 p. m." / "Hoy es festivo y no abre".
     */
    public static function textoHoy(?array $horario, CarbonInterface $ahora): ?string
    {
        $horario = self::normalizar($horario);
        if (! $horario) {
            return null;
        }

        $festivo = Festivos::esFestivo($ahora);
        $hoy = $horario[self::claveDelDia($ahora)];
        if (! $hoy) {
            return $festivo ? 'Hoy es festivo y no abre' : 'Hoy no abre';
        }

        return ($festivo ? 'Hoy es festivo: de ' : 'Hoy de ').self::hora($hoy['abre']).' a '.self::hora($hoy['cierra']);
    }

    /** Como textoHoy, pero si hoy el dueño cambió el cierre dice la hora nueva. */
    public static function textoHoyDe(Negocio $negocio, CarbonInterface $ahora): ?string
    {
        $ajuste = self::ajusteDe($negocio);
        if ($ajuste && $ahora->lt($ajuste['a']) && $ajuste['de']->diffInHours($ahora, true) <= self::MAX_HORAS_AJUSTE) {
            return 'Hoy cierra a las '.self::hora($ajuste['a']->copy()->setTimezone($ahora->getTimezone())->format('H:i'));
        }

        return self::textoHoy($negocio->horario, $ahora);
    }

    /** "07:00" → "7:00 a. m."; "20:30" → "8:30 p. m." */
    public static function hora(string $hhmm): string
    {
        [$h, $m] = array_map('intval', explode(':', $hhmm));
        $sufijo = $h < 12 ? 'a. m.' : 'p. m.';
        $h12 = $h % 12 === 0 ? 12 : $h % 12;

        return sprintf('%d:%02d %s', $h12, $m, $sufijo);
    }

    /** Nombre del día para mostrar ("lun" → "lunes"). */
    public static function nombreDia(string $dia): string
    {
        return self::NOMBRES[$dia] ?? $dia;
    }
}
