<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Producto;
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

    /**
     * Búsqueda de productos por nombre, descripción, categoría o negocio.
     *
     * Base de búsqueda por palabras clave (insensible a mayúsculas/tildes por
     * la colación de MySQL). Cada palabra debe aparecer en algún campo.
     *
     * NOTA: la búsqueda semántica y tolerante a errores de ortografía
     * (ej: "pastiyas pal dolor" -> analgésicos) se añadirá después como una
     * capa encima de esto, sin cambiar esta vista.
     */
    public function buscar(Request $request): View
    {
        $q = trim((string) $request->get('q', ''));
        $resultados = collect();

        if ($q !== '') {
            $tokens = array_slice(preg_split('/\s+/', $q), 0, 6); // máx 6 palabras

            $query = Producto::query()
                ->where('disponible', true)
                ->whereHas('negocio', fn ($n) => $n->where('activo', true))
                ->with(['categoria', 'negocio']);

            // Cada palabra debe coincidir en algún campo (AND entre palabras).
            foreach ($tokens as $palabra) {
                $like = '%'.$palabra.'%';
                $query->where(function ($w) use ($like) {
                    $w->where('nombre', 'like', $like)
                        ->orWhere('descripcion', 'like', $like)
                        ->orWhereHas('categoria', fn ($c) => $c->where('nombre', 'like', $like))
                        ->orWhereHas('negocio', fn ($n) => $n->where('nombre', 'like', $like));
                });
            }

            $resultados = $query->orderBy('nombre')->limit(50)->get();
        }

        return view('cliente.buscar', compact('q', 'resultados'));
    }
}
