<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminPedidoController;
use App\Http\Controllers\Api\AdminReputacionController;
use App\Http\Controllers\Api\AdminResenaController;
use App\Http\Controllers\Api\AjusteController;
use App\Http\Controllers\Api\BarrioController;
use App\Http\Controllers\Api\CarritoController;
use App\Http\Controllers\Api\CatalogoController;
use App\Http\Controllers\Api\CitaController;
use App\Http\Controllers\Api\ClienteDireccionController;
use App\Http\Controllers\Api\ComercioPedidoController;
use App\Http\Controllers\Api\CuentaController;
use App\Http\Controllers\Api\DeviceTokenController;
use App\Http\Controllers\Api\DomiciliarioController as ApiDomiciliarioController;
use App\Http\Controllers\Api\EnVivoController;
use App\Http\Controllers\Api\InvitacionController;
use App\Http\Controllers\Api\PedidoController as ApiPedidoController;
use App\Http\Controllers\Api\PedidoIncidenciaController;
use App\Http\Controllers\Api\PedidoReporteController;
use App\Http\Controllers\Api\RecetaPreferidaController;
use App\Http\Controllers\Api\RecuperarClaveController;
use App\Http\Controllers\Api\ResenaController;
use App\Http\Controllers\Api\TelefonoController;
use App\Http\Controllers\Api\TrabajadorController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoriaController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NegocioController;
use App\Http\Controllers\ProductoController;
use App\Http\Controllers\ServicioController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Los identificadores de las rutas son siempre números: /pedidos/abc responde
// 404 en vez de reventar en el controlador.
Route::pattern('id', '[0-9]{1,18}');
Route::pattern('userId', '[0-9]{1,18}');

// Rutas públicas de autenticación.
// Límites de intentos con nombre: ver AppServiceProvider::limitesDeIntentos().
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:acceso');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:acceso');

// "Olvidé mi contraseña": se envía un código de 6 dígitos al correo y con él
// se pone una contraseña nueva.
Route::post('/password/codigo', [RecuperarClaveController::class, 'enviarCodigo'])->middleware('throttle:codigo-clave');
Route::post('/password/restablecer', [RecuperarClaveController::class, 'restablecer'])->middleware('throttle:restablecer-clave');

// Registro con el celular: un código por WhatsApp confirma el número y
// devuelve el token `verificacion` que /register exige.
Route::post('/telefono/codigo', [TelefonoController::class, 'codigoRegistro'])->middleware('throttle:codigo-telefono');
Route::post('/telefono/verificar', [TelefonoController::class, 'verificarRegistro'])->middleware('throttle:verificar-telefono');

// Barrios aprobados de Maicao. Pública: el registro la necesita sin token.
Route::get('/barrios', [BarrioController::class, 'index'])->middleware('throttle:publico');

