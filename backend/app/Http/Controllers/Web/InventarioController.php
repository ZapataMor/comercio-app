<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Http\Controllers\Controller;
use App\Models\InventarioArticulo;
use App\Models\InventarioMovimiento;
use App\Models\Negocio;
use App\Support\FotoOptimizada;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Inventario del panel web (módulo opcional «inventario»). Guarda cualquier
 * cosa del negocio —materia prima, insumos, productos, herramientas— en
 * tarjetas, con características libres (calibre, color, talla, sabor…), su
 * unidad (unidades, kilos, metros, láminas…), existencia, mínimo para la
 * alerta, costo y proveedor. La existencia cambia con entradas, salidas y
 * ajustes por conteo, que quedan en el historial del artículo.
 *
 * Ver: cualquiera que pueda abrir el módulo. Cambiar: «inventario.editar»
 * (el dueño y el administrador del negocio lo tienen siempre).
 */
class InventarioController extends Controller
{
    public const POR_PAGINA = 48;

    public function index(Request $request): View
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);

        $tipo = array_key_exists((string) $request->query('tipo'), InventarioArticulo::TIPOS) ? $request->query('tipo') : null;
        $buscar = trim((string) $request->query('buscar'));
        $categoria = trim((string) $request->query('categoria'));
        $estado = in_array($request->query('estado'), ['bajos', 'agotados'], true) ? $request->query('estado') : null;
        $sedes = $negocio->sedes()->where('activa', true)->orderByDesc('principal')->orderBy('nombre')->get();
        $sede = $sedes->count() > 1 ? $sedes->firstWhere('id', (int) $request->query('sede')) : null;

        $base = $negocio->articulosInventario();
        $articulos = (clone $base)->with(['sede', 'movimientos' => fn ($q) => $q->with('usuario')->latest('id')->limit(8)])
            ->when($tipo, fn ($q) => $q->where('tipo', $tipo))
            ->when($categoria !== '', fn ($q) => $q->where('categoria', $categoria))
            ->when($sede, fn ($q) => $q->where('sede_id', $sede->id))
            ->when($estado === 'agotados', fn ($q) => $q->where('cantidad', '<=', 0))
            ->when($estado === 'bajos', fn ($q) => $q->where(fn ($w) => $w->where('cantidad', '<=', 0)->orWhere(fn ($m) => $m->whereNotNull('minimo')->whereColumn('cantidad', '<=', 'minimo'))))
            ->when($buscar !== '', function ($q) use ($buscar) {
                $como = '%'.addcslashes($buscar, '%_\\').'%';
                $q->where(fn ($w) => $w->where('nombre', 'like', $como)->orWhere('referencia', 'like', $como)
                    ->orWhere('categoria', 'like', $como)->orWhere('proveedor', 'like', $como)->orWhere('caracteristicas', 'like', $como));
            })
            ->orderBy('nombre')
            ->paginate(self::POR_PAGINA)->withQueryString();

        $todos = (clone $base)->get(['id', 'tipo', 'categoria', 'proveedor', 'cantidad', 'minimo', 'costo']);

        return view('negocio.inventario', [
            'articulos' => $articulos,
            'total' => $todos->count(),
            'porTipo' => $todos->countBy('tipo'),
            'bajos' => $todos->filter(fn (InventarioArticulo $a) => $a->estado() !== 'ok')->count(),
            'valorTotal' => $todos->sum(fn (InventarioArticulo $a) => $a->valor() ?? 0),
            'conCosto' => $todos->whereNotNull('costo')->count(),
            'categorias' => $todos->pluck('categoria')->filter()->unique()->sort(SORT_NATURAL | SORT_FLAG_CASE)->values(),
            'proveedores' => $todos->pluck('proveedor')->filter()->unique()->sort(SORT_NATURAL | SORT_FLAG_CASE)->values(),
            'tipo' => $tipo,
            'buscar' => $buscar,
            'categoria' => $categoria,
            'estado' => $estado,
            'sedes' => $sedes,
            'sedeFiltro' => $sede,
            'sugerencias' => Inventario::sugerencias($negocio),
            'puedeEditar' => $this->puedeEditar($request),
        ]);
    }

    public function guardar(Request $request, ?int $articulo = null): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeEditar($request), 403, 'No tienes permiso para cambiar el inventario.');
        $modelo = $articulo ? $negocio->articulosInventario()->findOrFail($articulo) : null;

        $request->merge([
            'cantidad' => Inventario::leerNumero($request->input('cantidad')),
            'minimo' => Inventario::leerNumero($request->input('minimo')),
            'costo' => filled($request->input('costo')) ? preg_replace('/\D/', '', (string) $request->input('costo')) : null,
        ]);
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:150'],
            'tipo' => ['required', Rule::in(array_keys(InventarioArticulo::TIPOS))],
            'unidad' => ['required', Rule::in(array_keys(InventarioArticulo::UNIDADES))],
            'categoria' => ['nullable', 'string', 'max:80'],
            'referencia' => ['nullable', 'string', 'max:60'],
            'descripcion' => ['nullable', 'string', 'max:3000'],
            'proveedor' => ['nullable', 'string', 'max:120'],
            'cantidad' => [$modelo ? 'nullable' : 'required', 'numeric', 'min:0', 'max:'.Inventario::MAXIMO],
            'minimo' => ['nullable', 'numeric', 'min:0', 'max:'.Inventario::MAXIMO],
            'costo' => ['nullable', 'integer', 'min:0', 'max:9999999999'],
            'sede_id' => ['nullable', 'integer', Rule::exists('sedes', 'id')->where('negocio_id', $negocio->id)->where('activa', true)],
            'imagen' => ['nullable', 'image', 'max:4096'],
            'quitar_imagen' => ['boolean'],
            'caracteristicas' => ['array', 'max:'.(InventarioArticulo::MAX_CARACTERISTICAS + 10)],
            'caracteristicas.*.nombre' => ['nullable', 'string', 'max:40'],
            'caracteristicas.*.valor' => ['nullable', 'string', 'max:80'],
        ], [
            'cantidad.required' => 'Escribe cuánto hay ahora (0 si todavía no hay).',
            'cantidad.numeric' => 'La cantidad debe ser un número, por ejemplo 12 o 2,5.',
            'minimo.numeric' => 'El mínimo debe ser un número, por ejemplo 5 o 1,5.',
            'sede_id.exists' => 'Elige una sede activa del negocio.',
        ], [
            'nombre' => 'nombre', 'tipo' => 'tipo', 'unidad' => 'unidad', 'categoria' => 'categoría',
            'referencia' => 'referencia', 'descripcion' => 'descripción', 'proveedor' => 'proveedor',
            'cantidad' => 'cantidad', 'minimo' => 'mínimo', 'costo' => 'costo', 'imagen' => 'imagen',
            'caracteristicas.*.nombre' => 'nombre de la característica', 'caracteristicas.*.valor' => 'valor de la característica',
        ]);

        $caracteristicas = $this->caracteristicas($datos['caracteristicas'] ?? []);
        $campos = [
            'nombre' => trim($datos['nombre']),
            'tipo' => $datos['tipo'],
            'unidad' => $datos['unidad'],
            'categoria' => $this->texto($datos['categoria'] ?? null),
            'referencia' => $this->texto($datos['referencia'] ?? null),
            'descripcion' => $this->texto($datos['descripcion'] ?? null),
            'proveedor' => $this->texto($datos['proveedor'] ?? null),
            'minimo' => isset($datos['minimo']) ? round((float) $datos['minimo'], 3) : null,
            'costo' => isset($datos['costo']) && $datos['costo'] !== '' ? (int) $datos['costo'] : null,
            'caracteristicas' => $caracteristicas ?: null,
        ];
        // Con una sola sede no se pregunta: todo queda en esa.
        if ($request->has('sede_id')) {
            $campos['sede_id'] = $datos['sede_id'] ?? null;
        }

        $anterior = $modelo?->imagen;
        if ($request->hasFile('imagen')) {
            $campos['imagen'] = FotoOptimizada::guardarEn($request->file('imagen'), 'inventario');
        } elseif ($modelo && $request->boolean('quitar_imagen')) {
            $campos['imagen'] = null;
        }

        $modelo = DB::transaction(function () use ($negocio, $modelo, $campos, $datos, $request) {
            if ($modelo) {
                $modelo->update($campos);

                return $modelo;
            }
            $nuevo = $negocio->articulosInventario()->create($campos);
            $inicial = round((float) $datos['cantidad'], 3);
            if ($inicial > 0) {
                Inventario::mover($nuevo, 'entrada', $inicial, $request->user(), 'Existencia inicial');
            }

            return $nuevo;
        });
        if ($anterior && $anterior !== $modelo->imagen) {
            Storage::disk('public')->delete($anterior);
        }

        return redirect()->to(url()->previous())->with('ok', 'Se guardó «'.$modelo->nombre.'».');
    }

    public function mover(Request $request, int $articulo): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeEditar($request), 403, 'No tienes permiso para registrar movimientos.');
        $modelo = $negocio->articulosInventario()->findOrFail($articulo);

        $request->merge(['cantidad' => Inventario::leerNumero($request->input('cantidad'))]);
        $datos = $request->validate([
            'tipo' => ['required', Rule::in(array_keys(InventarioMovimiento::TIPOS))],
            'cantidad' => ['required', 'numeric', 'min:0', 'max:'.Inventario::MAXIMO],
            'nota' => ['nullable', 'string', 'max:255'],
        ], [
            'cantidad.required' => 'Escribe la cantidad.',
            'cantidad.numeric' => 'La cantidad debe ser un número, por ejemplo 12 o 2,5.',
        ], ['tipo' => 'movimiento', 'cantidad' => 'cantidad', 'nota' => 'nota']);

        $movimiento = Inventario::mover($modelo, $datos['tipo'], (float) $datos['cantidad'], $request->user(), $datos['nota'] ?? null);
        $hecho = match ($movimiento->tipo) {
            'entrada' => 'Entraron '.$modelo->cantidadTexto($movimiento->cantidad),
            'salida' => 'Salieron '.$modelo->cantidadTexto($movimiento->cantidad),
            default => 'Se ajustó la existencia',
        };

        return redirect()->to(url()->previous())->with('ok', $hecho.' de «'.$modelo->nombre.'». Ahora hay '.$modelo->cantidadTexto().'.');
    }

    public function eliminar(Request $request, int $articulo): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeEditar($request), 403, 'No tienes permiso para cambiar el inventario.');
        $modelo = $negocio->articulosInventario()->findOrFail($articulo);
        $imagen = $modelo->imagen;
        $modelo->delete();
        if ($imagen) {
            Storage::disk('public')->delete($imagen);
        }

        return redirect()->to(url()->previous())->with('ok', 'Se eliminó «'.$modelo->nombre.'» del inventario.');
    }

    // ------------------------------------------------------------- Apoyo

    /**
     * Filas del formulario → [['nombre', 'valor']]: sin vacías, sin nombres
     * repetidos (gana la primera) y con el nombre escrito como la primera vez.
     *
     * @return array<int, array{nombre: string, valor: string}>
     */
    private function caracteristicas(array $filas): array
    {
        $lista = [];
        foreach ($filas as $fila) {
            $nombre = preg_replace('/\s+/u', ' ', trim((string) ($fila['nombre'] ?? '')));
            $valor = preg_replace('/\s+/u', ' ', trim((string) ($fila['valor'] ?? '')));
            if ($nombre === '' || $valor === '') {
                continue;
            }
            $clave = mb_strtolower($nombre);
            if (! isset($lista[$clave])) {
                $lista[$clave] = ['nombre' => mb_strtoupper(mb_substr($nombre, 0, 1)).mb_substr($nombre, 1), 'valor' => $valor];
            }
        }

        return array_slice(array_values($lista), 0, InventarioArticulo::MAX_CARACTERISTICAS);
    }

    private function texto(?string $valor): ?string
    {
        return filled($valor) ? trim($valor) : null;
    }

    private function verModulo(Request $request): void
    {
        abort_unless(Gestion::puedeVerModulo($request->user(), $this->negocio($request), 'inventario'), 403, 'El inventario no está activo para este negocio o no tienes permiso.');
    }

    private function puedeEditar(Request $request): bool
    {
        return Gestion::puede($request->user(), $this->negocio($request), 'inventario.editar');
    }

    private function negocio(Request $request): Negocio
    {
        return $request->attributes->get('negocio_web');
    }
}
