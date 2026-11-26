<?php

namespace App\Gestion;

use App\Models\InventarioArticulo;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Produccion;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Producción y materiales: lo que gasta cada producto del catálogo y su
 * descuento del inventario.
 *
 * - «fabricar» (talleres, panaderías que hornean temprano): se descuenta al
 *   registrar que se hizo. Si no alcanza, no se registra salvo que se pida
 *   «descontar lo que haya».
 * - «pedido» (restaurantes): se descuenta cuando un pedido de Vitrina queda
 *   listo; nunca frena el pedido: descuenta lo que haya y anota lo que faltó.
 *   No se devuelve si después se cancela: lo preparado ya gastó el material.
 */
final class Materiales
{
    public const MODOS = [
        'fabricar' => 'Al registrar que se hizo',
        'pedido' => 'Con cada pedido de Vitrina',
    ];

    public const MODOS_AYUDA = [
        'fabricar' => 'Para lo que se fabrica y se guarda: portones, puertas, muebles, panes del día…',
        'pedido' => 'Para lo que se prepara al pedirlo: platos, jugos, arreglos… Se descuenta cuando el pedido queda listo.',
    ];

    public const MAX_MATERIALES = 40;

    /** ¿El negocio usa este módulo? */
    public static function activo(Negocio $negocio): bool
    {
        return Gestion::tieneModulo($negocio, 'produccion');
    }

