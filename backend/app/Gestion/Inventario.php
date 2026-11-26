<?php

namespace App\Gestion;

use App\Models\InventarioArticulo;
use App\Models\InventarioMovimiento;
use App\Models\Negocio;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Reglas del inventario: la existencia de un artículo solo cambia con un
 * movimiento, y cada movimiento guarda el saldo que dejó.
 */
final class Inventario
{
    /** Máximo que se puede tener de un artículo (cabe en decimal(14,3)). */
    public const MAXIMO = 99999999999;

    /**
     * Registra una entrada, salida o ajuste y devuelve el movimiento.
     * - entrada: suma, salida: resta (no deja la existencia en negativo),
     * - ajuste: la existencia pasa a ser lo que se contó.
     */
    public static function mover(InventarioArticulo $articulo, string $tipo, float $cantidad, ?User $quien = null, ?string $nota = null, ?int $produccionId = null): InventarioMovimiento
    {
        if (! isset(InventarioMovimiento::TIPOS[$tipo])) {
            throw ValidationException::withMessages(['tipo' => 'Elige si es una entrada, una salida o un ajuste.']);
        }
        $cantidad = round($cantidad, 3);
        if ($cantidad < 0 || ($tipo !== 'ajuste' && $cantidad <= 0)) {
            throw ValidationException::withMessages(['cantidad' => $tipo === 'ajuste' ? 'La cantidad contada no puede ser negativa.' : 'Escribe una cantidad mayor que cero.']);
        }

        return DB::transaction(function () use ($articulo, $tipo, $cantidad, $quien, $nota, $produccionId) {
            $actual = InventarioArticulo::whereKey($articulo->id)->lockForUpdate()->firstOrFail();
            $saldo = match ($tipo) {
                'entrada' => $actual->cantidad + $cantidad,
                'salida' => $actual->cantidad - $cantidad,
                'ajuste' => $cantidad,
            };
            $saldo = round($saldo, 3);
            if ($saldo < 0) {
                throw ValidationException::withMessages(['cantidad' => 'No puede salir más de lo que hay: quedan '.$actual->cantidadTexto().'.']);
            }
            if ($saldo > self::MAXIMO) {
                throw ValidationException::withMessages(['cantidad' => 'Esa cantidad es demasiado grande.']);
            }

            $actual->forceFill(['cantidad' => $saldo])->save();
            $articulo->setRawAttributes($actual->getAttributes(), true);

            return $actual->movimientos()->create([
                'user_id' => $quien?->id,
                'tipo' => $tipo,
                'cantidad' => $cantidad,
                'saldo' => $saldo,
                'nota' => filled($nota) ? trim($nota) : null,
                'produccion_id' => $produccionId,
            ]);
        });
    }

    /**
     * Nombres de características para sugerir: primero los que ya usa el
     * negocio (los más usados arriba), luego los de siempre; con los valores
     * que ya ha escrito para cada uno.
     *
     * @return array{nombres: string[], valores: array<string, string[]>}
     */
    public static function sugerencias(Negocio $negocio): array
    {
        $uso = [];
        $valores = [];
        $negocio->articulosInventario()->whereNotNull('caracteristicas')->pluck('caracteristicas')
            ->each(function ($lista) use (&$uso, &$valores) {
                foreach ((array) (is_string($lista) ? json_decode($lista, true) : $lista) as $c) {
                    $nombre = trim((string) ($c['nombre'] ?? ''));
                    $valor = trim((string) ($c['valor'] ?? ''));
                    if ($nombre === '' || $valor === '') {
                        continue;
                    }
                    $clave = mb_strtolower($nombre);
                    $uso[$clave] = ($uso[$clave] ?? ['nombre' => $nombre, 'veces' => 0]);
                    $uso[$clave]['veces']++;
                    $valores[$clave][mb_strtolower($valor)] = $valor;
                }
            });
        uasort($uso, fn ($a, $b) => $b['veces'] <=> $a['veces'] ?: strcasecmp($a['nombre'], $b['nombre']));

        $nombres = array_column($uso, 'nombre');
        foreach (InventarioArticulo::CARACTERISTICAS_SUGERIDAS as $nombre) {
            if (! isset($uso[mb_strtolower($nombre)])) {
                $nombres[] = $nombre;
            }
        }
        $porNombre = [];
        foreach ($valores as $clave => $lista) {
            natcasesort($lista);
            $porNombre[$uso[$clave]['nombre']] = array_values(array_slice($lista, 0, 40));
        }

        return ['nombres' => $nombres, 'valores' => $porNombre];
    }

    /**
     * «2,5» o «2.5» → 2.5; «1.250,5» → 1250.5. Devuelve el texto tal cual si no
     * parece un número, para que la validación lo rechace con su mensaje.
     */
    public static function leerNumero(mixed $texto): mixed
    {
        if (! is_string($texto)) {
            return $texto;
        }
        $limpio = str_replace([' ', "\u{00A0}"], '', trim($texto));
        if ($limpio === '') {
            return null;
        }
        if (str_contains($limpio, ',')) {
            $limpio = str_replace(',', '.', str_replace('.', '', $limpio));
        } elseif (substr_count($limpio, '.') > 1) {
            $limpio = str_replace('.', '', $limpio);
        }

        return is_numeric($limpio) ? $limpio : $texto;
    }
}
