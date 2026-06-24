<?php

use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\AuthWebController;
use App\Http\Controllers\Web\CarritoController;
use App\Http\Controllers\Web\ClienteController;
use App\Http\Controllers\Web\DomiciliarioController;
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
    Route::get('/buscar', [ClienteController::class, 'buscar'])->name('buscar');
    Route::get('/explorar/{id}', [ClienteController::class, 'verNegocio'])->name('explorar.negocio');

    // Carrito de compras.
    Route::post('/carrito/agregar/{producto}', [CarritoController::class, 'agregar'])->name('carrito.agregar');
    Route::get('/carrito', [CarritoController::class, 'ver'])->name('carrito');
    Route::put('/carrito/{item}', [CarritoController::class, 'actualizar'])->name('carrito.actualizar');
    Route::delete('/carrito/{item}', [CarritoController::class, 'quitar'])->name('carrito.quitar');
    Route::post('/carrito/vaciar', [CarritoController::class, 'vaciar'])->name('carrito.vaciar');
    Route::get('/carrito/checkout', [CarritoController::class, 'checkout'])->name('carrito.checkout');
    Route::post('/carrito/confirmar', [CarritoController::class, 'confirmar'])->name('carrito.confirmar');

    // Mis pedidos (seguimiento).
    Route::get('/mis-pedidos', [ClienteController::class, 'misPedidos'])->name('pedidos');
    Route::get('/mis-pedidos/{id}', [ClienteController::class, 'verPedido'])->name('pedidos.show');
});

// --- Zona del ADMINISTRADOR (sesión + rol administrador) ---
Route::middleware(['auth', 'role:administrador'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [AdminController::class, 'index'])->name('panel');
    Route::get('/usuarios', [AdminController::class, 'usuarios'])->name('usuarios');
    Route::post('/usuarios', [AdminController::class, 'storeUsuario'])->name('usuarios.store');
    Route::put('/usuarios/{usuario}/rol', [AdminController::class, 'updateRol'])->name('usuarios.rol');
    Route::get('/negocios', [AdminController::class, 'negocios'])->name('negocios');
});

// --- Zona del DOMICILIARIO (sesión + rol domiciliario) ---
Route::middleware(['auth', 'role:domiciliario'])->prefix('domiciliario')->name('domiciliario.')->group(function () {
    Route::get('/', [DomiciliarioController::class, 'index'])->name('panel');
    Route::put('/pedidos/{id}/tomar', [DomiciliarioController::class, 'tomar'])->name('tomar');
    Route::put('/pedidos/{id}/recogido', [DomiciliarioController::class, 'recogido'])->name('recogido');
    Route::put('/pedidos/{id}/en-camino', [DomiciliarioController::class, 'enCamino'])->name('encamino');
    Route::put('/pedidos/{id}/entregado', [DomiciliarioController::class, 'entregado'])->name('entregado');
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

    // Pedidos recibidos.
    Route::get('/pedidos', [PanelController::class, 'pedidos'])->name('panel.pedidos');
    Route::put('/pedidos/{id}/listo', [PanelController::class, 'marcarListo'])->name('panel.pedidos.listo');
});
