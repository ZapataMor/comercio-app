<?php

namespace App\Support;

/**
 * En cuánto llega el domiciliario, estimado solo con la distancia.
 *
 * No usa ningún servicio de rutas: mide la línea recta entre dos puntos, la
 * alarga un poco (las calles no van en línea recta) y la divide por la
 * velocidad promedio de una moto en Maicao. Es una aproximación: no sabe de
 * tráfico ni de calles cerradas, por eso la app la muestra con "aprox.".
 */
class TiempoEntrega
{
    /** Cuánto más largo es el camino por calles que la línea recta. */
    public const FACTOR_CALLES = 1.35;

    /** Velocidad promedio de una moto en ciudad, con cruces y semáforos. */
    public const KMH = 22;

    /** Parquear, ubicar la casa y timbrar. */
    public const MINUTOS_LLEGADA = 1;

    /** Distancia en línea recta, en kilómetros (fórmula del haversine). */
    public static function km(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $radioTierra = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $radioTierra * asin(min(1.0, sqrt($a)));
    }

    /**
     * Minutos estimados entre dos puntos, redondeados hacia arriba.
     *
     * @param  array{lat: float, lng: float}|null  $desde
     * @param  array{lat: float, lng: float}|null  $hasta
     */
    public static function minutos(?array $desde, ?array $hasta): ?int
    {
        if (! $desde || ! $hasta) {
            return null;
        }

        $km = self::km($desde['lat'], $desde['lng'], $hasta['lat'], $hasta['lng']) * self::FACTOR_CALLES;

        return (int) ceil($km / self::KMH * 60) + self::MINUTOS_LLEGADA;
    }
}
