<?php

namespace App\Gestion;

use App\Models\InventarioArticulo;
use App\Models\Produccion;
use App\Models\Producto;
use App\Models\ProductoEnEspera;
use App\Models\User;
use App\Support\FotoOptimizada;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Lo que se fabrica llega al catálogo. Al registrar que se hizo algo se
 * elige su destino:
 *
 * - catalogo: igual al producto del catálogo; se suma a sus existencias y
 *   queda disponible.
 * - espera: salió con medidas, color o acabado puntuales; queda «En espera»
 *   hasta que alguien complete sus datos y lo publique (como producto nuevo
 *   o sumándolo a uno que ya existe).
 * - pedido: era de un pedido o un encargo; no va al catálogo (los pedidos
 *   de Vitrina siempre quedan así).
 */
final class Terminados
{
    public const DESTINOS = [
        'catalogo' => 'Sumar al catálogo',
        'espera' => 'Dejar en espera',
        'pedido' => 'Es de un pedido o encargo',
    ];

    public const DESTINOS_AYUDA = [
        'catalogo' => 'Salió igual al producto: se suma a lo que hay para vender.',
        'espera' => 'Salió con medidas, color o acabado propios: completa sus datos antes de publicarlo.',
        'pedido' => 'Ya tiene dueño: no aparece en el catálogo.',
    ];

    /** Registra que se hizo, descuenta los materiales y lo lleva a su destino. */
    public static function registrar(Producto $producto, float $cantidad, ?User $quien, ?string $nota, bool $aunqueFalte, string $destino): Produccion
    {
        if (! isset(self::DESTINOS[$destino])) {
            throw ValidationException::withMessages(['destino' => 'Elige qué pasa con lo que se hizo.']);
        }

        return DB::transaction(function () use ($producto, $cantidad, $quien, $nota, $aunqueFalte, $destino) {
            $produccion = Materiales::registrar($producto, $cantidad, $quien, $nota, $aunqueFalte);
            $produccion->forceFill(['destino' => $destino])->save();

            if ($destino === 'catalogo') {
                self::sumar($producto, $cantidad);
            } elseif ($destino === 'espera') {
                $producto->negocio->productosEnEspera()->create([
                    'producto_id' => $producto->id,
                    'produccion_id' => $produccion->id,
                    'sede_id' => $quien ? $producto->negocio->miembros()->whereKey($quien->id)->first()?->pivot->sede_id : null,
                    'user_id' => $quien?->id,
                    'cantidad' => round($cantidad, 3),
                    'nombre' => $producto->nombre,
                    'descripcion' => $producto->descripcion,
                    'precio' => (int) $producto->precio ?: null,
                ]);
            }

            return $produccion;
        });
    }

    /** Se anuló la producción: quita lo que había sumado o dejado en espera. */
    public static function revertir(Produccion $produccion): void
    {
        if ($produccion->destino === 'catalogo' && $produccion->producto) {
            $p = Producto::withTrashed()->lockForUpdate()->find($produccion->producto_id);
            if ($p && $p->existencias !== null) {
                $p->forceFill(['existencias' => max(0, round($p->existencias - $produccion->cantidad, 3))])->save();
            }
        } elseif ($produccion->destino === 'espera') {
            ProductoEnEspera::where('produccion_id', $produccion->id)->where('estado', ProductoEnEspera::EN_ESPERA)->delete();
        }
    }

    /** Guarda los datos mientras sigue en espera. */
    public static function guardar(ProductoEnEspera $espera, array $datos, ?UploadedFile $imagen = null, bool $quitarImagen = false): ProductoEnEspera
    {
        self::exigirEnEspera($espera);
        $anterior = $espera->imagen;
        $espera->fill([
            'nombre' => $datos['nombre'],
            'descripcion' => $datos['descripcion'] ?? null,
            'precio' => $datos['precio'] ?? null,
            'especificaciones' => $datos['especificaciones'] ?: null,
        ]);
        if ($imagen) {
            $espera->imagen = FotoOptimizada::guardarEn($imagen, 'productos');
        } elseif ($quitarImagen) {
            $espera->imagen = null;
        }
        $espera->save();
        if ($anterior && $anterior !== $espera->imagen) {
            Storage::disk('public')->delete($anterior);
        }

        return $espera;
    }

    /**
     * Lo lleva al catálogo:
     * - nuevo: un producto nuevo con sus especificaciones (copia la sección,
     *   el tipo, las categorías y los materiales del producto de partida),
     * - sumar: es igual al producto de partida; se suma a sus existencias.
     */
    public static function publicar(ProductoEnEspera $espera, string $modo): Producto
    {
        self::exigirEnEspera($espera);
        $base = $espera->producto;
        if ($modo === 'sumar' && (! $base || $base->trashed())) {
            throw ValidationException::withMessages(['modo' => 'El producto de partida ya no está en el catálogo: publícalo como producto nuevo.']);
        }
        if ($modo === 'nuevo' && ! $espera->precio) {
            throw ValidationException::withMessages(['precio' => 'Ponle precio antes de publicarlo.']);
        }

        return DB::transaction(function () use ($espera, $modo, $base) {
            if ($modo === 'sumar') {
                $destino = self::sumar($base, $espera->cantidad);
            } else {
                $destino = $espera->negocio->productos()->create([
                    'nombre' => $espera->nombre,
                    'descripcion' => $espera->descripcion,
                    'precio' => $espera->precio,
                    'tipo_venta' => $base->tipo_venta ?? 'cantidad',
                    'unidad_medida' => $base->unidad_medida ?? 'unidad',
                    'disponible' => true,
                    'categoria_id' => $base?->categoria_id,
                    'tipo_producto_id' => $base?->tipo_producto_id,
                    'atributos' => collect($espera->listaEspecificaciones())->map(fn ($c) => $c['nombre'].': '.$c['valor'])->take(30)->values()->all(),
                ]);
                $destino->forceFill([
                    'existencias' => round($espera->cantidad, 3),
                    'imagen' => self::copiarImagen($espera->imagen ?: $base?->imagen),
                    'materiales_al' => $base->materiales_al ?? 'fabricar',
                ])->save();
                if ($base) {
                    $destino->categoriasCatalogo()->sync($base->categoriasCatalogo()->pluck('categorias_catalogo.id'));
                    $destino->materiales()->sync($base->materiales()->get()->mapWithKeys(fn ($m) => [$m->id => ['cantidad' => $m->pivot->cantidad]])->all());
                }
            }
            $espera->forceFill(['estado' => ProductoEnEspera::PUBLICADO, 'publicado_en' => $destino->id, 'publicado_at' => now()])->save();

            return $destino;
        });
    }

    public static function descartar(ProductoEnEspera $espera): void
    {
        self::exigirEnEspera($espera);
        $espera->forceFill(['estado' => ProductoEnEspera::DESCARTADO])->save();
    }

    /** «3 en stock», «1,5 en stock» */
    public static function textoExistencias(?float $existencias): ?string
    {
        return $existencias === null ? null : InventarioArticulo::numero($existencias).' en stock';
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

    private static function exigirEnEspera(ProductoEnEspera $espera): void
    {
        if ($espera->estado !== ProductoEnEspera::EN_ESPERA) {
            throw ValidationException::withMessages(['espera' => 'Ya no está en espera: alguien lo publicó o lo descartó.']);
        }
    }
}
