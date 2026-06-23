<?php

use App\Http\Controllers\Web\AuthWebController;
use App\Http\Controllers\Web\ClienteController;
use App\Http\Controllers\Web\HomeController;
use App\Http\Controllers\Web\PanelController;
use Illuminate\Support\Facades\Route;

// La raíz lleva a cada quien a su zona según el rol (o al login si no hay sesión).
Route::get('/', fn () => redirect()->route('home'));

// --- Login web (sesión con cookies) ---
Route::get('/login', [AuthWebController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthWebController::class, 'login']);
Route::post('/logout', [AuthWebController::class, 'logout'])->name('logout');

// Punto de entrada según rol (tras login).
Route::get('/home', [HomeController::class, 'index'])->middleware('auth')->name('home');

// --- Zona del CLIENTE (sesión + rol usuario) ---
Route::middleware(['auth', 'role:usuario'])->group(function () {
    Route::get('/explorar', [ClienteController::class, 'explorar'])->name('explorar');
    Route::get('/explorar/{id}', [ClienteController::class, 'verNegocio'])->name('explorar.negocio');
});

// --- Panel del comerciante (requiere sesión + rol comerciante) ---
Route::middleware(['auth', 'role:comerciante'])->prefix('panel')->group(function () {
    Route::get('/', [PanelController::class, 'index'])->name('panel');

    Route::post('/negocio', [PanelController::class, 'storeNegocio'])->name('panel.negocio.store');
    Route::put('/negocio', [PanelController::class, 'updateNegocio'])->name('panel.negocio.update');

    Route::post('/categorias', [PanelController::class, 'storeCategoria'])->name('panel.categorias.store');
    Route::delete('/categorias/{id}', [PanelController::class, 'destroyCategoria'])->name('panel.categorias.destroy');

    Route::post('/productos', [PanelController::class, 'storeProducto'])->name('panel.productos.store');
    Route::get('/productos/{id}/editar', [PanelController::class, 'editProducto'])->name('panel.productos.edit');
    Route::put('/productos/{id}', [PanelController::class, 'updateProducto'])->name('panel.productos.update');
    Route::put('/productos/{id}/toggle', [PanelController::class, 'toggleProducto'])->name('panel.productos.toggle');
    Route::delete('/productos/{id}', [PanelController::class, 'destroyProducto'])->name('panel.productos.destroy');
});
