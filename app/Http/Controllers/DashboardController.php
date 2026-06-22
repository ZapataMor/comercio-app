<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Endpoint ÚNICO que devuelve una "vista" distinta según el rol del
     * usuario autenticado. El frontend llama siempre a /api/dashboard y
     * pinta lo que reciba.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Datos comunes a cualquier usuario logueado.
        $base = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames(),
        ];

        // Según el rol, devolvemos el "panel" correspondiente.
        return response()->json([
            'user' => $base,
            'dashboard' => $this->panelParaRol($user),
        ]);
    }

    /**
     * Devuelve el contenido del panel según el primer rol del usuario.
     */
    private function panelParaRol($user): array
    {
        return match (true) {
            $user->hasRole('administrador') => [
                'titulo' => 'Panel de administrador',
                'puede' => [
                    'Gestionar usuarios y roles',
                    'Ver todos los comercios',
                    'Asignar repartidores (domiciliarios)',
                ],
                'menu' => ['usuarios', 'comercios', 'reportes', 'configuracion'],
            ],
            $user->hasRole('comerciante') => [
                'titulo' => 'Panel del comerciante',
                'puede' => [
                    'Gestionar mi tienda y productos',
                    'Ver mis pedidos entrantes',
                    'Consultar mis ventas',
                ],
                'menu' => ['mi-tienda', 'productos', 'pedidos', 'ventas'],
            ],
            $user->hasRole('domiciliario') => [
                'titulo' => 'Panel del domiciliario',
                'puede' => [
                    'Ver pedidos asignados',
                    'Actualizar estado de entrega',
                ],
                'menu' => ['entregas-asignadas', 'historial'],
            ],
            // Por defecto: usuario/cliente.
            default => [
                'titulo' => 'Inicio',
                'puede' => [
                    'Explorar comercios y productos',
                    'Hacer pedidos',
                    'Ver mis pedidos',
                ],
                'menu' => ['explorar', 'carrito', 'mis-pedidos'],
            ],
        };
    }
}
