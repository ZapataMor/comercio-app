<?php

use App\Http\Controllers\Web\AccesoWebController;
use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\AuthWebController;
use App\Http\Controllers\Web\GestionAdminController;
use App\Http\Controllers\Web\OperacionController;
use App\Http\Controllers\Web\PanelNegocioController;
use App\Http\Controllers\Web\PublicoController;
use App\Http\Controllers\Web\SitioController;
use App\Http\Middleware\AdminWeb;
use App\Http\Middleware\NegocioWeb;
use Illuminate\Support\Facades\Route;

// --- Sitio público de Vitrina (sin sesión) ---
Route::controller(SitioController::class)->name('sitio.')->group(function () {
    Route::get('/', 'inicio')->name('inicio');
    Route::get('/como-funciona', 'comoFunciona')->name('como-funciona');
    Route::get('/planes', 'planes')->name('planes');
    Route::get('/preguntas-frecuentes', 'preguntas')->name('preguntas');
    Route::get('/contacto', 'contacto')->name('contacto');
    // Acceso de los negocios al pago de su membresía (aún sin funcionalidad).
    Route::get('/cuenta/entrar', 'entrar')->name('entrar');
});

// --- Páginas legales (sin sesión). Play Store enlaza /privacidad y /eliminar-cuenta: no cambiarlas. ---
Route::get('/privacidad', [PublicoController::class, 'privacidad'])->name('privacidad');
Route::get('/aviso-de-privacidad', [PublicoController::class, 'avisoPrivacidad'])->name('aviso-privacidad');
Route::get('/terminos', [PublicoController::class, 'terminos'])->name('terminos');
Route::get('/condiciones-de-membresia', [PublicoController::class, 'membresia'])->name('membresia');
Route::get('/cookies', [PublicoController::class, 'cookies'])->name('cookies');
Route::get('/cancelaciones', [PublicoController::class, 'cancelaciones'])->name('cancelaciones');
Route::get('/eliminar-cuenta', [PublicoController::class, 'eliminarCuentaForm'])->name('eliminar-cuenta');
Route::post('/eliminar-cuenta', [PublicoController::class, 'eliminarCuenta'])->middleware('throttle:eliminar-cuenta');

// --- Archivos para buscadores e investigadores de seguridad ---
Route::get('/robots.txt', [SitioController::class, 'robots']);
Route::get('/sitemap.xml', [SitioController::class, 'sitemap']);
Route::get('/.well-known/security.txt', [SitioController::class, 'seguridad']);

// --- Login web (sesión con cookies) ---
// Una sola puerta para el panel del negocio y el del administrador: QR desde
// la app, celular + clave + código por WhatsApp, o Google + clave. El
// administrador también puede entrar con usuario y contraseña (POST /login).
Route::controller(AccesoWebController::class)->prefix('login')->name('login')->group(function () {
    Route::get('/', 'entrar')->middleware('throttle:30,1');
    Route::get('/estado', 'estado')->middleware('throttle:90,1')->name('.estado');
    Route::post('/celular', 'celular')->middleware('throttle:acceso')->name('.celular');
    Route::post('/celular/codigo', 'codigoCelular')->middleware('throttle:acceso')->name('.celular.codigo');
    Route::post('/google', 'google')->middleware('throttle:acceso')->name('.google');
    Route::post('/google/clave', 'claveGoogle')->middleware('throttle:acceso')->name('.google.clave');
    Route::post('/cancelar', 'cancelar')->name('.cancelar');
});
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
        Route::get('/categorias', 'categorias')->name('categorias');
        Route::get('/mapa', 'mapa')->name('mapa');
        Route::get('/resenas', 'resenas')->name('resenas');
        Route::get('/reputacion', 'reputacion')->name('reputacion');
        Route::get('/reputacion/{tipo}/{id}', 'reputacionDetalle')->whereIn('tipo', ['negocio', 'domiciliario'])->whereNumber('id')->name('reputacion-detalle');
        Route::get('/auditoria', 'auditoria')->name('auditoria');
        Route::post('/acciones/{accion}/{id?}', 'accion')->whereNumber('id')->name('accion');
    });

    // --- Vitrina Gestión: configuración del super administrador (ADR-005) ---
    Route::controller(GestionAdminController::class)->prefix('gestion')->name('gestion')->group(function () {
        Route::get('/', 'index');
        Route::get('/negocios/{negocio}', 'negocio')->whereNumber('negocio')->name('.negocio');
        Route::post('/negocios/{negocio}/panel', 'panel')->whereNumber('negocio')->name('.panel');
        Route::post('/negocios/{negocio}/modulos', 'modulos')->whereNumber('negocio')->name('.modulos');
        Route::post('/negocios/{negocio}/plantilla', 'plantilla')->whereNumber('negocio')->name('.aplicar-plantilla');
        Route::post('/negocios/{negocio}/accesos/{acceso}/cerrar', 'cerrarAcceso')->whereNumber(['negocio', 'acceso'])->name('.cerrar-acceso');
        Route::get('/plantillas/nueva', 'nuevaPlantilla')->name('.plantilla-nueva');
        Route::post('/plantillas', 'guardarPlantilla')->name('.plantilla-crear');
        Route::get('/plantillas/{plantilla}', 'verPlantilla')->whereNumber('plantilla')->name('.plantilla');
        Route::put('/plantillas/{plantilla}', 'guardarPlantilla')->whereNumber('plantilla')->name('.plantilla-guardar');
    });
});

// --- Vitrina Gestión: panel web del negocio (ADR-005) ---
// Se entra por /login (QR, WhatsApp o Google). /negocio/entrar queda por las
// apps que ya mostraban esa dirección.
Route::prefix('negocio')->name('negocio.')->group(function () {
    Route::redirect('/entrar', '/login')->name('entrar');
    Route::post('/salir', [AccesoWebController::class, 'salir'])->name('salir');
    Route::middleware(NegocioWeb::class)->controller(PanelNegocioController::class)->group(function () {
        Route::get('/elegir', 'elegir')->name('elegir');
        Route::post('/elegir', 'cambiar')->name('cambiar');
        Route::get('/', 'inicio')->name('inicio');
        Route::get('/tienda', 'tienda')->name('tienda');
        Route::get('/catalogo', 'catalogo')->name('catalogo');
        Route::get('/pedidos', 'pedidos')->name('pedidos');
        Route::get('/equipo', 'equipo')->name('equipo');
        Route::put('/equipo/{miembro}/permisos', 'permisos')->whereNumber('miembro')->name('permisos');
        Route::get('/agenda', 'agenda')->name('agenda');
        Route::get('/resenas', 'resenas')->name('resenas');
        Route::get('/sedes', 'sedes')->name('sedes');
        Route::post('/sedes', 'guardarSede')->name('sedes.crear');
        Route::put('/sedes/{sede}', 'guardarSede')->whereNumber('sede')->name('sedes.guardar');
        Route::get('/modulos/{modulo}', 'modulo')->name('modulo');
    });
});
