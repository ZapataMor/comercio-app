<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\CarritoItem;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\Producto;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Carrito de compras del cliente y confirmación del pedido.
 *
 * Regla central: un carrito pertenece a UN solo negocio (la entrega es por
 * tienda). Si el cliente intenta mezclar tiendas, se le avisa.
 */
class CarritoController extends Controller
{
    /** Añadir un producto al carrito. */
    public function agregar(Request $request, int $producto): RedirectResponse
    {
        // Solo productos disponibles de negocios abiertos.
        $prod = Producto::where('disponible', true)
            ->whereHas('negocio', fn ($n) => $n->where('activo', true))
            ->find($producto);

        if (! $prod) {
            return back()->with('error', 'Ese producto ya no está disponible.');
        }

        $negocioEnCarrito = $this->negocioDelCarrito($request);

        if ($negocioEnCarrito && $negocioEnCarrito !== $prod->negocio_id) {
            return back()->with('error', 'Tu carrito tiene productos de otra tienda. Vacíalo para pedir de otra.');
        }

        // Si ya está, suma 1; si no, lo crea con cantidad 1.
        $item = CarritoItem::firstOrNew([
            'user_id' => $request->user()->id,
            'producto_id' => $prod->id,
        ]);
        $item->cantidad = ($item->cantidad ?? 0) + 1;
        $item->save();

        return back()->with('ok', "“{$prod->nombre}” se añadió al carrito.");
    }

    /** Ver el carrito. */
    public function ver(Request $request): View
    {
        $items = $this->itemsDe($request);
        $total = $items->sum(fn ($i) => $i->subtotal());
        $negocio = $items->first()?->producto?->negocio;

        return view('cliente.carrito', compact('items', 'total', 'negocio'));
    }

    /** Cambiar la cantidad de un ítem. */
    public function actualizar(Request $request, int $item): RedirectResponse
    {
        $datos = $request->validate([
            'cantidad' => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        $carritoItem = $request->user()->carritoItems()->find($item);
        $carritoItem?->update(['cantidad' => $datos['cantidad']]);

        return back();
    }

    /** Quitar un ítem del carrito. */
    public function quitar(Request $request, int $item): RedirectResponse
    {
        $request->user()->carritoItems()->where('id', $item)->delete();

        return back()->with('ok', 'Producto quitado del carrito.');
    }

    /** Vaciar todo el carrito. */
    public function vaciar(Request $request): RedirectResponse
    {
        $request->user()->carritoItems()->delete();

        return back()->with('ok', 'Carrito vaciado.');
    }

    /** Pantalla de confirmación: dirección, teléfono y forma de pago. */
    public function checkout(Request $request): View|RedirectResponse
    {
        $items = $this->itemsDe($request);

        if ($items->isEmpty()) {
            return redirect()->route('carrito')->with('error', 'Tu carrito está vacío.');
        }

        $total = $items->sum(fn ($i) => $i->subtotal());
        $negocio = $items->first()->producto->negocio;

        return view('cliente.checkout', compact('items', 'total', 'negocio'));
    }

    /** Confirmar la compra: crea el pedido y vacía el carrito. */
    public function confirmar(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'direccion_entrega' => ['required', 'string', 'max:255'],
            'telefono_contacto' => ['required', 'string', 'max:30'],
            'metodo_pago' => ['required', Rule::in(Pedido::METODOS_PAGO)],
        ]);

        $items = $this->itemsDe($request);

        if ($items->isEmpty()) {
            return redirect()->route('carrito')->with('error', 'Tu carrito está vacío.');
        }

        $negocioId = $items->first()->producto->negocio_id;
        $total = $items->sum(fn ($i) => $i->subtotal());

        $pedido = DB::transaction(function () use ($request, $items, $datos, $negocioId, $total) {
            $pedido = Pedido::create([
                'negocio_id' => $negocioId,
                'user_id' => $request->user()->id,
                'estado' => 'pendiente',
                'metodo_pago' => $datos['metodo_pago'],
                'total' => $total,
                'direccion_entrega' => $datos['direccion_entrega'],
                'telefono_contacto' => $datos['telefono_contacto'],
            ]);

            // Copia (snapshot) de cada producto al momento del pedido.
            foreach ($items as $i) {
                $pedido->items()->create([
                    'producto_id' => $i->producto_id,
                    'nombre' => $i->producto->nombre,
                    'precio' => $i->producto->precio,
                    'cantidad' => $i->cantidad,
                ]);
            }

            // Vaciar el carrito.
            $request->user()->carritoItems()->delete();

            return $pedido;
        });

        return redirect()->route('pedidos.show', $pedido->id)
            ->with('ok', '¡Pedido confirmado! El negocio ya lo recibió.');
    }

    // ---------- Helpers ----------

    /** Ítems del carrito del cliente, con su producto y negocio. */
    private function itemsDe(Request $request)
    {
        return $request->user()
            ->carritoItems()
            ->with('producto.negocio')
            ->get();
    }

    /** negocio_id al que pertenece el carrito actual (o null si está vacío). */
    private function negocioDelCarrito(Request $request): ?int
    {
        return $request->user()
            ->carritoItems()
            ->with('producto:id,negocio_id')
            ->get()
            ->first()?->producto?->negocio_id;
    }
}
