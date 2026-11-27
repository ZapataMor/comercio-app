<?php

namespace App\Gestion;

use App\Models\InventarioArticulo;
use App\Models\ModeloProduccion;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Produccion;
use App\Models\Producto;
use App\Models\User;
use App\Support\FotoOptimizada;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * La producción por etapas (Materiales y producción):
 *
 * 1. Por hacer: se dice qué se hará (de un modelo o sin modelo). Aparecen los
 *    materiales predeterminados del modelo; se ajustan con − y + y se añaden
 *    otros. Todavía no se descuenta nada.
 * 2. Terminada: al marcarla terminada se descuentan del inventario. Si falta
 *    material no se termina, salvo que se pida «descontar lo que haya».
 *    Falta ponerle nombre, precio y foto: al publicarla entra al catálogo
 *    como producto nuevo o se suma a uno que ya existe. Si era para alguien,
 *    queda como encargo y no va al catálogo.
 *
 * Aparte, los modelos «con cada pedido» (restaurantes) descuentan sus
 * materiales cuando un pedido de Vitrina queda listo, sin pasar por etapas.
 */
final class Etapas
{
    public const MAX_CANTIDAD = 100000;

    // ------------------------------------------------------------ Etapa 1

    /** «Se hará»: crea la producción con los materiales del modelo. */
    public static function crear(Negocio $negocio, ?ModeloProduccion $modelo, ?string $nombre, float $cantidad, ?User $quien, ?string $nota = null): Produccion
    {
        $nombre = trim((string) $nombre) ?: $modelo?->nombre;
        if (! $nombre) {
            throw ValidationException::withMessages(['nombre' => 'Elige un modelo o escribe qué se va a hacer.']);
        }
        self::exigirCantidad($cantidad);

        return DB::transaction(function () use ($negocio, $modelo, $nombre, $cantidad, $quien, $nota) {
            $produccion = $negocio->producciones()->create([
                'modelo_id' => $modelo?->id,
                'nombre' => mb_substr($nombre, 0, 255),
                'cantidad' => round($cantidad, 3),
                'origen' => 'manual',
                'estado' => Produccion::POR_HACER,
                'user_id' => $quien?->id,
                'sede_id' => $quien ? $negocio->miembros()->whereKey($quien->id)->first()?->pivot->sede_id : null,
                'nota' => filled($nota) ? trim($nota) : null,
            ]);
            if ($modelo) {
                $produccion->materiales()->sync(Modelos::necesidades($modelo, $cantidad)
                    ->mapWithKeys(fn ($n) => [$n['articulo']->id => ['cantidad' => $n['total'], 'normal' => $n['total']]])->all());
            }

            return $produccion;
        });
    }

    /**
     * Guarda cuántos se hacen y los materiales (articulo_id => cantidad total).
     * Los del modelo se quedan aunque bajen a cero (se ve que no se usaron);
     * los que se añadieron aparte y quedan en cero se quitan.
     *
     * @param  array<int, float>  $filas
     */
    public static function guardar(Produccion $produccion, float $cantidad, array $filas, ?string $nota = null): Produccion
    {
        self::exigirEstado($produccion, Produccion::POR_HACER, 'Esta producción ya no está por hacer.');
        self::exigirCantidad($cantidad);
        if (count($filas) > Modelos::MAX_MATERIALES) {
            throw ValidationException::withMessages(['materiales' => 'Una producción puede tener hasta '.Modelos::MAX_MATERIALES.' materiales.']);
        }
        Modelos::exigirMateriales($produccion->negocio, array_keys($filas));

        $normales = $produccion->modelo ? Modelos::necesidades($produccion->modelo, $cantidad)->mapWithKeys(fn ($n) => [$n['articulo']->id => $n['total']]) : collect();
        $sync = [];
        foreach ($filas as $id => $c) {
            $c = max(0, round((float) $c, 3));
            if ($c > Inventario::MAXIMO) {
                throw ValidationException::withMessages(['materiales' => 'Una de las cantidades es demasiado grande.']);
            }
            if ($c > 0 || $normales->has($id)) {
                $sync[$id] = ['cantidad' => $c, 'normal' => $normales->get($id)];
            }
        }

        DB::transaction(function () use ($produccion, $cantidad, $sync, $nota) {
            $produccion->forceFill(['cantidad' => round($cantidad, 3), 'nota' => filled($nota) ? trim($nota) : null])->save();
            $produccion->materiales()->sync($sync);
        });
        $produccion->unsetRelation('materiales');

        return $produccion;
    }

