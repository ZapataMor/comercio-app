<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Vista y acciones WEB del DOMICILIARIO.
 *
 * Flujo: ve pedidos "listos" (disponibles) -> los TOMA indicando minutos para
 * recoger -> marca Recogido -> En camino -> Entregado.
 */
class DomiciliarioController extends Controller
{
    public const ESTADOS = ['Asignado', 'Recogido', 'En camino', 'Entregado'];

    public function index(Request $request): View
    {
        $yo = $request->user()->id;

        // Disponibles: listos y sin domiciliario.
        $disponibles = Pedido::where('estado', 'listo')
            ->whereNull('domiciliario_id')
            ->with(['negocio', 'items'])
            ->latest()
            ->get();

        // Mías activas: tomadas por mí y aún no entregadas.
        $entregas = Pedido::where('domiciliario_id', $yo)
            ->whereIn('estado', ['tomado', 'recogido', 'en_camino'])
            ->with(['negocio', 'cliente', 'items'])
            ->latest()
            ->get();

        // Historial: entregadas por mí.
        $historial = Pedido::where('domiciliario_id', $yo)
            ->where('estado', 'entregado')
            ->with('negocio')
            ->latest()
            ->get();

        return view('domiciliario.index', compact('disponibles', 'entregas', 'historial'));
    }

    /** Tomar un pedido disponible, indicando en cuántos minutos pasa a recoger. */
    public function tomar(Request $request, int $id): RedirectResponse
    {
        $datos = $request->validate([
            'minutos_recogida' => ['required', 'integer', 'min:1', 'max:240'],
        ]);

        // Update condicional: solo si sigue 'listo' y sin dueño (evita choques
        // si dos domiciliarios lo toman casi al mismo tiempo).
        $afectados = Pedido::where('id', $id)
            ->where('estado', 'listo')
            ->whereNull('domiciliario_id')
            ->update([
                'estado' => 'tomado',
                'domiciliario_id' => $request->user()->id,
                'minutos_recogida' => $datos['minutos_recogida'],
            ]);

        if (! $afectados) {
            return back()->with('error', 'Ese pedido ya fue tomado por otro domiciliario.');
        }

        return back()->with('ok', 'Tomaste el pedido. Pasa a recogerlo al negocio.');
    }

    /** Marcar "Recogido" (estaba 'tomado'). */
    public function recogido(Request $request, int $id): RedirectResponse
    {
        return $this->avanzar($request, $id, desde: 'tomado', hacia: 'recogido', msg: 'Pedido marcado como recogido.');
    }

    /** Marcar "En camino" (estaba 'recogido'). */
    public function enCamino(Request $request, int $id): RedirectResponse
    {
        return $this->avanzar($request, $id, desde: 'recogido', hacia: 'en_camino', msg: 'Pedido en camino al cliente.');
    }

    /** Marcar "Entregado" (estaba 'en_camino'). */
    public function entregado(Request $request, int $id): RedirectResponse
    {
        return $this->avanzar($request, $id, desde: 'en_camino', hacia: 'entregado', msg: '¡Entrega completada!');
    }

    /**
     * Avanza un pedido MÍO de un estado al siguiente (valida el estado previo).
     */
    private function avanzar(Request $request, int $id, string $desde, string $hacia, string $msg): RedirectResponse
    {
        $pedido = Pedido::where('id', $id)
            ->where('domiciliario_id', $request->user()->id)
            ->where('estado', $desde)
            ->first();

        if (! $pedido) {
            return back()->with('error', 'No se puede actualizar ese pedido.');
        }

        $pedido->update(['estado' => $hacia]);

        return back()->with('ok', $msg);
    }
}
