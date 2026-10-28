<?php

use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\AuthWebController;
use App\Http\Controllers\Web\PublicoController;
use Illuminate\Support\Facades\Route;

// La web es SOLO el panel del administrador. Clientes, negocios y
// domiciliarios usan la app móvil Vitrina.
Route::get('/', fn () => redirect()->route('admin.panel'));

// --- Páginas públicas que exige Play Store (sin sesión) ---
Route::get('/privacidad', [PublicoController::class, 'privacidad'])->name('privacidad');
Route::get('/eliminar-cuenta', [PublicoController::class, 'eliminarCuentaForm'])->name('eliminar-cuenta');
Route::post('/eliminar-cuenta', [PublicoController::class, 'eliminarCuenta'])->middleware('throttle:eliminar-cuenta');

// --- Login web (sesión con cookies) ---
Route::get('/login', [AuthWebController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthWebController::class, 'login'])->middleware('throttle:acceso');
Route::post('/logout', [AuthWebController::class, 'logout'])->name('logout');

// --- Zona del ADMINISTRADOR (sesión + rol administrador) ---
Route::middleware(['auth', 'role:administrador'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [AdminController::class, 'index'])->name('panel');
    Route::get('/usuarios', [AdminController::class, 'usuarios'])->name('usuarios');
    Route::post('/usuarios', [AdminController::class, 'storeUsuario'])->name('usuarios.store');
    Route::put('/usuarios/{usuario}/rol', [AdminController::class, 'updateRol'])->name('usuarios.rol');
    Route::get('/negocios', [AdminController::class, 'negocios'])->name('negocios');
});
