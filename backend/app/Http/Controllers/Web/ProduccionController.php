<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Etapas;
use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Modelos;
use App\Http\Controllers\Controller;
use App\Models\InventarioArticulo;
use App\Models\Negocio;
use App\Models\Produccion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Producción por etapas del panel web (módulo «inventario», Materiales y
 * producción). Las reglas viven en App\Gestion\Etapas.
 *
 * 1. Por hacer: de un modelo (con sus materiales predeterminados) o sin
 *    modelo; los materiales se ajustan con − y + y se añaden otros.
 * 2. Ponerle nombre: ya se descontaron; con nombre, precio y foto entra al
 *    catálogo (o queda como encargo).
 *
 * Ver: quien pueda abrir el módulo. Etapa 1, anular y encargo:
 * «produccion.gestionar». Publicar en el catálogo: además, poder cambiar el
 * catálogo («modificar_inventario»), como cualquier producto.
 */
class ProduccionController extends Controller
{
    public function index(Request $request): View
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);

        $abiertas = $negocio->producciones()->whereNull('anulada_at');
        $inicioMes = now()->startOfMonth();
        $delMes = $negocio->producciones()->whereNull('anulada_at')->whereNotIn('estado', [Produccion::POR_HACER])->where('terminada_at', '>=', $inicioMes);

        return view('negocio.produccion', [
            'porHacer' => (clone $abiertas)->where('estado', Produccion::POR_HACER)->with(['modelo', 'materiales', 'usuario', 'sede'])->latest('id')->get(),
            'terminadas' => (clone $abiertas)->where('estado', Produccion::TERMINADA)->with(['modelo', 'usuario', 'sede', 'categoria', 'movimientos.articulo'])->latest('terminada_at')->get(),
            'historial' => $negocio->producciones()->where(fn ($q) => $q->whereIn('estado', [Produccion::PUBLICADA, Produccion::ENCARGO, Produccion::PEDIDO])->orWhereNotNull('anulada_at'))
                ->with(['usuario', 'pedido', 'producto', 'movimientos.articulo'])->latest('id')->limit(60)->get(),
            'modelos' => $negocio->modelosProduccion()->with('materiales')->orderBy('nombre')->get(),
            'articulosInv' => self::materiales($negocio),
            'categorias' => $negocio->categorias()->orderBy('nombre')->get(['id', 'nombre']),
            'productosCatalogo' => $negocio->productos()->orderBy('nombre')->get(['id', 'nombre', 'existencias']),
            // Especificaciones con que arranca la etapa 2: la ficha técnica de la plantilla.
            'campos' => $negocio->plantillaGestion?->campos_producto ?? [],
            'hechosMes' => (float) (clone $delMes)->sum('cantidad'),
            'costoMes' => (int) (clone $delMes)->sum('costo'),
            'cuentas' => InventarioController::cuentas($negocio),
            'pestana' => $request->query('pestana') === 'historial' ? 'historial' : 'proceso',
            'puedeProducir' => $this->puedeProducir($request),
            'puedePublicar' => $this->puedePublicar($request),
        ]);
    }

    /** «Se hará»: de un modelo o sin modelo. */
    public function crear(Request $request): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->exigirProducir($request);

        $request->merge(['cantidad' => Inventario::leerNumero($request->input('cantidad') ?? '1')]);
        $datos = $request->validate([
            'modelo_id' => ['nullable', 'integer', Rule::exists('modelos_produccion', 'id')->where('negocio_id', $negocio->id)],
            'nombre' => ['required_without:modelo_id', 'nullable', 'string', 'max:255'],
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:'.Etapas::MAX_CANTIDAD],
            'nota' => ['nullable', 'string', 'max:255'],
        ], [
            'nombre.required_without' => 'Elige un modelo o escribe qué se va a hacer.',
            'modelo_id.exists' => 'Ese modelo ya no existe. Recarga la página.',
            'cantidad.gt' => 'Escribe cuántos se van a hacer.',
            'cantidad.numeric' => 'Escribe cuántos se van a hacer con números, por ejemplo 2.',
        ], ['cantidad' => 'cantidad', 'nombre' => 'qué se va a hacer']);

        $modelo = isset($datos['modelo_id']) ? $negocio->modelosProduccion()->find($datos['modelo_id']) : null;
        $produccion = Etapas::crear($negocio, $modelo, $datos['nombre'] ?? null, (float) $datos['cantidad'], $request->user(), $datos['nota'] ?? null);

        return redirect()->route('negocio.inventario.produccion')->with('abrir', 'produccion-'.$produccion->id)
            ->with('ok', 'Se anotó «'.Etapas::texto($produccion->cantidad, $produccion->nombre).'». Ajusta sus materiales y márcala terminada cuando esté lista.');
    }

    /** Etapa 1: cantidad y materiales; con accion=terminar, además descuenta y pasa a ponerle nombre. */
    public function guardar(Request $request, int $produccion): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->exigirProducir($request);
        $modelo = $negocio->producciones()->findOrFail($produccion);

        $filas = collect((array) $request->input('materiales', []))->filter(fn ($f) => is_array($f))
            ->map(fn ($f) => ['articulo_id' => $f['articulo_id'] ?? null, 'cantidad' => Inventario::leerNumero($f['cantidad'] ?? null) ?? 0])
            ->filter(fn ($f) => filled($f['articulo_id']))->values()->all();
        $request->merge(['materiales' => $filas, 'cantidad' => Inventario::leerNumero($request->input('cantidad'))]);
        $datos = $request->validate([
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:'.Etapas::MAX_CANTIDAD],
            'nota' => ['nullable', 'string', 'max:255'],
            'accion' => ['required', Rule::in(['guardar', 'terminar'])],
            'materiales' => ['array', 'max:'.Modelos::MAX_MATERIALES],
            'materiales.*.articulo_id' => ['required', 'integer', Rule::exists('inventario_articulos', 'id')->where('negocio_id', $negocio->id)],
            'materiales.*.cantidad' => ['numeric', 'min:0', 'max:'.Inventario::MAXIMO],
        ], [
            'cantidad.required' => 'Escribe cuántos se van a hacer.',
            'cantidad.gt' => 'Escribe cuántos se van a hacer.',
            'cantidad.numeric' => 'Escribe cuántos se van a hacer con números, por ejemplo 2.',
            'materiales.*.articulo_id.exists' => 'Uno de los materiales ya no está. Recarga la página.',
            'materiales.*.cantidad.numeric' => 'La cantidad de cada material debe ser un número, por ejemplo 6 o 0,5.',
            'materiales.*.cantidad.min' => 'La cantidad de un material no puede ser negativa.',
        ], ['cantidad' => 'cantidad', 'nota' => 'nota']);

        $porArticulo = [];
        foreach ($datos['materiales'] ?? [] as $f) {
            $id = (int) $f['articulo_id'];
            if (isset($porArticulo[$id])) {
                throw ValidationException::withMessages(['materiales' => 'Un material está repetido: deja una sola fila con la cantidad total.']);
            }
            $porArticulo[$id] = (float) $f['cantidad'];
        }
        Etapas::guardar($modelo, (float) $datos['cantidad'], $porArticulo, $datos['nota'] ?? null);

        if ($datos['accion'] === 'terminar') {
            Etapas::terminar($modelo, $request->user(), $request->boolean('aunque_falte'));
            $aviso = '«'.Etapas::texto($modelo->cantidad, $modelo->nombre).'» quedó terminada y sus materiales se descontaron.'
                .($modelo->faltantes ? ' Faltó: '.Etapas::textoFaltantes($modelo->faltantes).'.' : '')
                .' Ahora ponle nombre para llevarla al catálogo.';

            return redirect()->route('negocio.inventario.produccion')->with('abrir', 'produccion-'.$modelo->id)->with('ok', $aviso);
        }

        return redirect()->route('negocio.inventario.produccion')->with('ok', 'Se guardaron los materiales de «'.$modelo->nombre.'».');
    }

    public function cancelar(Request $request, int $produccion): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->exigirProducir($request);
        $modelo = $negocio->producciones()->findOrFail($produccion);
        Etapas::cancelar($modelo);

        return redirect()->route('negocio.inventario.produccion')->with('ok', 'Se canceló «'.$modelo->nombre.'». No se había descontado nada.');
    }

    /**
     * Etapa 2: nombre, precio, foto y especificaciones. accion = guardar |
     * publicar (modo nuevo: producto nuevo; sumar: a uno que ya está) | encargo.
     */
    public function nombrar(Request $request, int $produccion): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        $modelo = $negocio->producciones()->findOrFail($produccion);

        if ($request->input('accion') === 'encargo') {
            $this->exigirProducir($request);
            Etapas::encargo($modelo);

            return redirect()->route('negocio.inventario.produccion')->with('ok', '«'.$modelo->nombre.'» quedó como encargo: no va al catálogo.');
        }
        abort_unless($this->puedePublicar($request), 403, 'Solo quien puede cambiar el catálogo le pone nombre y lo publica.');

        $request->merge(['precio' => filled($request->input('precio')) ? preg_replace('/\D/', '', (string) $request->input('precio')) : null]);
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'precio' => ['nullable', 'integer', 'min:1', 'max:999999999'],
            'descripcion' => ['nullable', 'string', 'max:5000'],
            'categoria_id' => ['nullable', 'integer', Rule::exists('categorias', 'id')->where('negocio_id', $negocio->id)],
            'imagen' => ['nullable', 'image', 'max:4096'],
            'quitar_imagen' => ['boolean'],
            'especificaciones' => ['array', 'max:30'],
            'especificaciones.*.nombre' => ['nullable', 'string', 'max:40'],
            'especificaciones.*.valor' => ['nullable', 'string', 'max:80'],
            'accion' => ['required', Rule::in(['guardar', 'publicar'])],
            'modo' => ['required_if:accion,publicar', 'nullable', Rule::in(['nuevo', 'sumar'])],
            'producto_id' => ['required_if:modo,sumar', 'nullable', 'integer', Rule::exists('productos', 'id')->where('negocio_id', $negocio->id)->whereNull('deleted_at')],
        ], [
            'modo.required_if' => 'Elige cómo entra al catálogo.',
            'producto_id.required_if' => 'Elige el producto del catálogo al que se suma.',
            'categoria_id.exists' => 'Elige una sección del catálogo.',
        ], [
            'nombre' => 'nombre', 'precio' => 'precio', 'descripcion' => 'descripción', 'imagen' => 'foto', 'categoria_id' => 'sección',
            'especificaciones.*.nombre' => 'nombre de la especificación', 'especificaciones.*.valor' => 'valor de la especificación',
        ]);

        $especificaciones = collect($datos['especificaciones'] ?? [])
            ->map(fn ($f) => ['nombre' => trim((string) ($f['nombre'] ?? '')), 'valor' => trim((string) ($f['valor'] ?? ''))])
            ->filter(fn ($f) => $f['nombre'] !== '' && $f['valor'] !== '')
            ->unique(fn ($f) => mb_strtolower($f['nombre']))->values()->all();

        Etapas::guardarDatos($modelo, [
            'nombre' => trim($datos['nombre']),
            'descripcion' => filled($datos['descripcion'] ?? null) ? trim($datos['descripcion']) : null,
            'precio' => isset($datos['precio']) ? (int) $datos['precio'] : null,
            'categoria_id' => $datos['categoria_id'] ?? null,
            'especificaciones' => $especificaciones,
        ], $request->file('imagen'), $request->boolean('quitar_imagen'));

        if ($datos['accion'] === 'guardar') {
            return redirect()->route('negocio.inventario.produccion')->with('ok', 'Se guardaron los datos de «'.$modelo->nombre.'».');
        }
        $destino = $datos['modo'] === 'sumar' ? $negocio->productos()->find($datos['producto_id']) : null;
        $producto = Etapas::publicar($modelo->fresh(), $datos['modo'], $destino);

        return redirect()->route('negocio.inventario.produccion')
            ->with('ok', '«'.$producto->nombre.'» ya está en el catálogo con '.Etapas::textoExistencias($producto->existencias).'.');
    }

    public function anular(Request $request, int $produccion): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->exigirProducir($request);
        $modelo = $negocio->producciones()->findOrFail($produccion);
        Etapas::anular($modelo, $request->user());

        return redirect()->to(url()->previous())->with('ok', 'Se anuló «'.Etapas::texto($modelo->cantidad, $modelo->nombre).'» y los materiales volvieron al inventario.');
    }

    // ------------------------------------------------------------- Apoyo

    /**
     * Materiales (no herramientas) para elegir, agrupados por categoría.
     *
     * @return Collection<string, Collection<int, InventarioArticulo>>
     */
    public static function materiales(Negocio $negocio): Collection
    {
        return $negocio->articulosInventario()->where('tipo', 'material')->orderBy('categoria')->orderBy('nombre')->get()
            ->groupBy(fn (InventarioArticulo $a) => $a->categoria ?: 'Sin categoría');
    }

    private function verModulo(Request $request): void
    {
        abort_unless(Gestion::puedeVerModulo($request->user(), $this->negocio($request), 'inventario'), 403, 'Materiales y producción no está activo para este negocio o no tienes permiso.');
    }

    private function exigirProducir(Request $request): void
    {
        $this->verModulo($request);
        abort_unless($this->puedeProducir($request), 403, 'No tienes permiso para registrar lo que se hace.');
    }

    private function puedeProducir(Request $request): bool
    {
        return Gestion::puede($request->user(), $this->negocio($request), 'produccion.gestionar');
    }

    private function puedePublicar(Request $request): bool
    {
        return $this->negocio($request)->puede($request->user(), 'modificar_inventario');
    }

    private function negocio(Request $request): Negocio
    {
        return $request->attributes->get('negocio_web');
    }
}
