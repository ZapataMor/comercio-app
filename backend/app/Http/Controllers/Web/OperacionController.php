<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Ajuste;
use App\Models\Barrio;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Resena;
use App\Models\User;
use App\Support\ModeracionResenas;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OperacionController extends Controller
{
    public function pedidosQuery(Request $request)
    {
        $d = $request->validate([
            'estado' => ['nullable', Rule::in(['todos', 'en_curso', ...array_keys(Pedido::ESTADO_LABEL)])],
            'buscar' => ['nullable', 'string', 'max:100'],
            'desde' => ['nullable', 'date_format:Y-m-d'],
            'hasta' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('desde'), 'after_or_equal:desde')],
            'negocio' => ['nullable', 'integer'],
            'demorados' => ['nullable', 'boolean'],
            'fecha' => ['nullable', Rule::in(['creacion', 'resultado'])],
        ]);
        $estado = $d['estado'] ?? 'en_curso';
        $fecha = ($d['fecha'] ?? 'creacion') === 'resultado'
            ? DB::raw("CASE WHEN estado = 'entregado' THEN COALESCE(entregado_at, updated_at) WHEN estado = 'cancelado' THEN COALESCE(cancelado_at, updated_at) ELSE created_at END")
            : 'created_at';

        return Pedido::with(['cliente', 'negocio', 'domiciliario'])
            ->when($estado === 'en_curso', fn ($q) => $q->whereIn('estado', Pedido::EN_CURSO))
            ->when(! in_array($estado, ['todos', 'en_curso']), fn ($q) => $q->where('estado', $estado))
            ->when($d['buscar'] ?? null, fn ($q, $v) => $q->where('codigo', strtoupper(trim($v))))
            ->when($d['desde'] ?? null, fn ($q, $v) => $q->whereDate($fecha, '>=', $v))
            ->when($d['hasta'] ?? null, fn ($q, $v) => $q->whereDate($fecha, '<=', $v))
            ->when($d['demorados'] ?? false, fn ($q) => $q->whereIn('estado', Pedido::EN_CURSO)->where('updated_at', '<=', now()->subMinutes(30)))
            ->when($d['negocio'] ?? null, fn ($q, $v) => $q->where('negocio_id', $v));
    }

    public function pedidos(Request $request)
    {
        $query = $this->pedidosQuery($request);
        $total = (clone $query)->count();
        $ventas = (clone $query)->where('estado', 'entregado')->sum('total');
        $pedidos = $query->oldest()->orderBy('id')->paginate(25)->withQueryString();

        return view('admin.pedidos', compact('pedidos', 'total', 'ventas'));
    }

    public function pedido(Pedido $pedido)
    {
        $pedido->load(['cliente', 'negocio', 'domiciliario', 'items']);

        return view('admin.pedido', compact('pedido'));
    }

    public function exportar(Request $request)
    {
        $query = $this->pedidosQuery($request);

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Código', 'Fecha de creación', 'Estado', 'Negocio', 'Cliente', 'Domiciliario', 'Total COP', 'Pago'], ';', '"', '');
            foreach ($query->lazyById(500) as $p) {
                $row = [$p->codigo, $p->created_at, $p->estadoLabel(), $p->nombreNegocio(), $p->cliente?->nombre_completo, $p->domiciliario?->nombre_completo, $p->total, $p->metodo_pago];
                $row = array_map(fn ($v) => preg_match('/^[\s]*[=+@-]/u', (string) $v) ? "'".$v : $v, $row);
                fputcsv($out, $row, ';', '"', '');
            }
            fclose($out);
        }, 'pedidos-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function usuario(User $usuario)
    {
        $pedidos = Pedido::where(fn ($q) => $q->where('user_id', $usuario->id)->orWhere('domiciliario_id', $usuario->id))->latest()->paginate(20);

        return view('admin.usuario', compact('usuario', 'pedidos'));
    }

    public function negocio(Request $request, Negocio $negocio)
    {
        $datos = $request->validate(['seccion' => ['nullable', Rule::in(['informacion', 'productos', 'servicios', 'pedidos', 'resenas', 'reputacion', 'equipo'])]]);
        $seccion = $datos['seccion'] ?? 'informacion';
        $negocio->load(['user', 'miembros', 'tiposNegocio'])->loadCount(['productos', 'servicios', 'pedidos']);
        $contextoNegocio = $negocio;
        $data = compact('negocio', 'contextoNegocio', 'seccion');
        if ($seccion === 'productos') {
            $data['productos'] = $negocio->productos()->with('categoria')->orderBy('nombre')->paginate(12)->withQueryString();
        } elseif ($seccion === 'servicios') {
            $data['servicios'] = $negocio->servicios()->orderBy('nombre')->paginate(12)->withQueryString();
        } elseif ($seccion === 'pedidos') {
            $request->merge(['negocio' => $negocio->id, 'estado' => $request->input('estado') ?: 'todos']);
            $query = $this->pedidosQuery($request);
            $data['total'] = (clone $query)->count();
            $data['ventas'] = (clone $query)->where('estado', 'entregado')->sum('total');
            $data['pedidos'] = $query->latest()->orderByDesc('id')->paginate(20)->withQueryString();
        } elseif ($seccion === 'resenas') {
            $filtro = $request->validate(['filtro' => ['nullable', Rule::in(['todas', 'reportadas', 'ocultas'])]])['filtro'] ?? 'todas';
            $query = Resena::where('negocio_id', $negocio->id)->with(['user', 'negocio', 'producto' => fn ($q) => $q->withTrashed(), 'moderaciones.admin', 'reportes']);
            if ($filtro === 'reportadas') {
                $query->reportadas();
            }
            if ($filtro === 'ocultas') {
                $query->whereNotNull('oculta_at');
            }
            $pagina = $query->latest()->orderByDesc('id')->paginate(20);
            $data += ['filtro' => $filtro, 'resenas' => $pagina->getCollection()->map(fn ($r) => ModeracionResenas::paraAdmin($r))->all(), 'pagina' => $pagina->currentPage(), 'ultima_pagina' => $pagina->lastPage()];
        } elseif ($seccion === 'reputacion') {
            $data += app(Api\AdminReputacionController::class)->show('negocio', $negocio->id)->getData(true);
            $data += ['tipo' => 'negocio', 'id' => $negocio->id];
        }

        return view('admin.negocio', $data);
    }

    public function negocioPedido(Negocio $negocio, Pedido $pedido)
    {
        abort_unless($pedido->negocio_id === $negocio->id, 404);
        $pedido->load(['cliente', 'negocio', 'domiciliario', 'items']);

        return view('admin.pedido', ['pedido' => $pedido, 'contextoNegocio' => $negocio]);
    }

    public function negocioExportar(Request $request, Negocio $negocio)
    {
        $request->merge(['negocio' => $negocio->id, 'estado' => $request->input('estado') ?: 'todos']);

        return $this->exportar($request);
    }

    public function configuracion()
    {
        return view('admin.configuracion', ['tarifa' => Ajuste::tarifaDomicilio(), 'barrios' => Barrio::with('creador')->orderBy('aprobado')->orderBy('nombre')->paginate(30)]);
    }

    /** Categorías globales del catálogo: crear, renombrar, ocultar y borrar. */
    public function categorias()
    {
        return view('admin.categorias', app(Api\AdminCategoriaController::class)->index()->getData(true));
    }

    public function mapa()
    {
        return view('admin.mapa', app(Api\AdminController::class)->mapaDomiciliarios()->getData(true));
    }

    public function resenas(Request $request)
    {
        return view('admin.resenas', app(Api\AdminResenaController::class)->index($request)->getData(true));
    }

    public function reputacion(Request $request)
    {
        return view('admin.reputacion', app(Api\AdminReputacionController::class)->index($request)->getData(true));
    }

    public function reputacionDetalle(string $tipo, int $id)
    {
        $response = app(Api\AdminReputacionController::class)->show($tipo, $id);
        abort_if($response->getStatusCode() !== 200, 404);

        return view('admin.reputacion-detalle', $response->getData(true) + compact('tipo', 'id'));
    }

    public function auditoria(Request $request)
    {
        $request->validate(['buscar' => ['nullable', 'string', 'max:100']]);
        $acciones = DB::table('admin_acciones')->leftJoin('users', 'users.id', '=', 'admin_acciones.admin_id')
            ->select('admin_acciones.*', 'users.name as administrador')
            ->when($request->buscar, fn ($q, $v) => $q->where(fn ($q) => $q->where('accion', 'like', '%'.$v.'%')->orWhere('recurso', 'like', '%'.$v.'%')->orWhere('users.name', 'like', '%'.$v.'%')))
            ->orderByDesc('admin_acciones.id')->paginate(30)->withQueryString();

        return view('admin.auditoria', compact('acciones'));
    }

    // Adaptador web: todas las mutaciones conservan las reglas de la API.
    public function accion(Request $request, string $accion, int $id = 0)
    {
        $request->validate(['motivo' => ['nullable', 'string', 'max:255']]);
        $response = match ($accion) {
            'suspender' => app(Api\AdminController::class)->suspender($request, User::findOrFail($id)),
            'reactivar' => app(Api\AdminController::class)->reactivar(User::findOrFail($id)),
            'cerrar' => app(Api\AdminPedidoController::class)->cerrar($request, $id),
            'tarifa' => app(Api\AjusteController::class)->actualizar($request),
            'aprobar-barrio' => app(Api\BarrioController::class)->aprobar($id),
            'rechazar-barrio' => app(Api\BarrioController::class)->rechazar($id),
            'crear-categoria' => app(Api\AdminCategoriaController::class)->store($request),
            'editar-categoria' => app(Api\AdminCategoriaController::class)->update($request, $id),
            'eliminar-categoria' => app(Api\AdminCategoriaController::class)->destroy($id),
            'ocultar' => app(Api\AdminResenaController::class)->ocultar($request, $id),
            'restaurar' => app(Api\AdminResenaController::class)->restaurar($request, $id),
            'descartar-reportes' => app(Api\AdminResenaController::class)->descartarReportes($request, $id),
            'anular-evento' => app(Api\AdminReputacionController::class)->anular($request, $id),
            'vetar', 'levantar-veto' => $this->veto($request, $accion, $id),
            default => abort(404),
        };
        $request->attributes->set('admin_accion_ok', $response->getStatusCode() < 400);

        return back()->with($response->getStatusCode() < 400 ? 'ok' : 'error', $response->getData(true)['message'] ?? 'Guardado.');
    }

    private function veto(Request $request, string $accion, int $id)
    {
        $d = $request->validate(['tipo' => ['required', Rule::in(['negocio', 'domiciliario'])]]);
        $controller = app(Api\AdminReputacionController::class);

        return $accion === 'vetar' ? $controller->suspender($request, $d['tipo'], $id) : $controller->levantarVeto($request, $d['tipo'], $id);
    }
}
