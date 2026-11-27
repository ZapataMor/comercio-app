<?php

namespace App\Gestion;

use App\Models\InventarioArticulo;
use App\Models\ModeloProduccion;
use App\Models\Negocio;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Modelos de lo que hace el negocio (Materiales y producción): cada uno con
 * los materiales que gasta una unidad. Son la base de una producción nueva
 * y, si se marcan «con cada pedido», lo que se descuenta del inventario cuando
 * un pedido de sus productos queda listo (ver Etapas::descontarPedido).
 */
final class Modelos
{
    public const MAX_MATERIALES = 40;

    /** ¿El negocio tiene Materiales y producción? */
    public static function activo(Negocio $negocio): bool
    {
        return Gestion::tieneModulo($negocio, 'inventario');
    }

    /**
     * Lo que se gasta para hacer $cantidad del modelo.
     *
     * @return Collection<int, array{articulo: InventarioArticulo, por_unidad: float, total: float, hay: float, falta: float}>
     */
    public static function necesidades(ModeloProduccion $modelo, float $cantidad = 1): Collection
    {
        $materiales = $modelo->relationLoaded('materiales') ? $modelo->materiales : $modelo->materiales()->get();

        return $materiales->map(function (InventarioArticulo $a) use ($cantidad) {
            $total = round((float) $a->pivot->cantidad * $cantidad, 3);

            return [
                'articulo' => $a,
                'por_unidad' => (float) $a->pivot->cantidad,
                'total' => $total,
                'hay' => $a->cantidad,
                'falta' => max(0, round($total - $a->cantidad, 3)),
            ];
        })->values();
    }

    /** ¿Para cuántos alcanza lo que hay? null si no tiene materiales. */
    public static function alcanza(ModeloProduccion $modelo): ?int
    {
        $necesidades = self::necesidades($modelo);
        if ($necesidades->isEmpty()) {
            return null;
        }

        return (int) $necesidades->min(fn ($n) => $n['por_unidad'] > 0 ? floor(($n['hay'] + 0.0005) / $n['por_unidad']) : PHP_INT_MAX);
    }

    /**
     * Costo de los materiales de una unidad.
     *
     * @return array{costo: int, completo: bool}|null null si no tiene materiales
     */
    public static function costo(ModeloProduccion $modelo): ?array
    {
        $necesidades = self::necesidades($modelo);
        if ($necesidades->isEmpty()) {
            return null;
        }

        return [
            'costo' => (int) round($necesidades->sum(fn ($n) => ($n['articulo']->costo ?? 0) * $n['por_unidad'])),
            'completo' => $necesidades->every(fn ($n) => $n['articulo']->costo !== null),
        ];
    }

    /**
     * Crea o cambia un modelo con exactamente estos materiales
     * (articulo_id => cantidad por unidad) y estos productos del catálogo.
     *
     * @param  array{nombre: string, descripcion?: ?string, al_pedido?: bool}  $datos
     * @param  array<int, float>  $filas
     * @param  int[]  $productos
     */
    public static function guardar(Negocio $negocio, ?ModeloProduccion $modelo, array $datos, array $filas, array $productos = []): ModeloProduccion
    {
        if (count($filas) > self::MAX_MATERIALES) {
            throw ValidationException::withMessages(['materiales' => 'Un modelo puede tener hasta '.self::MAX_MATERIALES.' materiales.']);
        }
        self::exigirMateriales($negocio, array_keys($filas));
        $validos = $negocio->productos()->whereIn('id', $productos)->pluck('id')->all();
        if (count($validos) !== count(array_unique($productos))) {
            throw ValidationException::withMessages(['productos' => 'Uno de los productos ya no está en el catálogo. Recarga la página.']);
        }

        return DB::transaction(function () use ($negocio, $modelo, $datos, $filas, $validos) {
            $modelo ??= new ModeloProduccion;
            $modelo->fill([
                'nombre' => trim($datos['nombre']),
                'descripcion' => filled($datos['descripcion'] ?? null) ? trim($datos['descripcion']) : null,
                'al_pedido' => (bool) ($datos['al_pedido'] ?? false),
            ]);
            $modelo->negocio()->associate($negocio);
            $modelo->save();
            $modelo->materiales()->sync(collect($filas)->map(fn ($c) => ['cantidad' => round($c, 3)])->all());
            $negocio->productos()->where('modelo_id', $modelo->id)->whereNotIn('id', $validos)->update(['modelo_id' => null]);
            $negocio->productos()->whereIn('id', $validos)->update(['modelo_id' => $modelo->id]);
            $modelo->unsetRelation('materiales');

            return $modelo;
        });
    }

    /** Lo borra; las producciones y los productos se quedan, sin modelo. */
    public static function eliminar(ModeloProduccion $modelo): void
    {
        $modelo->delete();
    }

    /**
     * Los artículos son del negocio y son materiales (las herramientas no se gastan).
     *
     * @param  int[]  $ids
     */
    public static function exigirMateriales(Negocio $negocio, array $ids): void
    {
        if (! $ids) {
            return;
        }
        $articulos = InventarioArticulo::where('negocio_id', $negocio->id)->whereIn('id', $ids)->get(['id', 'tipo', 'nombre']);
        if ($articulos->count() !== count(array_unique($ids))) {
            throw ValidationException::withMessages(['materiales' => 'Uno de los materiales ya no está en el inventario. Recarga la página.']);
        }
        if ($h = $articulos->first(fn ($a) => $a->esHerramienta())) {
            throw ValidationException::withMessages(['materiales' => '«'.$h->nombre.'» es una herramienta: se usa y no se gasta, así que no va en los materiales.']);
        }
    }
}
