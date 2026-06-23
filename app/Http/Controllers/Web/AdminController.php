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
use Spatie\Permission\Models\Role;

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

    /** Lista de usuarios con su rol, para gestionarlos. */
    public function usuarios(): View
    {
        $usuarios = User::with('roles')->orderBy('name')->get();
        $roles = self::ROLES;

        return view('admin.usuarios', compact('usuarios', 'roles'));
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
