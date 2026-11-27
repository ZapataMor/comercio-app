<?php

use App\Http\Controllers\Web\AccesoWebController;
use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\AuthWebController;
use App\Http\Controllers\Web\GestionAdminController;
use App\Http\Controllers\Web\InventarioController;
use App\Http\Controllers\Web\ModelosController;
use App\Http\Controllers\Web\OperacionController;
use App\Http\Controllers\Web\PanelNegocioController;
use App\Http\Controllers\Web\ProduccionController;
use App\Http\Controllers\Web\PublicoController;
use App\Http\Controllers\Web\SitioController;
use App\Http\Controllers\Web\TrabajadoresController;
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
    Route::redirect('/cuenta/entrar', '/login')->name('entrar');
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
    Route::get('/codigo', 'nuevoCodigo')->middleware('throttle:30,1')->name('.codigo');
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
        Route::put('/tienda', 'guardarTienda')->name('tienda.guardar');
        Route::post('/tienda/cuentas', 'guardarCuenta')->name('cuentas.crear');
        Route::put('/tienda/cuentas/{cuenta}', 'guardarCuenta')->whereNumber('cuenta')->name('cuentas.guardar');
        Route::delete('/tienda/cuentas/{cuenta}', 'eliminarCuenta')->whereNumber('cuenta')->name('cuentas.eliminar');
        Route::get('/catalogo', 'catalogo')->name('catalogo');
        Route::post('/catalogo/productos', 'guardarProducto')->name('productos.crear');
        Route::put('/catalogo/productos/{producto}', 'guardarProducto')->whereNumber('producto')->name('productos.guardar');
        Route::patch('/catalogo/productos/{producto}/disponible', 'disponibilidadProducto')->whereNumber('producto')->name('productos.disponible');
        Route::delete('/catalogo/productos/{producto}', 'eliminarProducto')->whereNumber('producto')->name('productos.eliminar');
        Route::post('/catalogo/servicios', 'crearServicio')->name('servicios.crear');
        // Lo fabricado que espera sus datos para entrar al catálogo.
        Route::get('/pedidos', 'pedidos')->name('pedidos');
        Route::get('/agenda', 'agenda')->name('agenda');
        Route::get('/resenas', 'resenas')->name('resenas');
        Route::get('/sedes', 'sedes')->name('sedes');
        Route::post('/sedes', 'guardarSede')->name('sedes.crear');
        Route::put('/sedes/{sede}', 'guardarSede')->whereNumber('sede')->name('sedes.guardar');
        Route::get('/modulos/{modulo}', 'modulo')->name('modulo');
    });
    // Trabajadores (módulo «equipo» del núcleo): asociar con el código, sede,
    // días y horas, permisos y tareas. /equipo queda por los enlaces viejos.
    Route::middleware(NegocioWeb::class)->controller(TrabajadoresController::class)->group(function () {
        Route::redirect('/equipo', '/negocio/trabajadores');
        Route::get('/trabajadores', 'index')->name('equipo');
        Route::post('/trabajadores/codigo', 'resolverCodigo')->name('equipo.codigo');
        Route::post('/trabajadores/invitar', 'invitar')->name('equipo.invitar');
        Route::delete('/trabajadores/invitaciones/{invitacion}', 'cancelarInvitacion')->whereNumber('invitacion')->name('equipo.invitacion.cancelar');
        Route::post('/trabajadores/tareas', 'crearTarea')->name('equipo.tareas.crear');
        Route::put('/trabajadores/tareas/{tarea}', 'guardarTarea')->whereNumber('tarea')->name('equipo.tareas.guardar');
        Route::patch('/trabajadores/tareas/{tarea}/estado', 'estadoTarea')->whereNumber('tarea')->name('equipo.tareas.estado');
        Route::delete('/trabajadores/tareas/{tarea}', 'eliminarTarea')->whereNumber('tarea')->name('equipo.tareas.eliminar');
        Route::put('/trabajadores/{miembro}', 'guardar')->whereNumber('miembro')->name('equipo.guardar');
        Route::delete('/trabajadores/{miembro}', 'quitar')->whereNumber('miembro')->name('equipo.quitar');
    });
    // Materiales y producción (módulo opcional «inventario»): materiales y
    // herramientas con características libres, existencias y movimientos.
    Route::middleware(NegocioWeb::class)->controller(InventarioController::class)->group(function () {
        Route::get('/inventario', 'index')->name('inventario');
        Route::post('/inventario', 'guardar')->name('inventario.crear');
        Route::put('/inventario/{articulo}', 'guardar')->whereNumber('articulo')->name('inventario.guardar');
        Route::delete('/inventario/{articulo}', 'eliminar')->whereNumber('articulo')->name('inventario.eliminar');
        Route::post('/inventario/{articulo}/movimientos', 'mover')->whereNumber('articulo')->name('inventario.mover');
    });
    // La producción por etapas del mismo módulo: por hacer (con sus
    // materiales), terminada (ponerle nombre) y al catálogo.
    Route::middleware(NegocioWeb::class)->controller(ProduccionController::class)->group(function () {
        Route::get('/inventario/produccion', 'index')->name('inventario.produccion');
        Route::post('/inventario/produccion', 'crear')->name('inventario.produccion.crear');
        Route::put('/inventario/produccion/{produccion}', 'guardar')->whereNumber('produccion')->name('inventario.produccion.guardar');
        Route::delete('/inventario/produccion/{produccion}', 'cancelar')->whereNumber('produccion')->name('inventario.produccion.cancelar');
        Route::put('/inventario/produccion/{produccion}/nombre', 'nombrar')->whereNumber('produccion')->name('inventario.produccion.nombrar');
        Route::post('/inventario/produccion/{produccion}/anular', 'anular')->whereNumber('produccion')->name('inventario.produccion.anular');
    });
    // Modelos: la base de lo que se hace, con sus materiales predeterminados.
    Route::middleware(NegocioWeb::class)->controller(ModelosController::class)->group(function () {
        Route::get('/inventario/modelos', 'index')->name('inventario.modelos');
        Route::post('/inventario/modelos', 'guardar')->name('inventario.modelos.crear');
        Route::put('/inventario/modelos/{modelo}', 'guardar')->whereNumber('modelo')->name('inventario.modelos.guardar');
        Route::delete('/inventario/modelos/{modelo}', 'eliminar')->whereNumber('modelo')->name('inventario.modelos.eliminar');
    });
});
