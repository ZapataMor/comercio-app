<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Vistas WEB del ADMINISTRADOR: visión global + gestión de usuarios y roles.
 */
class AdminController extends Controller
{
    private const ROLES = ['administrador', 'comerciante', 'usuario', 'domiciliario'];

    /** Tablero con números generales. */
    public function index(): View
    {
        $stats = [
            'usuarios' => User::count(),
            'negocios' => Negocio::count(),
            'negocios_activos' => Negocio::where('activo', true)->count(),
            'productos' => Producto::count(),
        ];

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
            $conteos[$rol] = User::role($rol)->count();
        }

        // Solo los usuarios del tipo seleccionado.
        $usuarios = User::role($rolActual)->orderBy('name')->get();

        return view('admin.usuarios', compact('usuarios', 'roles', 'rolActual', 'conteos'));
    }

    /** Crear un nuevo usuario con un rol asignado. */
    public function storeUsuario(Request $request): RedirectResponse
    {
        $datos = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'rol' => ['required', Rule::in(self::ROLES)],
        ]);

        $user = User::create([
            'name' => $datos['name'],
            'email' => $datos['email'],
            'password' => $datos['password'], // se hashea solo (cast 'hashed')
        ]);

        $user->assignRole($datos['rol']);

        // Vuelve a la pestaña del tipo recién creado.
        return redirect()
            ->route('admin.usuarios', ['rol' => $datos['rol']])
            ->with('ok', "Usuario {$user->name} creado como {$datos['rol']}.");
    }

    /** Cambiar el rol de un usuario. */
    public function updateRol(Request $request, User $usuario): RedirectResponse
    {
        $datos = $request->validate([
            'rol' => ['required', Rule::in(self::ROLES)],
        ]);

        // Salvaguarda: un admin no puede quitarse a sí mismo el rol de admin
        // (evita quedarse sin ningún administrador por accidente).
        if ($usuario->id === $request->user()->id && $datos['rol'] !== 'administrador') {
            return back()->with('error', 'No puedes quitarte tu propio rol de administrador.');
        }

        $usuario->syncRoles([$datos['rol']]);

        return back()->with('ok', "Rol de {$usuario->name} cambiado a {$datos['rol']}.");
    }

    /** Vista global de todos los negocios. */
    public function negocios(): View
    {
        $negocios = Negocio::with('user')
            ->withCount('productos')
            ->orderBy('nombre')
            ->get();

        return view('admin.negocios', compact('negocios'));
    }
}
