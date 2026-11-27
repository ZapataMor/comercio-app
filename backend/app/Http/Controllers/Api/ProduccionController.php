<?php

namespace App\Http\Controllers\Api;

use App\Gestion\Etapas;
use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Modelos;
use App\Http\Controllers\Controller;
use App\Models\InventarioArticulo;
use App\Models\ModeloProduccion;
use App\Models\Negocio;
use App\Models\Produccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Producción en la app (ADR-005: lo del día a día, lejos del computador):
 * quien está en el taller anota lo que se hará, ajusta sus materiales con
 * − y + y la marca terminada para que se descuenten. Ponerle nombre y
 * publicarla en el catálogo se hace en la web. Reglas en App\Gestion\Etapas.
 *
 * Solo con Materiales y producción encendido y el permiso
 * «produccion.gestionar» (el dueño y el administrador lo tienen siempre).
 */
class ProduccionController extends Controller
{
    /** Lo que está por hacer, los modelos, los materiales para añadir y lo último que se terminó. */
    public function index(Request $request, Negocio $negocio): JsonResponse
    {
        $this->autorizar($request, $negocio);

        $porHacer = $negocio->producciones()->whereNull('anulada_at')->where('estado', Produccion::POR_HACER)
            ->with(['modelo.materiales', 'materiales', 'usuario'])->latest('id')->get();
        $recientes = $negocio->producciones()->where('estado', '!=', Produccion::POR_HACER)->with('usuario')->latest('id')->limit(15)->get();

        return response()->json([
            'por_hacer' => $porHacer->map(fn (Produccion $p) => self::detalle($p))->values(),
            'para_nombrar' => $negocio->producciones()->whereNull('anulada_at')->where('estado', Produccion::TERMINADA)->count(),
            'recientes' => $recientes->map(fn (Produccion $p) => self::resumen($p))->values(),
            'modelos' => $negocio->modelosProduccion()->where('al_pedido', false)->with('materiales')->orderBy('nombre')->get()
                ->map(fn (ModeloProduccion $m) => [
                    'id' => $m->id,
                    'nombre' => $m->nombre,
                    'alcanza' => Modelos::alcanza($m),
                    'materiales' => Modelos::necesidades($m)->map(fn ($n) => $n['articulo']->cantidadTexto($n['por_unidad']).' de '.$n['articulo']->nombre)->values(),
                ])->values(),
            'materiales' => $negocio->articulosInventario()->where('tipo', 'material')->orderBy('nombre')->get()
                ->map(fn (InventarioArticulo $a) => self::material($a))->values(),
        ]);
    }

    /** «Se hará»: de un modelo (con sus materiales) o sin modelo. */
    public function crear(Request $request, Negocio $negocio): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $request->merge(['cantidad' => Inventario::leerNumero($request->input('cantidad') ?? '1')]);
        $datos = $request->validate([
            'modelo_id' => ['nullable', 'integer', Rule::exists('modelos_produccion', 'id')->where('negocio_id', $negocio->id)],
            'nombre' => ['required_without:modelo_id', 'nullable', 'string', 'max:255'],
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:'.Etapas::MAX_CANTIDAD],
            'nota' => ['nullable', 'string', 'max:255'],
        ], [
            'nombre.required_without' => 'Elige un modelo o escribe qué se va a hacer.',
            'cantidad.gt' => 'Escribe cuántos se van a hacer.',
            'cantidad.numeric' => 'Escribe cuántos se van a hacer con números, por ejemplo 2.',
        ]);

        $modelo = isset($datos['modelo_id']) ? $negocio->modelosProduccion()->find($datos['modelo_id']) : null;
        $produccion = Etapas::crear($negocio, $modelo, $datos['nombre'] ?? null, (float) $datos['cantidad'], $request->user(), $datos['nota'] ?? null);