// Rutas que requieren un token Sanctum válido.
Route::middleware(['auth:sanctum', 'throttle:api-usuario'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Perfil personal del usuario logueado (cualquier rol).
    Route::put('/perfil', [AuthController::class, 'actualizarPerfil']);
    // Un cliente se vuelve domiciliario (sigue siendo cliente), o deja de serlo.
    // Verificar el celular desde Mi información (código por WhatsApp).
    Route::post('/perfil/telefono/codigo', [TelefonoController::class, 'codigoPerfil'])->middleware('throttle:codigo-telefono');
    Route::post('/perfil/telefono/verificar', [TelefonoController::class, 'verificarPerfil'])->middleware('throttle:verificar-telefono');
    Route::post('/perfil/domiciliario', [AuthController::class, 'hacerseDomiciliario']);
    Route::delete('/perfil/domiciliario', [AuthController::class, 'dejarDeSerDomiciliario']);
    // Eliminar mi cuenta (anonimiza; exige la contraseña).
    Route::delete('/cuenta', [CuentaController::class, 'destroy']);

    // Panel adaptativo: responde distinto según el rol del usuario logueado.
    // El frontend llama siempre aquí y pinta lo que reciba.
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // --- Cambios en vivo (WebSockets): canales que esta sesión debe escuchar ---
    Route::get('/en-vivo/canales', [EnVivoController::class, 'canales']);

    // --- Notificaciones push: registrar/dar de baja el token del dispositivo ---
    Route::post('/device-tokens', [DeviceTokenController::class, 'store']);
    Route::delete('/device-tokens', [DeviceTokenController::class, 'destroy']);

    // --- Catálogo público (cliente): explorar negocios y ver productos ---
    Route::get('/tipos-negocio', [CatalogoController::class, 'tiposNegocio']);
    // Tipos globales de producto (Comida, Medicamento...) con la config del
    // formulario de creación (atributos y sugerencias).
    Route::get('/tipos-producto', [CatalogoController::class, 'tiposProducto']);
    Route::get('/negocios', [CatalogoController::class, 'index']);
    // Negocios con su pin, para el mapa (sin paginar).
    Route::get('/negocios/mapa', [CatalogoController::class, 'mapa']);
    // Búsqueda de productos (por relevancia) con el negocio que los vende.
    Route::get('/productos', [CatalogoController::class, 'buscarProductos']);

    // --- Mis negocios (modelo unificado) ---
    // Cualquier usuario puede crear negocios y trabajar en otros. No hay
    // middleware de rol: cada controlador autoriza contra la membresía
    // (negocio_user) del {negocio} de la ruta.
    // Va ANTES de /negocios/{id} para que "mios" no se tome como un id.
    Route::get('/negocios/mios', [NegocioController::class, 'index']);
    // Pedidos sin aceptar de todos mis negocios: de aquí sale la alarma con la app abierta.
    Route::get('/negocios/mios/por-aceptar', [ComercioPedidoController::class, 'porAceptar']);
    // Cierres del horario automático que el dueño debe confirmar (20 min antes).
    Route::get('/negocios/mios/por-cerrar', [NegocioController::class, 'cierresPorConfirmar']);
    Route::put('/negocios/mios/{negocio}/cierre', [NegocioController::class, 'confirmarCierre'])->whereNumber('negocio');
    Route::get('/negocios/mios/{negocio}', [NegocioController::class, 'show'])->whereNumber('negocio');
    Route::post('/negocios', [NegocioController::class, 'store']);

    // Catálogo público de UN negocio (cliente).
    Route::get('/negocios/{id}', [CatalogoController::class, 'show'])->whereNumber('id');
    // Solo si está abierto: lo que la app refresca cada pocos segundos.
    Route::get('/negocios/{id}/estado', [CatalogoController::class, 'estado'])->whereNumber('id');
    // Lo que el cliente ya pidió varias veces con los mismos ajustes en esta tienda.
    Route::get('/negocios/{id}/recetas-preferidas', [RecetaPreferidaController::class, 'index'])->whereNumber('id');
    // Reseñas de la tienda o, con ?producto_id=, de uno de sus productos.
    Route::get('/negocios/{id}/resenas', [ResenaController::class, 'index'])->whereNumber('id');

    Route::prefix('negocios/{negocio}')->whereNumber('negocio')->group(function () {
        Route::get('/disponibilidad', [CitaController::class, 'disponibilidad']);
        Route::post('/solicitudes-cita', [CitaController::class, 'store']);
        Route::get('/citas', [CitaController::class, 'negocio']);
        Route::post('/citas', [CitaController::class, 'presencial']);
        Route::put('/citas/{id}', [CitaController::class, 'actualizar'])->whereNumber('id');
        Route::put('/citas/{id}/reasignar', [CitaController::class, 'reasignar']);
        Route::post('/citas/{id}/llegada', [CitaController::class, 'llegada'])->whereNumber('id');
        // Datos del negocio: solo el propietario los edita.
        Route::put('/', [NegocioController::class, 'update']);
        Route::delete('/', [NegocioController::class, 'destroy']);
        Route::put('/desactivacion', [NegocioController::class, 'desactivacion']);

        Route::get('/servicios', [ServicioController::class, 'index']);
        Route::post('/servicios', [ServicioController::class, 'store']);
        Route::put('/servicios/{id}', [ServicioController::class, 'update'])->whereNumber('id');
        Route::delete('/servicios/{id}', [ServicioController::class, 'destroy'])->whereNumber('id');

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
        // Aceptar un pedido: si nadie lo hace a tiempo, se cancela solo.
        Route::put('/pedidos/{id}/aceptar', [ComercioPedidoController::class, 'aceptar']);
        Route::put('/pedidos/{id}/listo', [ComercioPedidoController::class, 'marcarListo']);
        // El negocio confirma con el código que le dicta el domiciliario.
        Route::put('/pedidos/{id}/recogido', [ComercioPedidoController::class, 'recogido'])->middleware('throttle:codigo-pedido');
        // Rechazar (pendiente), cancelar lo aceptado o lo listo sin domiciliario, con motivo.
        Route::put('/pedidos/{id}/cancelar', [ComercioPedidoController::class, 'cancelar']);
        Route::put('/pedidos/{id}/faltante', [PedidoIncidenciaController::class, 'faltante']);
        Route::put('/pedidos/{id}/devolucion', [PedidoIncidenciaController::class, 'devolucion']);
        // Efectivo: ¿el domiciliario entregó el dinero? (afecta su confiabilidad).
        Route::put('/pedidos/{id}/dinero', [ComercioPedidoController::class, 'confirmarDinero']);

        // Nivel de confiabilidad del negocio y sus últimos eventos.
        Route::get('/reputacion', [NegocioController::class, 'reputacion']);

        // Equipo: miembros e invitaciones por código público.
        Route::get('/miembros', [TrabajadorController::class, 'miembros']);
        Route::post('/resolver-codigo', [TrabajadorController::class, 'resolverCodigo']);
        Route::post('/invitar', [TrabajadorController::class, 'invitar']);
        Route::delete('/invitaciones/{id}', [TrabajadorController::class, 'cancelarInvitacion']);
        Route::put('/miembros/{userId}/permisos', [TrabajadorController::class, 'actualizarPermisos']);
        Route::delete('/miembros/{userId}', [TrabajadorController::class, 'quitarMiembro']);
        Route::post('/salir', [TrabajadorController::class, 'salir']);
    });

    // --- Invitaciones de trabajo recibidas (lado del invitado) ---
    Route::get('/invitaciones', [InvitacionController::class, 'index']);
    Route::put('/invitaciones/{id}/aceptar', [InvitacionController::class, 'aceptar']);
    Route::put('/invitaciones/{id}/rechazar', [InvitacionController::class, 'rechazar']);

    // --- Pedidos del cliente ---
    Route::get('/citas', [CitaController::class, 'index']);
    Route::post('/citas/{id}/cancelar', [CitaController::class, 'cancelar'])->whereNumber('id');
    Route::put('/citas/{id}/reprogramar', [CitaController::class, 'reprogramar'])->whereNumber('id');
    Route::get('/cliente/direcciones/{id}/fotos/{tipo}', [ClienteDireccionController::class, 'foto']);
    Route::get('/pedidos/{id}/fotos-entrega/{tipo}', [ApiPedidoController::class, 'fotoEntrega']);
    Route::get('/cliente/direcciones', [ClienteDireccionController::class, 'index']);
    Route::post('/cliente/direcciones', [ClienteDireccionController::class, 'store']);
    Route::put('/cliente/direcciones/{id}', [ClienteDireccionController::class, 'update']);
    Route::put('/cliente/direcciones/{id}/principal', [ClienteDireccionController::class, 'principal']);
    Route::delete('/cliente/direcciones/{id}', [ClienteDireccionController::class, 'destroy']);
    Route::post('/pedidos', [ApiPedidoController::class, 'store']);
    Route::put('/carrito', [CarritoController::class, 'actualizar']);
    Route::get('/pedidos', [ApiPedidoController::class, 'index']);
    Route::get('/pedidos/{id}', [ApiPedidoController::class, 'show']);
    // Cancelar mientras el negocio no lo tenga listo.
    Route::post('/pedidos/{id}/cancelar', [ApiPedidoController::class, 'cancelar']);
    Route::put('/pedidos/{id}/ajuste', [PedidoIncidenciaController::class, 'ajustar']);
    Route::post('/pedidos/{id}/reporte', [PedidoReporteController::class, 'store']);
    // Tarifa de domicilio vigente (para mostrar el total en el checkout).
    Route::get('/ajustes', [AjusteController::class, 'publicos']);
    // Al terminar: ¿el negocio y el domiciliario cumplieron? (reputación).
    Route::post('/pedidos/{id}/calificacion', [ApiPedidoController::class, 'calificar']);
    // Estrellas y comentario públicos de la tienda y de lo que compró.
    Route::post('/pedidos/{id}/resenas', [ResenaController::class, 'guardar']);
    // Cualquier usuario reporta una reseña; el propietario responde una vez.
    Route::post('/resenas/{id}/reporte', [ResenaController::class, 'reportar'])->whereNumber('id');
    Route::post('/resenas/{id}/respuesta', [ResenaController::class, 'responder'])->whereNumber('id');

    // --- Zona del ADMINISTRADOR ---
    Route::middleware('role:administrador')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);
        Route::get('/usuarios', [AdminController::class, 'usuarios']);
        Route::post('/usuarios', [AdminController::class, 'storeUsuario']);
        Route::put('/usuarios/{usuario}/rol', [AdminController::class, 'updateRol']);
        // Bloquear / desbloquear una cuenta (no puede iniciar sesión).
        Route::put('/usuarios/{usuario}/suspender', [AdminController::class, 'suspender']);
        Route::put('/usuarios/{usuario}/reactivar', [AdminController::class, 'reactivar']);
        Route::get('/negocios', [AdminController::class, 'negocios']);
        // Pedidos en curso y cierre manual de los que se atascan.
        Route::get('/pedidos', [AdminPedidoController::class, 'index']);
        Route::get('/reportes', [PedidoReporteController::class, 'index']);
        Route::put('/reportes/{id}/resolver', [PedidoReporteController::class, 'resolver']);
        Route::put('/pedidos/{id}/cerrar', [AdminPedidoController::class, 'cerrar']);
        // Mapa: dónde están los domiciliarios que reportaron su posición hace poco.
        Route::get('/mapa/domiciliarios', [AdminController::class, 'mapaDomiciliarios']);
        // Tarifa de domicilio (aplica a los pedidos nuevos).
        Route::put('/ajustes', [AjusteController::class, 'actualizar']);
        // Barrios sugeridos por clientes (aprobar → entra a la lista pública).
        Route::get('/barrios/pendientes', [BarrioController::class, 'pendientes']);
        Route::put('/barrios/{id}/aprobar', [BarrioController::class, 'aprobar']);
        Route::delete('/barrios/{id}', [BarrioController::class, 'rechazar']);
        // Confiabilidad de domiciliarios y negocios: vetados, en riesgo, eventos.
        Route::get('/resenas', [AdminResenaController::class, 'index']);
        Route::put('/resenas/{id}/ocultar', [AdminResenaController::class, 'ocultar'])->whereNumber('id');
        Route::put('/resenas/{id}/restaurar', [AdminResenaController::class, 'restaurar'])->whereNumber('id');
        Route::put('/resenas/{id}/descartar-reportes', [AdminResenaController::class, 'descartarReportes'])->whereNumber('id');
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
        // Entrar / salir de turno (solo en turno llegan los avisos de pedidos).
        Route::put('/turno', [ApiDomiciliarioController::class, 'turno']);
        // Mi posición (GPS) para el mapa, cada pocos segundos en turno o en una entrega.
        Route::put('/ubicacion', [ApiDomiciliarioController::class, 'ubicacion'])->middleware('throttle:ubicacion');
        Route::get('/reputacion', [ApiDomiciliarioController::class, 'reputacion']);
        // Justificar una demora (lluvia, tráfico...) de una entrega en curso.
        Route::put('/pedidos/{id}/ocupado', [ApiDomiciliarioController::class, 'ocupado']);
        Route::put('/pedidos/{id}/novedad', [ApiDomiciliarioController::class, 'novedad']);
        Route::put('/pedidos/{id}/tomar', [ApiDomiciliarioController::class, 'tomar']);
        // Devolver un pedido tomado: solo antes de recogerlo.
        Route::put('/pedidos/{id}/soltar', [ApiDomiciliarioController::class, 'soltar']);
        Route::put('/pedidos/{id}/en-camino', [ApiDomiciliarioController::class, 'enCamino']);
        Route::put('/pedidos/{id}/llegada', [ApiDomiciliarioController::class, 'llegada']);
        Route::put('/pedidos/{id}/cliente-no-encontrado', [ApiDomiciliarioController::class, 'clienteNoEncontrado']);
        // Se confirma con el código que le da el cliente.
        Route::put('/pedidos/{id}/entregado', [ApiDomiciliarioController::class, 'entregado'])->middleware('throttle:codigo-pedido');
    });
});