    /** Ya se hizo: descuenta los materiales y pasa a ponerle nombre. */
    public static function terminar(Produccion $produccion, ?User $quien, bool $aunqueFalte = false): Produccion
    {
        self::exigirEstado($produccion, Produccion::POR_HACER, 'Esta producción ya se había terminado.');

        return DB::transaction(function () use ($produccion, $quien, $aunqueFalte) {
            $actual = Produccion::whereKey($produccion->id)->lockForUpdate()->firstOrFail();
            self::exigirEstado($actual, Produccion::POR_HACER, 'Esta producción ya se había terminado.');
            $materiales = $actual->materiales()->get()->filter(fn ($m) => (float) $m->pivot->cantidad > 0);
            [$salidas, $faltantes, $costo] = self::calcularSalidas($materiales->mapWithKeys(fn ($m) => [$m->id => (float) $m->pivot->cantidad])->all());

            if ($faltantes && ! $aunqueFalte) {
                throw ValidationException::withMessages(['materiales' => 'No alcanza el material. Faltan: '.self::textoFaltantes($faltantes).'. Registra primero la entrada, baja la cantidad o marca «descontar lo que haya».']);
            }

            $actual->forceFill([
                'estado' => Produccion::TERMINADA,
                'terminada_at' => now(),
                'faltantes' => $faltantes ?: null,
                'costo' => $costo,
            ])->save();
            $motivo = 'Se hizo: '.self::texto($actual->cantidad, $actual->nombre);
            foreach ($salidas as [$articulo, $sale]) {
                if ($sale > 0) {
                    Inventario::mover($articulo, 'salida', $sale, $quien, $motivo, $actual->id);
                }
            }
            $produccion->setRawAttributes($actual->getAttributes(), true);

            return $produccion;
        });
    }

    /** Se arrepintieron antes de hacerla: no se había descontado nada. */
    public static function cancelar(Produccion $produccion): void
    {
        self::exigirEstado($produccion, Produccion::POR_HACER, 'Ya se terminó: anúlala para devolver los materiales.');
        $produccion->delete();
    }

    // ------------------------------------------------------------ Etapa 2

    /** Guarda nombre, precio, foto y especificaciones antes de publicarla. */
    public static function guardarDatos(Produccion $produccion, array $datos, ?UploadedFile $imagen = null, bool $quitarImagen = false): Produccion
    {
        self::exigirEstado($produccion, Produccion::TERMINADA, 'Ya no está esperando su nombre: alguien la publicó o la anuló.');
        $anterior = $produccion->imagen;
        $produccion->fill([
            'nombre' => $datos['nombre'],
            'descripcion' => $datos['descripcion'] ?? null,
            'precio' => $datos['precio'] ?? null,
            'categoria_id' => $datos['categoria_id'] ?? null,
            'especificaciones' => ($datos['especificaciones'] ?? []) ?: null,
        ]);
        if ($imagen) {
            $produccion->imagen = FotoOptimizada::guardarEn($imagen, 'productos');
        } elseif ($quitarImagen) {
            $produccion->imagen = null;
        }
        $produccion->save();
        if ($anterior && $anterior !== $produccion->imagen) {
            Storage::disk('public')->delete($anterior);
        }

        return $produccion;
    }