    /**
     * Lo que se gasta para hacer $cantidad del producto.
     *
     * @return Collection<int, array{articulo: InventarioArticulo, por_unidad: float, total: float, hay: float, falta: float}>
     */
    public static function necesidades(Producto $producto, float $cantidad = 1): Collection
    {
        $materiales = $producto->relationLoaded('materiales') ? $producto->materiales : $producto->materiales()->get();

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
    public static function alcanza(Producto $producto): ?int
    {
        $necesidades = self::necesidades($producto);
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
    public static function costo(Producto $producto): ?array
    {
        $necesidades = self::necesidades($producto);
        if ($necesidades->isEmpty()) {
            return null;
        }

        return [
            'costo' => (int) round($necesidades->sum(fn ($n) => ($n['articulo']->costo ?? 0) * $n['por_unidad'])),
            'completo' => $necesidades->every(fn ($n) => $n['articulo']->costo !== null),
        ];
    }

    /**
     * Deja exactamente estos materiales (articulo_id => cantidad por unidad).
     *
     * @param  array<int, float>  $filas
     */
    public static function guardar(Producto $producto, array $filas, string $modo): void
    {
        if (! isset(self::MODOS[$modo])) {
            throw ValidationException::withMessages(['materiales_al' => 'Elige cuándo se descuentan los materiales.']);
        }
        $validos = InventarioArticulo::where('negocio_id', $producto->negocio_id)->whereIn('id', array_keys($filas))->pluck('id')->all();
        if (count($validos) !== count($filas)) {
            throw ValidationException::withMessages(['materiales' => 'Uno de los materiales ya no está en el inventario. Recarga la página.']);
        }

        DB::transaction(function () use ($producto, $filas, $modo) {
            $producto->materiales()->sync(collect($filas)->map(fn ($c) => ['cantidad' => round($c, 3)])->all());
            $producto->forceFill(['materiales_al' => $modo])->saveQuietly();
        });
        $producto->unsetRelation('materiales');
    }

    /**
     * «Registrar como hecho»: descuenta los materiales de $cantidad unidades.
     * Si falta algo, no hace nada (ValidationException con lo que falta)
     * salvo con $aunqueFalte: entonces descuenta lo que haya y lo anota.
     */
    public static function registrar(Producto $producto, float $cantidad, ?User $quien, ?string $nota = null, bool $aunqueFalte = false): Produccion
    {
        if ($cantidad <= 0) {
            throw ValidationException::withMessages(['cantidad' => 'Escribe cuántos se hicieron.']);
        }

        return self::hacer($producto, $cantidad, 'manual', $quien, $nota, $aunqueFalte);
    }

    /**
     * Un pedido quedó listo: descuenta los materiales de los productos que se
     * descuentan «con cada pedido». Solo una vez por pedido.
     *
     * @return Collection<int, Produccion>
     */
    public static function descontarPedido(Pedido $pedido): Collection
    {
        $negocio = $pedido->negocio;
        if (! $negocio || ! self::activo($negocio) || Produccion::where('pedido_id', $pedido->id)->exists()) {
            return collect();
        }
        $lineas = $pedido->items()->with(['producto' => fn ($q) => $q->withTrashed()->with('materiales')])->get()
            ->filter(fn ($i) => $i->producto && $i->producto->materiales_al === 'pedido' && $i->producto->materiales->isNotEmpty());

        return $lineas->groupBy('producto_id')->map(function ($items) use ($pedido) {
            $producto = $items->first()->producto;
            $cantidad = (float) $items->sum('cantidad');

            return self::hacer($producto, $cantidad, 'pedido', null, 'Pedido '.($pedido->codigo ?? '#'.$pedido->id), true, $pedido->id);
        })->values();
    }

    /** Se registró por error: devuelve al inventario lo que se descontó. */
    public static function anular(Produccion $produccion, ?User $quien): void
    {
        if ($produccion->anulada()) {
            throw ValidationException::withMessages(['produccion' => 'Esa producción ya estaba anulada.']);
        }

        DB::transaction(function () use ($produccion, $quien) {
            $actual = Produccion::whereKey($produccion->id)->lockForUpdate()->firstOrFail();
            if ($actual->anulada()) {
                return;
            }
            foreach ($actual->movimientos()->where('tipo', 'salida')->with('articulo')->get() as $m) {
                if ($m->articulo) {
                    Inventario::mover($m->articulo, 'entrada', $m->cantidad, $quien, 'Se anuló: '.self::texto($actual->cantidad, $actual->nombre), $actual->id);
                }
            }
            $actual->forceFill(['anulada_at' => now(), 'anulada_por' => $quien?->id])->save();
            $produccion->setRawAttributes($actual->getAttributes(), true);
        });
    }

    /** «2 × Portón» */
    public static function texto(float $cantidad, string $nombre): string
    {
        return InventarioArticulo::numero($cantidad).' × '.$nombre;
    }

    private static function hacer(Producto $producto, float $cantidad, string $origen, ?User $quien, ?string $nota, bool $aunqueFalte, ?int $pedidoId = null): Produccion
    {
        $cantidad = round($cantidad, 3);

        return DB::transaction(function () use ($producto, $cantidad, $origen, $quien, $nota, $aunqueFalte, $pedidoId) {
            $materiales = $producto->materiales()->get();
            if ($materiales->isEmpty()) {
                throw ValidationException::withMessages(['cantidad' => 'Primero di qué materiales gasta «'.$producto->nombre.'».']);
            }
            // Bloquea los artículos para que dos registros a la vez no descuenten de más.
            $articulos = InventarioArticulo::whereIn('id', $materiales->pluck('id'))->lockForUpdate()->get()->keyBy('id');

            $faltantes = [];
            $costo = 0;
            $salidas = [];
            foreach ($materiales as $m) {
                $articulo = $articulos[$m->id];
                $total = round((float) $m->pivot->cantidad * $cantidad, 3);
                $sale = min($total, max(0, $articulo->cantidad));
                if ($total - $sale > 0.0005) {
                    $faltantes[] = ['articulo_id' => $articulo->id, 'nombre' => $articulo->nombre, 'falto' => round($total - $sale, 3), 'unidad' => $articulo->unidad];
                }
                $costo += ($articulo->costo ?? 0) * $total;
                $salidas[] = [$articulo, $sale];
            }

            if ($faltantes && ! $aunqueFalte) {
                $lista = collect($faltantes)->map(fn ($f) => $articulos[$f['articulo_id']]->cantidadTexto($f['falto']).' de «'.$f['nombre'].'»')->join('; ');
                throw ValidationException::withMessages(['cantidad' => 'No alcanza el material. Faltan: '.$lista.'. Registra primero la entrada o marca «descontar lo que haya».']);
            }

            $produccion = $producto->negocio->producciones()->create([
                'producto_id' => $producto->id,
                'nombre' => $producto->nombre,
                'cantidad' => $cantidad,
                'origen' => $origen,
                'pedido_id' => $pedidoId,
                'user_id' => $quien?->id,
                'nota' => filled($nota) ? trim($nota) : null,
                'faltantes' => $faltantes ?: null,
                'costo' => (int) round($costo),
            ]);
            $motivo = ($origen === 'pedido' ? $produccion->nota.': ' : 'Se hizo: ').self::texto($cantidad, $producto->nombre);
            foreach ($salidas as [$articulo, $sale]) {
                if ($sale > 0) {
                    Inventario::mover($articulo, 'salida', $sale, $quien, $motivo, $produccion->id);
                }
            }

            return $produccion;
        });
    }
}
