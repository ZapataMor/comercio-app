<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Modelos;
use App\Http\Controllers\Controller;
use App\Models\Negocio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Modelos de Materiales y producción: la base de lo que hace el negocio con
 * los materiales que gasta una unidad (una reja = 6 varillas y 1 galón de
 * pintura). Al empezar una producción con un modelo, esos materiales salen
 * ya puestos. Reglas en App\Gestion\Modelos.
 *
 * Ver: quien pueda abrir el módulo. Crear y cambiar: «produccion.gestionar».
 */
class ModelosController extends Controller
{
    public function index(Request $request): View
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);

        return view('negocio.modelos', [
            'modelos' => $negocio->modelosProduccion()->with(['materiales', 'productos:id,nombre,modelo_id'])->withCount('producciones')->orderBy('nombre')->get(),
            'articulosInv' => ProduccionController::materiales($negocio),
            'productosCatalogo' => $negocio->productos()->orderBy('nombre')->get(['id', 'nombre', 'modelo_id']),
            'cuentas' => InventarioController::cuentas($negocio),
            'abrir' => $request->integer('abrir') ?: null,
            'puedeProducir' => $this->puedeProducir($request),
        ]);
    }

    public function guardar(Request $request, ?int $modelo = null): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeProducir($request), 403, 'No tienes permiso para cambiar los modelos.');
        $existente = $modelo ? $negocio->modelosProduccion()->findOrFail($modelo) : null;

        $filas = collect((array) $request->input('materiales', []))->filter(fn ($f) => is_array($f))
            ->map(fn ($f) => ['articulo_id' => $f['articulo_id'] ?? null, 'cantidad' => Inventario::leerNumero($f['cantidad'] ?? null)])
            ->filter(fn ($f) => filled($f['articulo_id']) || filled($f['cantidad']))->values()->all();
        $request->merge(['materiales' => $filas]);
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:150'],
            'descripcion' => ['nullable', 'string', 'max:2000'],
            'al_pedido' => ['boolean'],
            'materiales' => ['array', 'max:'.Modelos::MAX_MATERIALES],
            'materiales.*.articulo_id' => ['required', 'integer', Rule::exists('inventario_articulos', 'id')->where('negocio_id', $negocio->id)],
            'materiales.*.cantidad' => ['required', 'numeric', 'gt:0', 'max:'.Inventario::MAXIMO],
            'productos' => ['array'],
            'productos.*' => ['integer'],
        ], [
            'materiales.*.articulo_id.required' => 'Elige el material de cada fila (o quita la fila).',
            'materiales.*.articulo_id.exists' => 'Uno de los materiales ya no está. Recarga la página.',
            'materiales.*.cantidad.required' => 'Escribe cuánto se gasta de cada material.',
            'materiales.*.cantidad.numeric' => 'La cantidad de cada material debe ser un número, por ejemplo 6 o 0,5.',
            'materiales.*.cantidad.gt' => 'La cantidad de cada material debe ser mayor que cero.',
        ], ['nombre' => 'nombre', 'descripcion' => 'descripción']);

        $porArticulo = [];
        foreach ($datos['materiales'] ?? [] as $f) {
            $id = (int) $f['articulo_id'];
            if (isset($porArticulo[$id])) {
                throw ValidationException::withMessages(['materiales' => 'Un material está repetido: deja una sola fila con la cantidad total.']);
            }
            $porArticulo[$id] = (float) $f['cantidad'];
        }
        if ($request->boolean('al_pedido') && ! $porArticulo) {
            throw ValidationException::withMessages(['materiales' => 'Para descontar con cada pedido, di qué materiales gasta.']);
        }
        $guardado = Modelos::guardar($negocio, $existente, [
            'nombre' => $datos['nombre'],
            'descripcion' => $datos['descripcion'] ?? null,
            'al_pedido' => $request->boolean('al_pedido'),
        ], $porArticulo, array_map('intval', $datos['productos'] ?? []));

        return redirect()->route('negocio.inventario.modelos', ['abrir' => $guardado->id])->with('ok', 'Se guardó el modelo «'.$guardado->nombre.'».');
    }

    public function eliminar(Request $request, int $modelo): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $this->verModulo($request);
        abort_unless($this->puedeProducir($request), 403, 'No tienes permiso para cambiar los modelos.');
        $existente = $negocio->modelosProduccion()->findOrFail($modelo);
        Modelos::eliminar($existente);

        return redirect()->route('negocio.inventario.modelos')->with('ok', 'Se eliminó el modelo «'.$existente->nombre.'».');
    }

    private function verModulo(Request $request): void
    {
        abort_unless(Gestion::puedeVerModulo($request->user(), $this->negocio($request), 'inventario'), 403, 'Materiales y producción no está activo para este negocio o no tienes permiso.');
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
