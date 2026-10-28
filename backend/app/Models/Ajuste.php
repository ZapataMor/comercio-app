<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Valores de la plataforma que el admin cambia desde la app sin tocar código
 * (por ahora, la tarifa de domicilio). Se leen con caché.
 */
class Ajuste extends Model
{
    protected $table = 'ajustes';

    protected $primaryKey = 'clave';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['clave', 'valor'];

    /** Lo que cobra cada domicilio (COP), igual para todos los pedidos. */
    public const TARIFA_DOMICILIO = 'tarifa_domicilio';

    public static function valor(string $clave, mixed $porDefecto = null): mixed
    {
        return Cache::rememberForever("ajuste:{$clave}", fn () => self::find($clave)?->valor) ?? $porDefecto;
    }

    public static function guardar(string $clave, mixed $valor): void
    {
        self::updateOrCreate(['clave' => $clave], ['valor' => (string) $valor]);
        Cache::forget("ajuste:{$clave}");
    }

    public static function tarifaDomicilio(): int
    {
        return (int) self::valor(self::TARIFA_DOMICILIO, 0);
    }
}
