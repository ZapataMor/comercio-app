<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * API del ADMINISTRADOR para la app móvil: estadísticas, gestión de usuarios
 * (por tipo, crear, cambiar rol) y visión global de negocios.
 */
class AdminController extends Controller
{
    private const ROLES = ['administrador', 'comerciante', 'usuario', 'domiciliario'];

    /** Números generales para el tablero. */
    public function stats(): JsonResponse
    {
        return response()->json([
            'usuarios' => User::count(),
            'negocios' => Negocio::count(),
            'negocios_activos' => Negocio::where('activo', true)->count(),
            'productos' => Producto::count(),
        ]);
    }

    /** Usuarios filtrados por tipo (rol), con conteos por tipo. */
    public function usuarios(Request $request): JsonResponse
    {
        $rol = $request->get('rol');
        if (! in_array($rol, self::ROLES, true)) {
            $rol = self::ROLES[0];
        }

        $conteos = [];
        foreach (self::ROLES as $r) {
            $conteos[$r] = User::role($r)->count();
        }

        $usuarios = User::role($rol)->orderBy('name')->get()->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'rol' => $u->getRoleNames()->first(),
        ]);

        return response()->json([
            'roles' => self::ROLES,
            'rol_actual' => $rol,
            'conteos' => $conteos,
            'usuarios' => $usuarios,
        ]);
    }

    /** Crear un usuario con rol. */
    public function storeUsuario(Request $request): JsonResponse
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
            'password' => $datos['password'],
        ]);
        $user->assignRole($datos['rol']);

        return response()->json([
            'usuario' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'rol' => $datos['rol']],
        ], 201);
    }

    /** Cambiar el rol de un usuario. */
    public function updateRol(Request $request, User $usuario): JsonResponse
    {
        $datos = $request->validate([
            'rol' => ['required', Rule::in(self::ROLES)],
        ]);

        // El admin no puede quitarse a sí mismo el rol de administrador.
        if ($usuario->id === $request->user()->id && $datos['rol'] !== 'administrador') {
            return response()->json(['message' => 'No puedes quitarte tu propio rol de administrador.'], 422);
        }

        $usuario->syncRoles([$datos['rol']]);

        return response()->json(['message' => "Rol de {$usuario->name} cambiado a {$datos['rol']}."]);
    }

    /** Todos los negocios (visión global). */
    public function negocios(): JsonResponse
    {
        $negocios = Negocio::with('user')
            ->withCount('productos')
            ->orderBy('nombre')
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'nombre' => $n->nombre,
                'dueno' => $n->user?->name,
                'productos' => $n->productos_count,
                'activo' => $n->activo,
            ]);

        return response()->json(['negocios' => $negocios]);
    }
}
