<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Panel WEB del comerciante (vistas Blade). Reutiliza los MISMOS modelos
 * que la API. Todo está acotado al negocio del comerciante autenticado.
 */
class PanelController extends Controller
{
    /** Pantalla principal: negocio + categorías + productos. */
    public function index(Request $request): View
    {
        $negocio = $request->user()->negocio;

        $productos = $negocio
            ? $negocio->productos()->with('categoria')->latest()->get()
            : collect();

        $categorias = $negocio
            ? $negocio->categorias()->orderBy('nombre')->get()
            : collect();

        return view('panel.index', compact('negocio', 'productos', 'categorias'));
    }

    /** Crear el negocio (si aún no tiene). */
    public function storeNegocio(Request $request): RedirectResponse
    {
        if ($request->user()->negocio) {
            return back()->with('error', 'Ya tienes un negocio.');
        }

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
        ]);

        $request->user()->negocio()->create($datos);

        return back()->with('ok', 'Negocio creado.');
    }

    /** Actualizar datos del negocio. */
    public function updateNegocio(Request $request): RedirectResponse
    {
        $negocio = $this->negocioOFallar($request);

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $datos['activo'] = $request->boolean('activo');
        $negocio->update($datos);

        return back()->with('ok', 'Negocio actualizado.');
    }

    /** Crear una categoría. */
    public function storeCategoria(Request $request): RedirectResponse
    {
        $negocio = $this->negocioOFallar($request);

        $datos = $request->validate([
            'nombre' => [
                'required', 'string', 'max:255',
                Rule::unique('categorias', 'nombre')->where('negocio_id', $negocio->id),
            ],
        ]);

        $negocio->categorias()->create($datos);

        return back()->with('ok', 'Categoría creada.');
    }

    /** Borrar una categoría (sus productos quedan sin categoría). */
    public function destroyCategoria(Request $request, int $id): RedirectResponse
    {
        $categoria = $this->negocioOFallar($request)->categorias()->find($id);

        if ($categoria) {
            $categoria->delete();
        }

        return back()->with('ok', 'Categoría eliminada.');
    }

    /** Crear un producto. */
    public function storeProducto(Request $request): RedirectResponse
    {
        $negocio = $this->negocioOFallar($request);

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'precio' => ['required', 'numeric', 'min:0'],
            'categoria_id' => [
                'nullable',
                Rule::exists('categorias', 'id')->where('negocio_id', $negocio->id),
            ],
        ]);

        $negocio->productos()->create($datos);

        return back()->with('ok', 'Producto creado.');
    }

    /** Mostrar el formulario para editar un producto. */
    public function editProducto(Request $request, int $id): View
    {
        $negocio = $this->negocioOFallar($request);
        $producto = $negocio->productos()->find($id) ?? abort(404);
        $categorias = $negocio->categorias()->orderBy('nombre')->get();

        return view('panel.producto-editar', compact('producto', 'categorias'));
    }

    /** Guardar los cambios de un producto. */
    public function updateProducto(Request $request, int $id): RedirectResponse
    {
        $negocio = $this->negocioOFallar($request);
        $producto = $negocio->productos()->find($id) ?? abort(404);

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'precio' => ['required', 'numeric', 'min:0'],
            'categoria_id' => [
                'nullable',
                Rule::exists('categorias', 'id')->where('negocio_id', $negocio->id),
            ],
            'disponible' => ['sometimes', 'boolean'],
        ]);

        $datos['disponible'] = $request->boolean('disponible');
        $producto->update($datos);

        return redirect()->route('panel')->with('ok', 'Producto actualizado.');
    }

    /** Activar/desactivar un producto (cambia 'disponible'). */
    public function toggleProducto(Request $request, int $id): RedirectResponse
    {
        $producto = $this->negocioOFallar($request)->productos()->find($id);

        if ($producto) {
            $producto->update(['disponible' => ! $producto->disponible]);
        }

        return back();
    }

    /** Borrar un producto (soft delete). */
    public function destroyProducto(Request $request, int $id): RedirectResponse
    {
        $producto = $this->negocioOFallar($request)->productos()->find($id);

        if ($producto) {
            $producto->delete();
        }

        return back()->with('ok', 'Producto eliminado.');
    }

    /** El negocio del comerciante o aborta (no debería pasar en la vista). */
    private function negocioOFallar(Request $request): Negocio
    {
        return $request->user()->negocio ?? abort(409, 'Primero crea tu negocio.');
    }

    // ---------- Pedidos del negocio ----------

    /** Listar los pedidos recibidos por mi negocio (más recientes primero). */
    public function pedidos(Request $request): View
    {
        $negocio = $this->negocioOFallar($request);

        $pedidos = $negocio->pedidos()
            ->with(['cliente', 'items', 'domiciliario'])
            ->latest()
            ->get();

        return view('panel.pedidos', compact('pedidos'));
    }

    /** Marcar un pedido como "listo para recoger" (lo ven los domiciliarios). */
    public function marcarListo(Request $request, int $id): RedirectResponse
    {
        $negocio = $this->negocioOFallar($request);

        // Solo pedidos de MI negocio y que estén pendientes.
        $pedido = $negocio->pedidos()->where('id', $id)->where('estado', 'pendiente')->first();

        if (! $pedido) {
            return back()->with('error', 'No se puede marcar ese pedido como listo.');
        }

        $pedido->update(['estado' => 'listo']);

        return back()->with('ok', "Pedido #{$pedido->id} marcado como listo. Los domiciliarios ya pueden tomarlo.");
    }
}