    /**
     * La lleva al catálogo:
     * - nuevo: un producto nuevo con su nombre, precio, foto y especificaciones,
     *   hecho con el modelo de la producción y con sus unidades en stock,
     * - sumar: es igual a $destino, que ya está en el catálogo; se suma a lo
     *   que hay para vender.
     */
    public static function publicar(Produccion $produccion, string $modo, ?Producto $destino = null): Producto
    {
        self::exigirEstado($produccion, Produccion::TERMINADA, 'Ya no está esperando su nombre: alguien la publicó o la anuló.');
        if ($modo === 'sumar' && (! $destino || $destino->negocio_id !== $produccion->negocio_id)) {
            throw ValidationException::withMessages(['producto_id' => 'Elige el producto del catálogo al que se suma.']);
        }
        if ($modo === 'nuevo' && ! $produccion->precio) {
            throw ValidationException::withMessages(['precio' => 'Ponle precio antes de publicarlo.']);
        }
        if (! in_array($modo, ['nuevo', 'sumar'], true)) {
            throw ValidationException::withMessages(['modo' => 'Elige cómo entra al catálogo.']);
        }

        return DB::transaction(function () use ($produccion, $modo, $destino) {
            if ($modo === 'sumar') {
                $producto = self::sumar($destino, $produccion->cantidad);
                if (! $producto->modelo_id && $produccion->modelo_id) {
                    $producto->forceFill(['modelo_id' => $produccion->modelo_id])->save();
                }
            } else {
                $producto = $produccion->negocio->productos()->create([
                    'nombre' => $produccion->nombre,
                    'descripcion' => $produccion->descripcion,
                    'precio' => $produccion->precio,
                    'tipo_venta' => 'cantidad',
                    'unidad_medida' => 'unidad',
                    'disponible' => true,
                    'categoria_id' => $produccion->categoria_id,
                    'atributos' => collect($produccion->listaEspecificaciones())->map(fn ($c) => $c['nombre'].': '.$c['valor'])->take(30)->values()->all(),
                ]);
                $producto->forceFill([
                    'existencias' => round($produccion->cantidad, 3),
                    'imagen' => self::copiarImagen($produccion->imagen),
                    'modelo_id' => $produccion->modelo_id,
                ])->save();
            }
            $produccion->forceFill(['estado' => Produccion::PUBLICADA, 'producto_id' => $producto->id, 'publicada_at' => now()])->save();

            return $producto;
        });
    }

    /** Era para alguien: no va al catálogo. */
    public static function encargo(Produccion $produccion): void
    {
        self::exigirEstado($produccion, Produccion::TERMINADA, 'Ya no está esperando su nombre: alguien la publicó o la anuló.');
        $produccion->forceFill(['estado' => Produccion::ENCARGO])->save();
    }

