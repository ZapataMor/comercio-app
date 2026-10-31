<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\User;

/**
 * Última posición del domiciliario en el mapa.
 *
 * La app del domiciliario la envía cada pocos segundos mientras está en turno
 * o lleva una entrega. Aquí se decide si se guarda y si todavía sirve: una
 * posición de hace más de VIGENCIA_MINUTOS no se muestra (el GPS se apagó,
 * se quedó sin datos...), para no pintar al domiciliario donde ya no está.
 */
class UbicacionDomiciliario
{
    public const VIGENCIA_MINUTOS = 5;

    /** ¿Debe compartir su ubicación? En turno, o con una entrega en curso. */
    public static function debeCompartir(User $domiciliario): bool
    {
        return $domiciliario->en_turno || self::tieneEntregaEnCurso($domiciliario);
    }

    public static function tieneEntregaEnCurso(User $domiciliario): bool
    {
        return Pedido::where('domiciliario_id', $domiciliario->id)
            ->whereIn('estado', Pedido::EN_RUTA)
            ->exists();
    }

    public static function guardar(User $domiciliario, float $lat, float $lng): void
    {
        $domiciliario->forceFill([
            'ubicacion_lat' => $lat,
            'ubicacion_lng' => $lng,
            'ubicacion_at' => now(),
        ])->save();
    }

    public static function borrar(User $domiciliario): void
    {
        $domiciliario->forceFill([
            'ubicacion_lat' => null,
            'ubicacion_lng' => null,
            'ubicacion_at' => null,
        ])->save();
    }

    /**
     * Posición vigente para la app, o null si no hay o ya es vieja.
     *
     * @return array{lat: float, lng: float, hace_segundos: int}|null
     */
    public static function de(?User $domiciliario): ?array
    {
        if (! $domiciliario || $domiciliario->ubicacion_at === null || $domiciliario->ubicacion_lat === null) {
            return null;
        }

        $at = $domiciliario->ubicacion_at;
        if ($at->lt(now()->subMinutes(self::VIGENCIA_MINUTOS))) {
            return null;
        }

        return [
            'lat' => (float) $domiciliario->ubicacion_lat,
            'lng' => (float) $domiciliario->ubicacion_lng,
            'hace_segundos' => (int) max(0, $at->diffInSeconds(now())),
        ];
    }
}
