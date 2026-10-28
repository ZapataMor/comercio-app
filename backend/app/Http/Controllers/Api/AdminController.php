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
    private const ROLES = ['administrador', 'usuario', 'domiciliario'];

    /** Números generales para el tablero. */
    public function stats(): JsonResponse
    {
        return response()->json([
            'usuarios' => User::count(),
            'negocios' => Negocio::count(),
            'negocios_activos' => Negocio::where('activo', true)->count(),
            'productos' => Producto::count(),
            // Vetados por baja confiabilidad (revisar en Reputación).
            'domiciliarios_vetados' => User::whereNotNull('domiciliario_vetado_at')->count(),
            'negocios_vetados' => Negocio::whereNotNull('vetado_at')->count(),
        ]);
    }

    /**
     * Usuarios filtrados por tipo (rol), con conteos por tipo. 30 por página
     * (`?page=`) y búsqueda por nombre, apellidos o correo (`?buscar=`).
     */
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

        $buscar = trim((string) $request->get('buscar', ''));
        $pagina = User::role($rol)
            ->when($buscar !== '', fn ($q) => $q->where(fn ($qq) => $qq
                ->where('name', 'like', "%{$buscar}%")
                ->orWhere('apellidos', 'like', "%{$buscar}%")
                ->orWhere('email', 'like', "%{$buscar}%")))
            ->orderBy('name')
            ->paginate(30);

        $usuarios = $pagina->getCollection()->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->nombre_completo,
            'email' => $u->email,
            'rol' => $u->getRoleNames()->first(),
            'suspendido' => $u->suspendido_at !== null,
            'motivo_suspension' => $u->motivo_suspension,
        ])->values();

        return response()->json([
            'roles' => self::ROLES,
            'rol_actual' => $rol,
            'conteos' => $conteos,
            'usuarios' => $usuarios,
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
        ]);
    }

    /**
     * Suspender una cuenta (cliente abusivo, pedidos falsos…): no puede
     * iniciar sesión y sus sesiones abiertas se cierran. Para negocios y
     * domiciliarios por mal servicio está el veto de Reputación.
     */
    public function suspender(Request $request, User $usuario): JsonResponse
    {
        $datos = $request->validate([
            'motivo' => ['required', 'string', 'max:255'],
        ]);

        if ($usuario->id === $request->user()->id) {
            return response()->json(['message' => 'No puedes suspender tu propia cuenta.'], 422);
        }

        $usuario->forceFill(['suspendido_at' => now(), 'motivo_suspension' => $datos['motivo']])->save();
        $usuario->tokens()->delete();
        $usuario->deviceTokens()->delete();

        return response()->json(['message' => "Cuenta de {$usuario->nombre_completo} suspendida."]);
    }

    /** Quitar la suspensión: puede volver a iniciar sesión. */
    public function reactivar(User $usuario): JsonResponse
    {
        $usuario->forceFill(['suspendido_at' => null, 'motivo_suspension' => null])->save();

        return response()->json(['message' => "Cuenta de {$usuario->nombre_completo} reactivada."]);
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
            'usuario' => ['id' => $user->id, 'name' => $user->nombre_completo, 'email' => $user->email, 'rol' => $datos['rol']],
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

        return response()->json(['message' => "Rol de {$usuario->nombre_completo} cambiado a {$datos['rol']}."]);
    }

    /** Todos los negocios (visión global): 30 por página y `?buscar=` por nombre. */
    public function negocios(Request $request): JsonResponse
    {
        $buscar = trim((string) $request->get('buscar', ''));
        $pagina = Negocio::with('user')
            ->withCount('productos')
            ->when($buscar !== '', fn ($q) => $q->where('nombre', 'like', "%{$buscar}%"))
            ->orderBy('nombre')
            ->paginate(30);

        $negocios = $pagina->getCollection()->map(fn ($n) => [
            'id' => $n->id,
            'nombre' => $n->nombre,
            'dueno' => $n->user?->nombre_completo,
            'productos' => $n->productos_count,
            'activo' => $n->activo,
            'vetado' => $n->vetado_at !== null,
            'archivado' => $n->archivado_at !== null,
        ])->values();

        return response()->json([
            'negocios' => $negocios,
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
        ]);
    }
}
