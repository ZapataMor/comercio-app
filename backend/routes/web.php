<?php

use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\AuthWebController;
use App\Http\Controllers\Web\OperacionController;
use App\Http\Controllers\Web\PublicoController;
use App\Http\Middleware\AdminWeb;
use Illuminate\Support\Facades\Route;

// La web es exclusiva del administrador.
Route::redirect('/', '/admin');

// --- Páginas públicas que exige Play Store (sin sesión) ---
Route::get('/privacidad', [PublicoController::class, 'privacidad'])->name('privacidad');
Route::get('/eliminar-cuenta', [PublicoController::class, 'eliminarCuentaForm'])->name('eliminar-cuenta');
Route::post('/eliminar-cuenta', [PublicoController::class, 'eliminarCuenta'])->middleware('throttle:eliminar-cuenta');

// --- Login web (sesión con cookies) ---
Route::get('/login', [AuthWebController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthWebController::class, 'login'])->middleware('throttle:acceso');
Route::post('/logout', [AuthWebController::class, 'logout'])->name('logout');

// --- Zona del ADMINISTRADOR (sesión + rol administrador) ---
Route::middleware(['auth', 'auth.session', 'role:administrador', AdminWeb::class])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [AdminController::class, 'index'])->name('panel');
    Route::get('/usuarios', [AdminController::class, 'usuarios'])->name('usuarios');
    Route::post('/usuarios', [AdminController::class, 'storeUsuario'])->name('usuarios.store');
    Route::put('/usuarios/{usuario}/rol', [AdminController::class, 'updateRol'])->name('usuarios.rol');
    Route::get('/negocios', [AdminController::class, 'negocios'])->name('negocios');
    Route::get('/reportes', [AdminController::class, 'reportes'])->name('reportes');
    Route::put('/reportes/{id}/resolver', [AdminController::class, 'resolverReporte'])->whereNumber('id')->name('reportes.resolver');
    Route::controller(OperacionController::class)->group(function () {
        Route::get('/pedidos', 'pedidos')->name('pedidos');
        Route::get('/pedidos/exportar', 'exportar')->name('exportar');
        Route::get('/pedidos/{pedido}', 'pedido')->whereNumber('pedido')->name('pedido');
        Route::get('/usuarios/{usuario}', 'usuario')->whereNumber('usuario')->name('usuario');
        Route::get('/negocios/{negocio}', 'negocio')->whereNumber('negocio')->name('negocio');
        Route::get('/negocios/{negocio}/pedidos/exportar', 'negocioExportar')->whereNumber('negocio')->name('negocio.exportar');
        Route::get('/negocios/{negocio}/pedidos/{pedido}', 'negocioPedido')->whereNumber('negocio')->whereNumber('pedido')->name('negocio.pedido');
        Route::get('/configuracion', 'configuracion')->name('configuracion');
        Route::get('/mapa', 'mapa')->name('mapa');
        Route::get('/categorias', 'categorias')->name('categorias');
        Route::get('/resenas', 'resenas')->name('resenas');
        Route::get('/reputacion', 'reputacion')->name('reputacion');
        Route::get('/reputacion/{tipo}/{id}', 'reputacionDetalle')->whereIn('tipo', ['negocio', 'domiciliario'])->whereNumber('id')->name('reputacion-detalle');
        Route::get('/auditoria', 'auditoria')->name('auditoria');
        Route::post('/acciones/{accion}/{id?}', 'accion')->whereNumber('id')->name('accion');
    });
});
