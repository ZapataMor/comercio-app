<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Gestion;
use App\Gestion\Modulos;
use App\Http\Controllers\Controller;
use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Resena;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Panel web del negocio (ADR-005). Por ahora:
 * - el núcleo muestra los datos que ya existen en la app (la edición se trae
 *   módulo por módulo en la fase 0),
 * - «Varias sedes» funciona completo,
 * - Equipo permite dar los permisos de cada módulo,
 * - los módulos en construcción muestran cómo van a estar constituidos.
 */
class PanelNegocioController extends Controller
{
    public function elegir(Request $request): View
    {
        return view('negocio.elegir', ['negocios' => $request->attributes->get('negocios_web')]);
    }

    public function cambiar(Request $request): RedirectResponse
    {
        $id = (int) $request->validate(['negocio_id' => ['required', 'integer']])['negocio_id'];
        abort_unless($request->attributes->get('negocios_web')->contains('id', $id), 403);
        $request->session()->put('negocio_web_id', $id);

        return redirect()->route('negocio.inicio');
    }

    public function inicio(Request $request): View
    {
        $negocio = $this->negocio($request);
        $hoy = now()->startOfDay();

        return view('negocio.inicio', [
            'sedes' => $negocio->sedes()->where('activa', true)->orderByDesc('principal')->get(),
            'equipo' => $negocio->miembrosActivos()->count(),
            'productos' => $negocio->productos()->count(),
            'pedidosHoy' => $negocio->pedidos()->where('created_at', '>=', $hoy)->count(),
            'enCurso' => $negocio->pedidos()->whereIn('estado', Pedido::EN_CURSO)->count(),
            'citasHoy' => Cita::where('negocio_id', $negocio->id)->whereBetween('inicio', [$hoy, $hoy->copy()->endOfDay()])->whereIn('estado', ['pendiente', 'confirmada'])->count(),
            'opcionales' => array_values(array_diff(Gestion::modulosActivos($negocio), Modulos::nucleo())),
            'permisos' => Gestion::permisosDe($request->user(), $negocio),
        ]);
    }