        return response()->json([
            'message' => 'Se anotó «'.Etapas::texto($produccion->cantidad, $produccion->nombre).'».',
            'produccion' => self::detalle($produccion->fresh(['modelo.materiales', 'materiales', 'usuario'])),
        ], 201);
    }

    /**
     * Guarda cantidad y materiales; con terminar=true además descuenta. Si
     * falta material responde 422 con «faltantes» para preguntar si se
     * descuenta lo que haya (aunque_falte).
     */
    public function guardar(Request $request, Negocio $negocio, int $produccion): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $modelo = $negocio->producciones()->findOrFail($produccion);

        $request->merge([
            'cantidad' => Inventario::leerNumero($request->input('cantidad')),
            'materiales' => collect((array) $request->input('materiales', []))->filter(fn ($f) => is_array($f))
                ->map(fn ($f) => ['articulo_id' => $f['articulo_id'] ?? null, 'cantidad' => Inventario::leerNumero($f['cantidad'] ?? 0) ?? 0])->values()->all(),
        ]);
        $datos = $request->validate([
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:'.Etapas::MAX_CANTIDAD],
            'nota' => ['nullable', 'string', 'max:255'],
            'materiales' => ['array', 'max:'.Modelos::MAX_MATERIALES],
            'materiales.*.articulo_id' => ['required', 'integer', 'distinct', Rule::exists('inventario_articulos', 'id')->where('negocio_id', $negocio->id)],
            'materiales.*.cantidad' => ['numeric', 'min:0', 'max:'.Inventario::MAXIMO],
            'terminar' => ['sometimes', 'boolean'],
            'aunque_falte' => ['sometimes', 'boolean'],
        ], [
            'cantidad.required' => 'Escribe cuántos se van a hacer.',
            'cantidad.gt' => 'Escribe cuántos se van a hacer.',
            'materiales.*.articulo_id.distinct' => 'Un material está repetido.',
            'materiales.*.articulo_id.exists' => 'Uno de los materiales ya no está.',
            'materiales.*.cantidad.numeric' => 'La cantidad de cada material debe ser un número.',
        ]);

        $filas = collect($datos['materiales'] ?? [])->mapWithKeys(fn ($f) => [(int) $f['articulo_id'] => (float) $f['cantidad']])->all();
        Etapas::guardar($modelo, (float) $datos['cantidad'], $filas, $datos['nota'] ?? null);

        if (! $request->boolean('terminar')) {
            return response()->json([
                'message' => 'Se guardaron los materiales.',
                'produccion' => self::detalle($modelo->fresh(['modelo.materiales', 'materiales', 'usuario'])),
            ]);
        }

        try {
            Etapas::terminar($modelo, $request->user(), $request->boolean('aunque_falte'));
        } catch (ValidationException $e) {
            $faltantes = $modelo->materiales()->get()
                ->filter(fn ($a) => (float) $a->pivot->cantidad > $a->cantidad + 0.0005)
                ->map(fn ($a) => ['nombre' => $a->nombre, 'falta' => $a->cantidadTexto(round((float) $a->pivot->cantidad - $a->cantidad, 3))])->values();

            return response()->json(['message' => $e->validator->errors()->first(), 'errors' => $e->errors(), 'faltantes' => $faltantes], 422);
        }

        return response()->json([
            'message' => '«'.Etapas::texto($modelo->cantidad, $modelo->nombre).'» quedó terminada y sus materiales se descontaron.'
                .($modelo->faltantes ? ' Faltó: '.Etapas::textoFaltantes($modelo->faltantes).'.' : '')
                .' Ponle nombre en la web para llevarla al catálogo.',
            'produccion' => self::resumen($modelo->load('usuario')),
        ]);
    }

    public function cancelar(Request $request, Negocio $negocio, int $produccion): JsonResponse
    {
        $this->autorizar($request, $negocio);
        $modelo = $negocio->producciones()->findOrFail($produccion);
        Etapas::cancelar($modelo);

        return response()->json(['message' => 'Se canceló «'.$modelo->nombre.'».']);
    }

    // ------------------------------------------------------------- Apoyo

    /** @return array<string, mixed> */
    private static function material(InventarioArticulo $a): array
    {
        return [
            'id' => $a->id,
            'nombre' => $a->nombre,
            'rasgos' => $a->rasgosTexto(),
            'hay' => $a->cantidad,
            'unidad_uno' => InventarioArticulo::nombreUnidad($a->unidad, 1),
            'unidad_varios' => InventarioArticulo::nombreUnidad($a->unidad, 2),
        ];
    }

    /** Una producción por hacer con sus materiales (lo que se usa y lo normal). @return array<string, mixed> */
    private static function detalle(Produccion $p): array
    {
        $porUnidad = $p->modelo ? Modelos::necesidades($p->modelo)->mapWithKeys(fn ($n) => [$n['articulo']->id => $n['por_unidad']]) : collect();

        return [
            ...self::resumen($p),
            'modelo' => $p->modelo ? ['id' => $p->modelo->id, 'nombre' => $p->modelo->nombre] : null,
            'materiales' => $p->materiales->map(fn (InventarioArticulo $a) => [
                ...self::material($a),
                'cantidad' => (float) $a->pivot->cantidad,
                'normal' => $a->pivot->normal !== null ? (float) $a->pivot->normal : null,
                'por_unidad' => $porUnidad->get($a->id),
            ])->values(),
        ];
    }

    /** @return array<string, mixed> */
    private static function resumen(Produccion $p): array
    {
        return [
            'id' => $p->id,
            'nombre' => $p->nombre,
            'cantidad' => $p->cantidad,
            'texto' => Etapas::texto($p->cantidad, $p->nombre),
            'estado' => $p->estado,
            'estado_texto' => $p->estadoTexto(),
            'origen' => $p->origen,
            'quien' => $p->usuario?->name,
            'nota' => $p->nota,
            'anulada' => $p->anulada(),
            'falto' => (bool) $p->faltantes,
            'fecha' => ($p->terminada_at ?? $p->created_at)?->toIso8601String(),
        ];
    }

    private function autorizar(Request $request, Negocio $negocio): void
    {
        $user = $request->user();
        abort_unless($negocio->esMiembroActivo($user), 403, 'No tienes acceso a este negocio.');
        abort_unless(Modelos::activo($negocio) && Gestion::puede($user, $negocio, 'produccion.gestionar'), 403, 'No tienes permiso para registrar lo que se hace en este negocio.');
    }
}
