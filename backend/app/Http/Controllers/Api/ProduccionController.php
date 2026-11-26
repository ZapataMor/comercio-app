<?php

namespace App\Http\Controllers\Api;

use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Materiales;
use App\Gestion\Terminados;
use App\Http\Controllers\Controller;
use App\Models\InventarioArticulo;
use App\Models\Negocio;
use App\Models\Produccion;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Producción en la app (ADR-005: lo del día a día, lejos del computador):
 * quien está en la fábrica registra que hizo algo desde el teléfono y se
 * descuentan los materiales. Qué gasta cada producto se define en la web.
 *
 * Solo con el módulo «produccion» encendido y el permiso «produccion.gestionar»
 * (el dueño y el administrador del negocio lo tienen siempre).
 */
class ProduccionController extends Controller
{
    /** Productos con materiales (cuántos alcanzan) y lo último que se registró. */
    public function index(Request $request, Negocio $negocio): JsonResponse
    {
        $this->autorizar($request, $negocio);

        $productos = $negocio->productos()->whereHas('materiales')->with('materiales')->orderBy('nombre')->get();
        $recientes = $negocio->producciones()->with('usuario')->latest('id')->limit(15)->get();

        return response()->json([
            'productos' => $productos->map(fn (Producto $p) => self::producto($p))->values(),
            'recientes' => $recientes->map(fn (Produccion $p) => self::produccion($p))->values(),
            'en_espera' => $negocio->productosEnEspera()->where('estado', 'en_espera')->count(),
            'destinos' => collect(Terminados::DESTINOS)->map(fn ($t, $k) => ['valor' => $k, 'texto' => $t, 'ayuda' => Terminados::DESTINOS_AYUDA[$k]])->values(),
        ]);
    }

    /** «Registrar como hecho». Si falta material responde 422 con lo que falta (y faltantes). */
    public function registrar(Request $request, Negocio $negocio, int $producto): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $modelo = $negocio->productos()->findOrFail($producto);

        $request->merge(['cantidad' => Inventario::leerNumero($request->input('cantidad'))]);
        $datos = $request->validate([
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'nota' => ['nullable', 'string', 'max:255'],
            'destino' => ['required', Rule::in(array_keys(Terminados::DESTINOS))],
            'aunque_falte' => ['sometimes', 'boolean'],
        ], [
            'cantidad.required' => 'Escribe cuántos se hicieron.',
            'cantidad.numeric' => 'Escribe cuántos se hicieron con números, por ejemplo 2.',
            'cantidad.gt' => 'Escribe cuántos se hicieron.',
            'destino.required' => 'Elige qué pasa con lo que se hizo.',
        ]);

        try {
            $produccion = Terminados::registrar($modelo, (float) $datos['cantidad'], $request->user(), $datos['nota'] ?? null, $request->boolean('aunque_falte'), $datos['destino']);
        } catch (ValidationException $e) {
            // Con lo que falta, para que la app pregunte si descuenta lo que haya.
            $faltantes = Materiales::necesidades($modelo, (float) $datos['cantidad'])->filter(fn ($n) => $n['falta'] > 0)
                ->map(fn ($n) => ['nombre' => $n['articulo']->nombre, 'falta' => $n['articulo']->cantidadTexto($n['falta'])])->values();

            return response()->json(['message' => $e->validator->errors()->first(), 'errors' => $e->errors(), 'faltantes' => $faltantes], 422);
        }

        $mensaje = 'Se registró: '.Materiales::texto($produccion->cantidad, $modelo->nombre).'. Los materiales ya se descontaron.'
            .match ($datos['destino']) {
                'catalogo' => ' Ahora hay '.Terminados::textoExistencias($modelo->fresh()->existencias).'.',
                'espera' => ' Quedó «En espera» para completar sus datos en la web.',
                default => '',
            };

        return response()->json([
            'message' => $mensaje,
            'produccion' => self::produccion($produccion->load('usuario')),
            'producto' => self::producto($modelo->fresh()->load('materiales')),
        ]);
    }

    // ------------------------------------------------------------- Apoyo

    /** @return array<string, mixed> */
    private static function producto(Producto $p): array
    {
        return [
            'id' => $p->id,
            'nombre' => $p->nombre,
            'imagen' => $p->imagen ? '/storage/'.ltrim(preg_replace('#^/?storage/#', '', $p->imagen), '/') : null,
            'precio' => (int) $p->precio,
            'existencias' => $p->existencias,
            'modo' => $p->materiales_al,
            'alcanza' => Materiales::alcanza($p),
            'materiales' => Materiales::necesidades($p)->map(fn ($n) => [
                'id' => $n['articulo']->id,
                'nombre' => $n['articulo']->nombre,
                'rasgos' => $n['articulo']->rasgosTexto(),
                'por_unidad' => $n['por_unidad'],
                'hay' => $n['hay'],
                'unidad_uno' => InventarioArticulo::nombreUnidad($n['articulo']->unidad, 1),
                'unidad_varios' => InventarioArticulo::nombreUnidad($n['articulo']->unidad, 2),
            ])->values(),
        ];
    }

    /** @return array<string, mixed> */
    private static function produccion(Produccion $p): array
    {
        return [
            'id' => $p->id,
            'nombre' => $p->nombre,
            'cantidad' => $p->cantidad,
            'texto' => Materiales::texto($p->cantidad, $p->nombre),
            'origen' => $p->origen,
            'destino' => $p->destino,
            'quien' => $p->usuario?->name,
            'nota' => $p->nota,
            'anulada' => $p->anulada(),
            'falto' => (bool) $p->faltantes,
            'fecha' => $p->created_at?->toIso8601String(),
        ];
    }

    private function autorizar(Request $request, Negocio $negocio): void
    {
        $user = $request->user();
        abort_unless($negocio->esMiembroActivo($user), 403, 'No tienes acceso a este negocio.');
        abort_unless(Materiales::activo($negocio) && Gestion::puede($user, $negocio, 'produccion.gestionar'), 403, 'No tienes permiso para registrar lo que se hace en este negocio.');
    }
}