    public function tienda(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.tienda', [
            'cuentas' => $negocio->administra($request->user()) ? $negocio->cuentasPago()->orderBy('orden')->get() : collect(),
        ]);
    }

    public function catalogo(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.catalogo', [
            'productos' => $negocio->productos()->with('categoria')->orderBy('nombre')->paginate(30, ['*'], 'productos')->withQueryString(),
            'servicios' => $negocio->servicios()->orderBy('nombre')->get(),
            'campos' => $negocio->plantillaGestion?->campos_producto ?? [],
        ]);
    }

    public function pedidos(Request $request): View
    {
        $negocio = $this->negocio($request);
        $user = $request->user();
        abort_unless($negocio->puede($user, 'gestionar_pedidos') || $negocio->puede($user, 'cambiar_estado'), 403, 'No tienes permiso para ver los pedidos.');

        return view('negocio.pedidos', [
            'pedidos' => $negocio->pedidos()->with('cliente')->latest()->paginate(30),
        ]);
    }

    public function equipo(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.equipo', [
            'miembros' => $negocio->miembrosActivos()->orderBy('name')->get(),
            'asignables' => Gestion::permisosAsignables($negocio),
            'puedeEditar' => $negocio->administra($request->user()),
        ]);
    }

    public function permisos(Request $request, User $miembro): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->administra($request->user()), 403, 'Solo el dueño o el administrador del negocio cambia permisos.');
        if ($negocio->administra($miembro)) {
            return back()->with('error', 'El dueño y el administrador del negocio ya tienen todos los permisos.');
        }
        $datos = $request->validate(['permisos' => ['array'], 'permisos.*' => ['string']]);
        Gestion::guardarPermisos($negocio, $miembro, $datos['permisos'] ?? []);

        return back()->with('ok', 'Permisos de '.$miembro->name.' guardados.');
    }

    public function agenda(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.agenda', [
            'citas' => Cita::where('negocio_id', $negocio->id)->where('inicio', '>=', now()->startOfDay())
                ->with('profesional')->orderBy('inicio')->paginate(30),
        ]);
    }

    public function resenas(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.resenas', [
            'resenas' => Resena::where('negocio_id', $negocio->id)->latest()->paginate(30),
        ]);
    }

    // --------------------------------------------------------------- Sedes

    public function sedes(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.sedes', [
            'sedes' => $negocio->sedes()->orderByDesc('activa')->orderByDesc('principal')->orderBy('nombre')->get(),
            'variasSedes' => Gestion::tieneModulo($negocio, 'sedes'),
            'puedeEditar' => Gestion::puede($request->user(), $negocio, 'sedes.gestionar') || $negocio->administra($request->user()),
            'editar' => $request->query('editar') ? $negocio->sedes()->find($request->query('editar')) : null,
        ]);
    }

    public function guardarSede(Request $request, ?Sede $sede = null): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $user = $request->user();
        abort_unless(Gestion::puede($user, $negocio, 'sedes.gestionar') || $negocio->administra($user), 403, 'No tienes permiso para cambiar las sedes.');
        abort_if($sede && $sede->negocio_id !== $negocio->id, 404);

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:80', Rule::unique('sedes', 'nombre')->where('negocio_id', $negocio->id)->ignore($sede?->id)],
            'tipo' => ['required', Rule::in(array_keys(Sede::TIPOS))],
            'direccion' => ['nullable', 'string', 'max:255'],
            'barrio' => ['nullable', 'string', 'max:120'],
            'telefono' => ['nullable', 'string', 'max:20'],
            'factura' => ['boolean'],
            'principal' => ['boolean'],
            'activa' => ['boolean'],
        ]);
        $datos['factura'] = $request->boolean('factura');
        $datos['principal'] = $request->boolean('principal');
        $datos['activa'] = $sede ? $request->boolean('activa') : true;

        $activasDespues = $negocio->sedes()->where('activa', true)->when($sede, fn ($q) => $q->whereKeyNot($sede->id))->count() + ($datos['activa'] ? 1 : 0);
        if ($activasDespues > 1 && ! Gestion::tieneModulo($negocio, 'sedes')) {
            return back()->withInput()->with('error', 'Para tener más de una sede activa el negocio necesita el módulo «Varias sedes». Pídeselo a Vitrina.');
        }
        if ($activasDespues === 0) {
            return back()->withInput()->with('error', 'El negocio necesita al menos una sede activa.');
        }
        if ($sede?->principal && ! $datos['activa']) {
            return back()->withInput()->with('error', 'La sede principal no se puede desactivar: primero marca otra como principal.');
        }

        DB::transaction(function () use ($negocio, $sede, $datos) {
            if ($datos['principal']) {
                $negocio->sedes()->update(['principal' => false]);
                $datos['activa'] = true;
            } elseif ($sede?->principal) {
                $datos['principal'] = true; // siempre queda una principal
            }
            $sede ? $sede->update($datos) : $negocio->sedes()->create($datos);
            if (! $negocio->sedes()->where('principal', true)->exists()) {
                $negocio->sedes()->where('activa', true)->oldest()->first()?->update(['principal' => true]);
            }
        });

        return redirect()->route('negocio.sedes')->with('ok', 'Sede guardada.');
    }

    // ------------------------------------------- Módulos en construcción

    public function modulo(Request $request, string $modulo): View|RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless(Modulos::existe($modulo), 404);
        if (Modulos::esNucleo($modulo) || $modulo === 'sedes') {
            return redirect()->route($modulo === 'inicio' ? 'negocio.inicio' : 'negocio.'.$modulo);
        }
        abort_unless(Gestion::puedeVerModulo($request->user(), $negocio, $modulo), 403, 'Este módulo no está activo o no tienes permiso.');

        return view('negocio.modulo', [
            'clave' => $modulo,
            'modulo' => Modulos::get($modulo),
            'permisos' => array_intersect(array_keys(Modulos::get($modulo)['permisos']), Gestion::permisosDe($request->user(), $negocio)),
        ]);
    }

    private function negocio(Request $request): Negocio
    {
        return $request->attributes->get('negocio_web');
    }
}
