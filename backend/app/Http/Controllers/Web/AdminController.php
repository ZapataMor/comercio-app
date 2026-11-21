<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\PedidoReporte;
use App\Models\User;
use App\Support\UbicacionDomiciliario;
use App\Support\CuentaPorAdmin;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Vistas WEB del ADMINISTRADOR: visión global + gestión de usuarios y roles.
 */
class AdminController extends Controller
{
    public function reportes(Request $request): View
    {
        $estado = $request->validate(['estado' => ['sometimes', Rule::in(['pendientes', 'resueltos', 'todos'])]])['estado'] ?? 'pendientes';
        $reportes = PedidoReporte::with(['pedido.cliente', 'pedido.negocio', 'pedido.domiciliario'])
            ->when($estado !== 'todos', fn ($q) => $estado === 'resueltos' ? $q->whereNotNull('resuelto_at') : $q->whereNull('resuelto_at'))
            ->oldest()->orderBy('id')->paginate(20)->withQueryString();

        return view('admin.reportes', compact('reportes', 'estado'));
    }

    public function resolverReporte(Request $request, int $id): RedirectResponse
    {
        $datos = $request->validate(['resolucion' => ['required', 'string', 'min:5', 'max:1000']]);
        PedidoReporte::findOrFail($id);
        $cambio = PedidoReporte::whereKey($id)->whereNull('resuelto_at')->update([
            'resuelto_at' => now(), 'resuelto_por' => $request->user()->id, 'resolucion' => trim($datos['resolucion']),
        ]);

        return $cambio ? back()->with('ok', 'Reporte atendido.') : back()->with('error', 'Este reporte ya fue atendido.');
    }

    private const ROLES = ['administrador', 'usuario', 'domiciliario'];

    /** Tablero con números generales. */
    public function index(): View
    {
        $stats = app(\App\Http\Controllers\Api\AdminController::class)->stats()->getData(true);
        $stats['demorados'] = Pedido::whereIn('estado', Pedido::EN_CURSO)->where('updated_at', '<=', now()->subMinutes(30))->count();

        return view('admin.index', compact('stats'));
    }

    /** Lista de usuarios filtrada POR TIPO (rol), con pestañas. */
    public function usuarios(Request $request): View
    {
        $roles = self::ROLES;

        // Tipo seleccionado (por defecto el primero). Se valida contra la lista.
        $rolActual = $request->get('rol');
        if (! in_array($rolActual, $roles, true)) {
            $rolActual = $roles[0];
        }

        // Conteo por tipo (para las pestañas).
        $conteos = [];
        foreach ($roles as $rol) {
            $conteos[$rol] = User::deTipo($rol)->count();
        }

        // Solo los usuarios del tipo seleccionado.
        $request->validate(['buscar' => ['nullable', 'string', 'max:100']]);
        $usuarios = User::deTipo($rolActual)->when($request->buscar, fn ($q, $v) => $q->where(fn ($q) => $q->where('name', 'like', '%'.$v.'%')->orWhere('username', 'like', '%'.$v.'%')->orWhere('email', 'like', '%'.$v.'%')->orWhere('telefono', 'like', '%'.$v.'%')))->orderBy('name')->paginate(25)->withQueryString();
        $tipos = User::TIPOS;

        return view('admin.usuarios', compact('usuarios', 'roles', 'rolActual', 'conteos', 'tipos'));
    }

