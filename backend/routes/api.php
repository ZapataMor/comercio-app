<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoriaController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NegocioController;
use App\Http\Controllers\ProductoController;
use App\Http\Controllers\Api\CatalogoController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\DomiciliarioController as ApiDomiciliarioController;
use App\Http\Controllers\Api\PedidoController as ApiPedidoController;
use App\Http\Controllers\Api\ComercioPedidoController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Rutas públicas de autenticación.
// throttle:6,1 = máximo 6 intentos por minuto por IP (anti fuerza bruta).
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:6,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

// Rutas que requieren un token Sanctum válido.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Panel adaptativo: responde distinto según el rol del usuario logueado.
    // El frontend llama siempre aquí y pinta lo que reciba.
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // --- Catálogo público (cliente): explorar negocios y ver productos ---
    Route::get('/negocios', [CatalogoController::class, 'index']);
    Route::get('/negocios/{id}', [CatalogoController::class, 'show']);

    // --- Pedidos del cliente ---
    Route::post('/pedidos', [ApiPedidoController::class, 'store']);
    Route::get('/pedidos', [ApiPedidoController::class, 'index']);
    Route::get('/pedidos/{id}', [ApiPedidoController::class, 'show']);

    // --- Zona exclusiva del COMERCIANTE ---
    Route::middleware('role:comerciante')->prefix('comerciante')->group(function () {
        Route::get('/negocio', [NegocioController::class, 'show']);
        Route::post('/negocio', [NegocioController::class, 'store']);
        Route::put('/negocio', [NegocioController::class, 'update']);

        // Catálogo de productos del negocio.
        Route::get('/productos', [ProductoController::class, 'index']);
        Route::post('/productos', [ProductoController::class, 'store']);
        Route::get('/productos/{id}', [ProductoController::class, 'show']);
        Route::put('/productos/{id}', [ProductoController::class, 'update']);
        Route::delete('/productos/{id}', [ProductoController::class, 'destroy']);

        // Categorías del catálogo.
        Route::get('/categorias', [CategoriaController::class, 'index']);
        Route::post('/categorias', [CategoriaController::class, 'store']);
        Route::put('/categorias/{id}', [CategoriaController::class, 'update']);
        Route::delete('/categorias/{id}', [CategoriaController::class, 'destroy']);

        // Pedidos recibidos por el negocio.
        Route::get('/pedidos', [ComercioPedidoController::class, 'index']);
        Route::put('/pedidos/{id}/listo', [ComercioPedidoController::class, 'marcarListo']);
    });

    // --- Zona del ADMINISTRADOR ---
    Route::middleware('role:administrador')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);
        Route::get('/usuarios', [AdminController::class, 'usuarios']);
        Route::post('/usuarios', [AdminController::class, 'storeUsuario']);
        Route::put('/usuarios/{usuario}/rol', [AdminController::class, 'updateRol']);
        Route::get('/negocios', [AdminController::class, 'negocios']);
    });

    // --- Zona del DOMICILIARIO (pedidos) ---
    Route::middleware('role:domiciliario')->prefix('domiciliario')->group(function () {
        Route::get('/disponibles', [ApiDomiciliarioController::class, 'disponibles']);
        Route::get('/entregas', [ApiDomiciliarioController::class, 'entregas']);
        Route::get('/historial', [ApiDomiciliarioController::class, 'historial']);
        Route::put('/pedidos/{id}/tomar', [ApiDomiciliarioController::class, 'tomar']);
        Route::put('/pedidos/{id}/recogido', [ApiDomiciliarioController::class, 'recogido']);
        Route::put('/pedidos/{id}/en-camino', [ApiDomiciliarioController::class, 'enCamino']);
        Route::put('/pedidos/{id}/entregado', [ApiDomiciliarioController::class, 'entregado']);
    });
});
