<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoriaController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NegocioController;
use App\Http\Controllers\ProductoController;
use App\Http\Controllers\Api\CatalogoController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminReputacionController;
use App\Http\Controllers\Api\DomiciliarioController as ApiDomiciliarioController;
use App\Http\Controllers\Api\PedidoController as ApiPedidoController;
use App\Http\Controllers\Api\ComercioPedidoController;
use App\Http\Controllers\Api\InvitacionController;
use App\Http\Controllers\Api\TrabajadorController;
use App\Http\Controllers\Api\BarrioController;
use App\Http\Controllers\Api\ClienteDireccionController;
use App\Http\Controllers\Api\DeviceTokenController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Rutas públicas de autenticación.
// Límites de intentos con nombre: ver AppServiceProvider::limitesDeIntentos().
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:acceso');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:acceso');

// "Olvidé mi contraseña": se envía un código de 6 dígitos al correo y con él
// se pone una contraseña nueva.
Route::post('/password/codigo', [\App\Http\Controllers\Api\RecuperarClaveController::class, 'enviarCodigo'])->middleware('throttle:codigo-clave');
Route::post('/password/restablecer', [\App\Http\Controllers\Api\RecuperarClaveController::class, 'restablecer'])->middleware('throttle:restablecer-clave');

// Barrios aprobados de Maicao. Pública: el registro la necesita sin token.
Route::get('/barrios', [BarrioController::class, 'index'])->middleware('throttle:publico');