    /** Se registró por error: devuelve los materiales y quita lo que sumó al catálogo. */
    public static function anular(Produccion $produccion, ?User $quien): void
    {
        if ($produccion->anulada()) {
            throw ValidationException::withMessages(['produccion' => 'Esa producción ya estaba anulada.']);
        }
        if ($produccion->estado === Produccion::POR_HACER) {
            throw ValidationException::withMessages(['produccion' => 'Todavía no se ha descontado nada: cancélala.']);
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
            if ($actual->estado === Produccion::PUBLICADA && $actual->producto_id) {
                $p = Producto::withTrashed()->lockForUpdate()->find($actual->producto_id);
                if ($p && $p->existencias !== null) {
                    $p->forceFill(['existencias' => max(0, round($p->existencias - $actual->cantidad, 3))])->save();
                }
            }
            $actual->forceFill(['anulada_at' => now(), 'anulada_por' => $quien?->id])->save();
            $produccion->setRawAttributes($actual->getAttributes(), true);
        });
    }

    // ------------------------------------------------- Con cada pedido

    /**
     * Un pedido quedó listo: descuenta los materiales de sus productos con
     * modelo «con cada pedido». Una sola vez por pedido; nunca lo frena:
     * descuenta lo que haya y anota lo que faltó.
     *
     * @return Collection<int, Produccion>
     */
    public static function descontarPedido(Pedido $pedido): Collection
    {
        $negocio = $pedido->negocio;
        if (! $negocio || ! Modelos::activo($negocio) || Produccion::where('pedido_id', $pedido->id)->exists()) {
            return collect();
        }
        $lineas = $pedido->items()->with(['producto' => fn ($q) => $q->withTrashed()->with('modelo.materiales')])->get()
            ->filter(fn ($i) => $i->producto?->modelo && $i->producto->modelo->al_pedido && $i->producto->modelo->materiales->isNotEmpty());

        return $lineas->groupBy('producto_id')->map(function ($items) use ($pedido, $negocio) {
            $producto = $items->first()->producto;
            $cantidad = round((float) $items->sum('cantidad'), 3);

            return DB::transaction(function () use ($producto, $cantidad, $pedido, $negocio) {
                $filas = Modelos::necesidades($producto->modelo, $cantidad)->mapWithKeys(fn ($n) => [$n['articulo']->id => $n['total']])->all();
                [$salidas, $faltantes, $costo] = self::calcularSalidas($filas);
                $nota = 'Pedido '.($pedido->codigo ?? '#'.$pedido->id);
                $produccion = $negocio->producciones()->create([
                    'modelo_id' => $producto->modelo_id,
                    'producto_id' => $producto->id,
                    'nombre' => $producto->nombre,
                    'cantidad' => $cantidad,
                    'origen' => 'pedido',
                    'estado' => Produccion::PEDIDO,
                    'pedido_id' => $pedido->id,
                    'nota' => $nota,
                    'faltantes' => $faltantes ?: null,
                    'costo' => $costo,
                ]);
                $produccion->forceFill(['terminada_at' => now()])->save();
                foreach ($salidas as [$articulo, $sale]) {
                    if ($sale > 0) {
                        Inventario::mover($articulo, 'salida', $sale, null, $nota.': '.self::texto($cantidad, $producto->nombre), $produccion->id);
                    }
                }

                return $produccion;
            });
        })->values();
    }

    // ------------------------------------------------------------- Apoyo

    /** «2 × Reja» */
    public static function texto(float $cantidad, string $nombre): string
    {
        return InventarioArticulo::numero($cantidad).' × '.$nombre;
    }

    /** «3 en stock», «1,5 en stock» */
    public static function textoExistencias(?float $existencias): ?string
    {
        return $existencias === null ? null : InventarioArticulo::numero($existencias).' en stock';
    }

    /** «2 láminas de «Lámina lisa»; 0,5 galones de «Pintura»» */
    public static function textoFaltantes(array $faltantes): string
    {
        return collect($faltantes)->map(fn ($f) => InventarioArticulo::numero($f['falto']).' '.InventarioArticulo::nombreUnidad($f['unidad'], $f['falto']).' de «'.$f['nombre'].'»')->join('; ');
    }

    /**
     * Bloquea los artículos y calcula qué sale de cada uno (lo que haya, sin
     * pasar de lo pedido), lo que falta y el costo.
     *
     * @param  array<int, float>  $filas  articulo_id => cantidad
     * @return array{0: array<int, array{0: InventarioArticulo, 1: float}>, 1: array<int, array<string, mixed>>, 2: int}
     */
    private static function calcularSalidas(array $filas): array
    {
        $articulos = InventarioArticulo::whereIn('id', array_keys($filas))->lockForUpdate()->get()->keyBy('id');
        $salidas = [];
        $faltantes = [];
        $costo = 0;
        foreach ($filas as $id => $total) {
            $articulo = $articulos[$id] ?? null;
            if (! $articulo) {
                continue;
            }
            $total = round($total, 3);
            $sale = min($total, max(0, $articulo->cantidad));
            if ($total - $sale > 0.0005) {
                $faltantes[] = ['articulo_id' => $articulo->id, 'nombre' => $articulo->nombre, 'falto' => round($total - $sale, 3), 'unidad' => $articulo->unidad];
            }
            $costo += ($articulo->costo ?? 0) * $total;
            $salidas[] = [$articulo, $sale];
        }

        return [$salidas, $faltantes, (int) round($costo)];
    }

    private static function exigirCantidad(float $cantidad): void
    {
        if ($cantidad <= 0 || $cantidad > self::MAX_CANTIDAD) {
            throw ValidationException::withMessages(['cantidad' => 'Escribe cuántos se van a hacer.']);
        }
    }

    private static function exigirEstado(Produccion $produccion, string $estado, string $mensaje): void
    {
        if ($produccion->estado !== $estado || $produccion->anulada()) {
            throw ValidationException::withMessages(['produccion' => $mensaje]);
        }
    }

    private static function sumar(Producto $producto, float $cantidad): Producto
    {
        $p = Producto::lockForUpdate()->findOrFail($producto->id);
        $p->forceFill(['existencias' => round(($p->existencias ?? 0) + $cantidad, 3), 'disponible' => true])->save();
        $producto->setRawAttributes($p->getAttributes(), true);

        return $p;
    }

    /** El producto nuevo tiene su propia copia de la foto (si cambian una, no se borra la otra). */
    private static function copiarImagen(?string $ruta): ?string
    {
        $disco = Storage::disk('public');
        if (! $ruta || ! $disco->exists($ruta)) {
            return null;
        }
        $nueva = 'productos/'.Str::random(32).'.'.(pathinfo($ruta, PATHINFO_EXTENSION) ?: 'jpg');
        $disco->copy($ruta, $nueva);

        return $nueva;
    }
}