    /**
     * Crear un nuevo usuario con un rol asignado. Clientes y domiciliarios
     * entran a la app con su celular y una clave de 4 números (ver
     * CuentaPorAdmin); los administradores, a este panel con usuario y
     * contraseña.
     */
    public function storeUsuario(Request $request): RedirectResponse|JsonResponse
    {
        $rol = $request->validate(['rol' => ['required', Rule::in(self::ROLES)]])['rol'];

        if ($rol === 'administrador') {
            if (is_string($request->input('username'))) {
                $request->merge(['username' => strtolower(trim($request->input('username')))]);
            }
            $datos = $request->validate([
                'username' => ['required', 'string', 'min:3', 'max:50', 'regex:/\A[a-z0-9][a-z0-9_.-]*\z/', 'unique:users,username'],
                'password' => ['required', 'string', 'min:5'],
            ], [
                'username.required' => 'Escribe el usuario con que entrará al panel.',
                'password.required' => 'Escribe la contraseña con que entrará al panel.',
            ]);
            $user = User::create([
                'name' => $datos['username'],
                'username' => $datos['username'],
                'password' => $datos['password'], // se hashea solo (cast 'hashed')
            ]);
            $user->syncRoles(User::rolesDelTipo($rol));
        } else {
            $user = CuentaPorAdmin::deLaApp($request, $rol);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Usuario creado.', 'user' => $user->only(['id', 'username', 'name', 'telefono'])], 201);
        }

        // Vuelve a la pestaña del tipo recién creado.
        return redirect()
            ->route('admin.usuarios', ['rol' => $rol])
            ->with('ok', "Usuario {$user->name} creado como ".User::TIPOS[$rol].'.');
    }

    /** Cambiar el rol de un usuario. */
    public function updateRol(Request $request, User $usuario): RedirectResponse|JsonResponse
    {
        $datos = $request->validate([
            'rol' => ['required', Rule::in(self::ROLES)],
            'motivo' => ['required', 'string', 'max:255'],
        ]);

        // Salvaguarda: un admin no puede quitarse a sí mismo el rol de admin
        // (evita quedarse sin ningún administrador por accidente).
        if ($usuario->id === $request->user()->id && $datos['rol'] !== 'administrador') {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'No puedes quitarte tu propio rol de administrador.'], 422);
            }

            return back()->with('error', 'No puedes quitarte tu propio rol de administrador.');
        }

        $bloqueado = DB::transaction(function () use ($usuario, $datos) {
            $usuario = User::lockForUpdate()->findOrFail($usuario->id);
            if ($datos['rol'] !== 'domiciliario' && UbicacionDomiciliario::tieneEntregaEnCurso($usuario)) {
                return true;
            }
            $usuario->syncRoles(User::rolesDelTipo($datos['rol']));
            if ($datos['rol'] !== 'domiciliario') {
                $usuario->forceFill(['en_turno' => false])->save();
                UbicacionDomiciliario::borrar($usuario);
            }

            return false;
        });
        if ($bloqueado) {
            $mensaje = 'Tiene una recogida, entrega o devolución en curso. Debe terminarla antes de quitar el rol.';

            return $request->expectsJson() ? response()->json(['message' => $mensaje], 409) : back()->with('error', $mensaje);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Rol actualizado.']);
        }

        return back()->with('ok', "{$usuario->name} ahora es ".User::TIPOS[$datos['rol']].'.');
    }

    /** Vista global de todos los negocios. */
    public function negocios(Request $request): View
    {
        $request->validate(['buscar' => ['nullable', 'string', 'max:100']]);
        $query = Negocio::query()
            ->when($request->boolean('abiertos'), fn ($q) => $q->where('activo', true))
            ->when($request->buscar, fn ($q, $v) => $q->where('nombre', 'like', '%'.$v.'%'));
        // El mapa incluye todos los resultados, no solo la página de tarjetas.
        $ubicaciones = (clone $query)->whereNotNull('lat')->whereNotNull('lng')
            ->whereBetween('lat', [-90, 90])->whereBetween('lng', [-180, 180])
            ->orderBy('nombre')->get(['id', 'nombre', 'direccion', 'activo', 'lat', 'lng'])
            ->map(fn ($n) => [
                'id' => $n->id, 'nombre' => $n->nombre, 'direccion' => $n->direccion,
                'activo' => $n->activo, 'lat' => $n->lat, 'lng' => $n->lng,
                'url' => route('admin.negocio', $n),
            ]);
        $negocios = $query->with('user')->withCount('productos')->orderBy('nombre')
            ->paginate(25)->withQueryString();

        return view('admin.negocios', compact('negocios', 'ubicaciones'));
    }
}