// Rutas que requieren un token Sanctum válido.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Perfil personal del usuario logueado (cualquier rol).
    Route::put('/perfil', [AuthController::class, 'actualizarPerfil']);
    // Eliminar mi cuenta (anonimiza; exige la contraseña).
    Route::delete('/cuenta', [\App\Http\Controllers\Api\CuentaController::class, 'destroy']);

    // Panel adaptativo: responde distinto según el rol del usuario logueado.
    // El frontend llama siempre aquí y pinta lo que reciba.
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // --- Notificaciones push: registrar/dar de baja el token del dispositivo ---
    Route::post('/device-tokens', [DeviceTokenController::class, 'store']);
    Route::delete('/device-tokens', [DeviceTokenController::class, 'destroy']);

    // --- Catálogo público (cliente): explorar negocios y ver productos ---
    Route::get('/tipos-negocio', [CatalogoController::class, 'tiposNegocio']);
    // Tipos globales de producto (Comida, Medicamento...) con la config del
    // formulario de creación (atributos y sugerencias).
    Route::get('/tipos-producto', [CatalogoController::class, 'tiposProducto']);
    Route::get('/negocios', [CatalogoController::class, 'index']);
    // Búsqueda de productos (por relevancia) con el negocio que los vende.
    Route::get('/productos', [CatalogoController::class, 'buscarProductos']);

    // --- Mis negocios (modelo unificado) ---
    // Cualquier usuario puede crear negocios y trabajar en otros. No hay
    // middleware de rol: cada controlador autoriza contra la membresía
    // (negocio_user) del {negocio} de la ruta.
    // Va ANTES de /negocios/{id} para que "mios" no se tome como un id.
    Route::get('/negocios/mios', [NegocioController::class, 'index']);
    Route::get('/negocios/mios/{negocio}', [NegocioController::class, 'show'])->whereNumber('negocio');
    Route::post('/negocios', [NegocioController::class, 'store']);

    // Catálogo público de UN negocio (cliente).
    Route::get('/negocios/{id}', [CatalogoController::class, 'show'])->whereNumber('id');

    Route::prefix('negocios/{negocio}')->whereNumber('negocio')->group(function () {
        // Datos del negocio: solo el propietario los edita.
        Route::put('/', [NegocioController::class, 'update']);

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

        // Pedidos recibidos por el negocio (?grupo= para el historial).
        Route::get('/pedidos', [ComercioPedidoController::class, 'index']);
        Route::get('/pedidos/resumen', [ComercioPedidoController::class, 'resumen']);
        Route::get('/pedidos/{id}', [ComercioPedidoController::class, 'show'])->whereNumber('id');
        Route::put('/pedidos/{id}/listo', [ComercioPedidoController::class, 'marcarListo']);
        // Rechazar (pendiente) o cancelar (listo sin domiciliario), con motivo.
        Route::put('/pedidos/{id}/cancelar', [ComercioPedidoController::class, 'cancelar']);
        // Efectivo: ¿el domiciliario entregó el dinero? (afecta su confiabilidad).
        Route::put('/pedidos/{id}/dinero', [ComercioPedidoController::class, 'confirmarDinero']);

        // Nivel de confiabilidad del negocio y sus últimos eventos.
        Route::get('/reputacion', [NegocioController::class, 'reputacion']);

        // Equipo: miembros e invitaciones por código público.
        Route::get('/miembros', [TrabajadorController::class, 'miembros']);
        Route::post('/resolver-codigo', [TrabajadorController::class, 'resolverCodigo']);
        Route::post('/invitar', [TrabajadorController::class, 'invitar']);
        Route::delete('/invitaciones/{id}', [TrabajadorController::class, 'cancelarInvitacion']);
        Route::delete('/miembros/{userId}', [TrabajadorController::class, 'quitarMiembro']);
        Route::post('/salir', [TrabajadorController::class, 'salir']);
    });

    // --- Invitaciones de trabajo recibidas (lado del invitado) ---
    Route::get('/invitaciones', [InvitacionController::class, 'index']);
    Route::put('/invitaciones/{id}/aceptar', [InvitacionController::class, 'aceptar']);
    Route::put('/invitaciones/{id}/rechazar', [InvitacionController::class, 'rechazar']);

    // --- Pedidos del cliente ---
    Route::get('/cliente/direcciones', [ClienteDireccionController::class, 'index']);
    Route::post('/cliente/direcciones', [ClienteDireccionController::class, 'store']);
    Route::post('/pedidos', [ApiPedidoController::class, 'store']);
    Route::get('/pedidos', [ApiPedidoController::class, 'index']);
    Route::get('/pedidos/{id}', [ApiPedidoController::class, 'show']);
    // Cancelar mientras el negocio no lo tenga listo.
    Route::post('/pedidos/{id}/cancelar', [ApiPedidoController::class, 'cancelar']);
    // Tarifa de domicilio vigente (para mostrar el total en el checkout).
    Route::get('/ajustes', [\App\Http\Controllers\Api\AjusteController::class, 'publicos']);
    // Al terminar: ¿el negocio y el domiciliario cumplieron? (reputación).
    Route::post('/pedidos/{id}/calificacion', [ApiPedidoController::class, 'calificar']);

    // --- Zona del ADMINISTRADOR ---
    Route::middleware('role:administrador')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);
        Route::get('/usuarios', [AdminController::class, 'usuarios']);
        Route::post('/usuarios', [AdminController::class, 'storeUsuario']);
        Route::put('/usuarios/{usuario}/rol', [AdminController::class, 'updateRol']);
        Route::get('/negocios', [AdminController::class, 'negocios']);
        // Tarifa de domicilio (aplica a los pedidos nuevos).
        Route::put('/ajustes', [\App\Http\Controllers\Api\AjusteController::class, 'actualizar']);
        // Barrios sugeridos por clientes (aprobar → entra a la lista pública).
        Route::get('/barrios/pendientes', [BarrioController::class, 'pendientes']);
        Route::put('/barrios/{id}/aprobar', [BarrioController::class, 'aprobar']);
        Route::delete('/barrios/{id}', [BarrioController::class, 'rechazar']);
        // Confiabilidad de domiciliarios y negocios: vetados, en riesgo, eventos.
        Route::get('/reputacion', [AdminReputacionController::class, 'index']);
        Route::get('/reputacion/{tipo}/{id}', [AdminReputacionController::class, 'show'])
            ->whereIn('tipo', ['negocio', 'domiciliario'])->whereNumber('id');
        Route::put('/reputacion/eventos/{id}/anular', [AdminReputacionController::class, 'anular']);
        Route::put('/reputacion/{tipo}/{id}/levantar-veto', [AdminReputacionController::class, 'levantarVeto'])
            ->whereIn('tipo', ['negocio', 'domiciliario'])->whereNumber('id');
        // Veto manual (sin importar el puntaje); se quita con levantar-veto.
        Route::put('/reputacion/{tipo}/{id}/suspender', [AdminReputacionController::class, 'suspender'])
            ->whereIn('tipo', ['negocio', 'domiciliario'])->whereNumber('id');
    });

    // --- Zona del DOMICILIARIO (pedidos) ---
    Route::middleware('role:domiciliario')->prefix('domiciliario')->group(function () {
        Route::get('/disponibles', [ApiDomiciliarioController::class, 'disponibles']);
        Route::get('/entregas', [ApiDomiciliarioController::class, 'entregas']);
        Route::get('/historial', [ApiDomiciliarioController::class, 'historial']);
        Route::get('/reputacion', [ApiDomiciliarioController::class, 'reputacion']);
        // Justificar una demora (lluvia, tráfico...) de una entrega en curso.
        Route::put('/pedidos/{id}/novedad', [ApiDomiciliarioController::class, 'novedad']);
        Route::put('/pedidos/{id}/tomar', [ApiDomiciliarioController::class, 'tomar']);
        Route::put('/pedidos/{id}/recogido', [ApiDomiciliarioController::class, 'recogido']);
        Route::put('/pedidos/{id}/en-camino', [ApiDomiciliarioController::class, 'enCamino']);
        Route::put('/pedidos/{id}/entregado', [ApiDomiciliarioController::class, 'entregado']);
    });
});
