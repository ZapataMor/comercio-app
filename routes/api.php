<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoriaController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NegocioController;
use App\Http\Controllers\ProductoController;
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
    });
});
