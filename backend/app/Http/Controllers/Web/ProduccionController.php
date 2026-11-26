<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Materiales;
use App\Gestion\Terminados;
use App\Http\Controllers\Controller;
use App\Models\InventarioArticulo;
use App\Models\Negocio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Producción y materiales del panel web (módulo opcional «produccion»):
 * qué gasta cada producto del catálogo, registrar lo que se hizo y su
 * historial. Las reglas viven en App\Gestion\Materiales; el catálogo usa los
 * mismos formularios dentro del modal de cada producto.
 *
 * Ver: quien pueda abrir el módulo. Cambiar y registrar: «produccion.gestionar».
 */
class ProduccionController extends Controller
{
    public function index(Request $request): View
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);

        $conMateriales = $negocio->productos()->whereHas('materiales')
            ->with(['categoria', 'materiales'])->orderBy('nombre')->get();
        // «Definir materiales» de un producto que todavía no tiene: se abre su modal.
        $elegido = $request->integer('producto') ? $negocio->productos()->with(['categoria', 'materiales'])->find($request->integer('producto')) : null;
        $modales = $elegido && ! $conMateriales->contains('id', $elegido->id) ? $conMateriales->concat([$elegido]) : $conMateriales;

        $inicioMes = now()->startOfMonth();
        $delMes = $negocio->producciones()->whereNull('anulada_at')->where('created_at', '>=', $inicioMes);

        return view('negocio.produccion', [
            'productos' => $conMateriales,
            'modales' => $modales,
            'elegido' => $elegido,
            'sinMateriales' => $negocio->productos()->whereDoesntHave('materiales')->orderBy('nombre')->get(['id', 'nombre']),
            'historial' => $negocio->producciones()->with(['usuario', 'pedido', 'movimientos.articulo'])->latest('id')->limit(60)->get(),
            'hechosMes' => (clone $delMes)->sum('cantidad'),
            'costoMes' => (int) (clone $delMes)->sum('costo'),
            'materialesBajos' => $this->materialesBajos($conMateriales),
            'articulosInv' => $this->articulos($negocio),
            'pestana' => $request->query('pestana') === 'historial' ? 'historial' : 'productos',
            'puedeProducir' => $this->puedeProducir($request),
        ]);
    }

    /** Qué materiales gasta una unidad del producto y cuándo se descuentan. */
    public function guardarMateriales(Request $request, int $producto): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeProducir($request), 403, 'No tienes permiso para cambiar los materiales de los productos.');
        $modelo = $negocio->productos()->findOrFail($producto);

        $filas = collect((array) $request->input('materiales', []))->filter(fn ($f) => is_array($f))
            ->map(fn ($f) => ['articulo_id' => $f['articulo_id'] ?? null, 'cantidad' => Inventario::leerNumero($f['cantidad'] ?? null)])
            ->filter(fn ($f) => filled($f['articulo_id']) || filled($f['cantidad']))->values()->all();
        $request->merge(['materiales' => $filas]);
        $datos = $request->validate([
            'materiales_al' => ['required', Rule::in(array_keys(Materiales::MODOS))],
            'materiales' => ['array', 'max:'.Materiales::MAX_MATERIALES],
            'materiales.*.articulo_id' => ['required', 'integer', Rule::exists('inventario_articulos', 'id')->where('negocio_id', $negocio->id)],
            'materiales.*.cantidad' => ['required', 'numeric', 'gt:0', 'max:'.Inventario::MAXIMO],
        ], [
            'materiales.*.articulo_id.required' => 'Elige el material de cada fila (o quita la fila).',
            'materiales.*.articulo_id.exists' => 'Uno de los materiales ya no está en el inventario.',
            'materiales.*.cantidad.required' => 'Escribe cuánto se gasta de cada material.',
            'materiales.*.cantidad.numeric' => 'La cantidad de cada material debe ser un número, por ejemplo 10 o 0,5.',
            'materiales.*.cantidad.gt' => 'La cantidad de cada material debe ser mayor que cero.',
        ], ['materiales_al' => 'cuándo se descuentan']);

        $porArticulo = [];
        foreach ($datos['materiales'] ?? [] as $f) {
            $id = (int) $f['articulo_id'];
            if (isset($porArticulo[$id])) {
                throw ValidationException::withMessages(['materiales' => 'Un material está repetido: deja una sola fila con la cantidad total.']);
            }
            $porArticulo[$id] = (float) $f['cantidad'];
        }
        Materiales::guardar($modelo, $porArticulo, $datos['materiales_al']);

        return redirect()->to(url()->previous())->with('abrir', 'producto-'.$modelo->id)
            ->with('ok', $porArticulo ? 'Se guardaron los materiales de «'.$modelo->nombre.'».' : '«'.$modelo->nombre.'» ya no descuenta materiales.');
    }

    /** «Registrar como hecho»: descuenta los materiales. */
    public function registrar(Request $request, int $producto): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeProducir($request), 403, 'No tienes permiso para registrar lo que se hizo.');
        $modelo = $negocio->productos()->findOrFail($producto);

        $request->merge(['cantidad' => Inventario::leerNumero($request->input('cantidad'))]);
        $datos = $request->validate([
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'nota' => ['nullable', 'string', 'max:255'],
            'destino' => ['required', Rule::in(array_keys(Terminados::DESTINOS))],
        ], [
            'destino.required' => 'Elige qué pasa con lo que se hizo.',
            'cantidad.required' => 'Escribe cuántos se hicieron.',
            'cantidad.numeric' => 'Escribe cuántos se hicieron con números, por ejemplo 2.',
            'cantidad.gt' => 'Escribe cuántos se hicieron.',
        ], ['cantidad' => 'cantidad', 'nota' => 'nota']);

        $produccion = Terminados::registrar($modelo, (float) $datos['cantidad'], $request->user(), $datos['nota'] ?? null, $request->boolean('aunque_falte'), $datos['destino']);
        $aviso = 'Se registró: '.Materiales::texto($produccion->cantidad, $modelo->nombre).'. Los materiales ya se descontaron del inventario.'
            .match ($datos['destino']) {
                'catalogo' => ' Ahora hay '.Terminados::textoExistencias($modelo->fresh()->existencias).' en el catálogo.',
                'espera' => ' Quedó en «En espera» del catálogo para completar sus datos.',
                default => '',
            };
        if ($produccion->faltantes) {
            $aviso .= ' Faltó: '.collect($produccion->faltantes)->map(fn ($f) => InventarioArticulo::numero($f['falto']).' '.InventarioArticulo::nombreUnidad($f['unidad'], $f['falto']).' de «'.$f['nombre'].'»')->join('; ').'.';
        }

        return redirect()->to(url()->previous())->with('abrir', 'producto-'.$modelo->id)->with('ok', $aviso);
    }

    public function anular(Request $request, int $produccion): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeProducir($request), 403, 'No tienes permiso para anular lo que se hizo.');
        $modelo = $negocio->producciones()->findOrFail($produccion);
        Materiales::anular($modelo, $request->user());

        return redirect()->to(url()->previous())->with('ok', 'Se anuló «'.Materiales::texto($modelo->cantidad, $modelo->nombre).'» y los materiales volvieron al inventario.');
    }

    // ------------------------------------------------------------- Apoyo

    /**
     * Artículos del inventario para elegir como material, agrupados por tipo.
     *
     * @return Collection<string, Collection<int, InventarioArticulo>>
     */
    public static function articulos(Negocio $negocio): Collection
    {
        return $negocio->articulosInventario()->orderBy('nombre')->get()
            ->sortBy(fn (InventarioArticulo $a) => array_search($a->tipo, array_keys(InventarioArticulo::TIPOS), true))
            ->groupBy(fn (InventarioArticulo $a) => $a->tipoTexto());
    }

    /** Materiales de las recetas que se están acabando. */
    private function materialesBajos(Collection $productos): Collection
    {
        return $productos->flatMap->materiales->unique('id')->filter(fn (InventarioArticulo $a) => $a->estado() !== 'ok')->values();
    }

    private function verModulo(Request $request): void
    {
        abort_unless(Gestion::puedeVerModulo($request->user(), $this->negocio($request), 'produccion'), 403, 'Producción y materiales no está activo para este negocio o no tienes permiso.');
    }

    private function puedeProducir(Request $request): bool
    {
        return Gestion::puede($request->user(), $this->negocio($request), 'produccion.gestionar');
    }

    private function negocio(Request $request): Negocio
    {
        return $request->attributes->get('negocio_web');
    }
}
