<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/**
 * Vistas WEB del CLIENTE (rol 'usuario'): explorar negocios y ver catálogos.
 * (Hacer pedidos llegará cuando construyamos el flujo de pedidos.)
 */
class ClienteController extends Controller
{
    /** Lista de negocios abiertos. */
    public function explorar(Request $request): View
    {
        $negocios = Negocio::where('activo', true)
            ->withCount(['productos' => fn ($q) => $q->where('disponible', true)])
            ->orderBy('nombre')
            ->get();

        return view('cliente.explorar', compact('negocios'));
    }

    /** Catálogo de un negocio (solo productos disponibles, agrupados por categoría). */
    public function verNegocio(Request $request, int $id): View
    {
        // Solo negocios activos son visibles para el cliente.
        $negocio = Negocio::where('activo', true)->findOrFail($id);

        $productos = $negocio->productos()
            ->where('disponible', true)
            ->with('categoria')
            ->orderBy('nombre')
            ->get()
            ->groupBy(fn ($p) => $p->categoria?->nombre ?? 'Otros');

        return view('cliente.negocio', compact('negocio', 'productos'));
    }
}
