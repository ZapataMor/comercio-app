---
title: Estado Actual
tags: [inicio, estado, producto]
estado: en-progreso
actualizado: 2026-10-28
---

# 📊 Estado Actual

> Snapshot vivo e **inventario completo** de funcionalidades de Vitrina, de lo mínimo a lo
> notable, derivado del código real (`backend/` y `frontend/`) el **2026-10-28**. Sirve para
> refrescar la memoria tras un tiempo sin desarrollar. El changelog técnico detallado vive en
> `backend/ESTADO_DEL_PROYECTO.md`.

> [!info] Cómo leer esta nota
> ✅ hecho y verificado en el código · 🚧 a medias (existe código pero no está cerrado) ·
> ⏳ pendiente. Cada sección cierra con la lista de rutas de API y pantallas para ubicarse rápido.

## 🎯 Foco actual
**Fase: listo para piloto.** La revisión general del 2026-10-28 cerró P1 (pedidos cancelables,
costo de domicilio, historial y ventas del negocio, contacto, cuentas y preparación para
producción) y P2 (carrito persistente, turno del domiciliario, suspensión de cuentas, horario de
los negocios, refresco eficiente y paginación). Lo que sigue **no es código**: elegir hosting y
dominio, montar el servidor y publicar en Play Store (`DESPLIEGUE.md`), y luego iOS.

---

## 0. Qué es la app en una frase

**Vitrina** (repo `comercio-api`) es un marketplace de comercio local para **Maicao** con
domicilios: los negocios publican su catálogo, los clientes piden desde la app, el negocio
prepara y un domiciliario entrega. Ver [[Pitch]] y [[Propuesta de Valor]].

## 1. Arquitectura y stack

| Capa           | Tecnología                                                                           | Dónde                                                               |
| -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| API REST       | Laravel 13 · PHP 8.4 · MySQL (`comercio_api`)                                        | `backend/`                                                          |
| Auth API       | Sanctum (tokens) · Spatie Permission (roles)                                         | `backend/app/Http/Controllers/AuthController.php`                   |
| Web (solo admin) | Blade + Tailwind CDN, login por sesión; + páginas públicas `/privacidad` y `/eliminar-cuenta` | `backend/routes/web.php`, `resources/views`                     |
| App móvil      | React Native 0.86 · TypeScript · React Navigation (native stack)                     | `frontend/`                                                         |
| Push           | Firebase Cloud Messaging + Notifee (app) · `laravel-notification-channels/fcm` (API) | `frontend/src/pushNotifications.ts`, `backend/app/Support/Push.php` |
| Tests          | Pest (SQLite en memoria) — 145 tests · Jest (app) — 6 tests                          | `backend/tests/Feature`, `frontend/__tests__`                       |
| Cola y tareas  | `queue:work` (push en cola) y `schedule:work` / cron (horarios)                      | `iniciar-dev.bat`, `routes/console.php`                             |
| Docs de API    | Postman (`backend/postman/`) y `backend/api.http` (REST Client)                      |                                                                     |

- La app apunta a `http://10.0.2.2:8000` (emulador) en desarrollo y a `API_URL_PRODUCCION`
  (HTTPS) en la versión final, en `frontend/src/config.ts`. Despliegue: `DESPLIEGUE.md`.
- Zona horaria del backend: `America/Bogota`.
- Nombre técnico del paquete Android: `com.comercioapp`; marca visible: **Vitrina**.
- Convención: la API responde JSON en `api/*`, mensajes de validación en **español**
  (`backend/lang/es/`).

---

## 2. Cuentas, roles y sesión

### 2.1 Roles (Spatie) ✅
`administrador` · `usuario` (cliente) · `domiciliario`. Ver [[Mapa de Actores]].
El rol `comerciante` **se eliminó el 2026-10-28**: tener un negocio lo decide la membresía.

- Registro público solo crea `usuario` (ver 2.2). `administrador` y `domiciliario` los asigna un admin.
- La navegación de la app se decide por rol en `frontend/App.tsx`: el cliente aterriza en
  **Explorar**; los demás roles en **Home** (menú por rol).

### 2.2 Registro ✅ (con 🚧 de transición)
`POST /api/register` (throttle 6/min). Pide **nombre, email, contraseña (+confirmación),
dirección, barrio y teléfono**. Al crear:
- asigna rol `usuario`,
- genera un **código público** único tipo `U34F4D` (ver 6.2),
- guarda la dirección como **ubicación principal** del cliente (`cliente_direcciones`),
- si el barrio no está en el catálogo lo registra como **sugerencia pendiente** (ver 4.5).

- exige **aceptar la política de privacidad** (casilla con enlace; Ley 1581) y guarda
  `terminos_aceptados_at`.

### 2.3 Login / logout / sesión ✅
- `POST /api/login` (throttle 6/min) → token Sanctum + payload del usuario (roles, dirección,
  barrio, teléfono, `codigo_publico`, lista de `negocios` donde es miembro con su rol).
- `POST /api/logout` revoca **solo** el token usado; la app además da de baja el token FCM.
- Sesión **persistente** en la app (`AuthContext` + AsyncStorage): no vuelve a pedir login.
- Mensaje genérico en credenciales inválidas (no revela si el email existe).
- **¿Olvidaste tu contraseña?** ✅ código de 6 dígitos por correo (`/api/password/codigo` y
  `/restablecer`): vence en 15 min, se anula tras 5 fallos y cierra las otras sesiones.
- **Cuenta suspendida** ✅ por un admin: no inicia sesión y sus sesiones se cierran solas.
- Límites de intentos por ruta y por correo (no se mezclan entre login y recuperar contraseña).

### 2.4 Perfil personal ✅
`PUT /api/perfil` y pantalla **Mi perfil** (`PerfilScreen`, accesible desde el botón de la
topbar en todos los roles). Edita nombre, email, contraseña (exige la actual), dirección,
barrio y teléfono. Para clientes esos tres últimos son obligatorios y se sincronizan con su
dirección principal. Aquí también están **Privacidad** (abre `/privacidad`), **Cerrar sesión** y
**Eliminar mi cuenta** ✅ (pide la contraseña; anonimiza los datos y conserva el historial de
pedidos sin datos de contacto; archiva los negocios donde era el único dueño; no deja si hay
pedidos en curso). También se puede desde la web pública `/eliminar-cuenta`.

### 2.5 Dashboard adaptativo ✅
`GET /api/dashboard` devuelve título/menú/acciones según el rol (o según si es miembro de
algún negocio). La app hoy no depende de él para navegar, pero existe.

**Rutas:** `/api/register`, `/api/login`, `/api/logout`, `/api/user`, `/api/perfil`, `/api/dashboard`.
**Pantallas:** `LoginScreen`, `RegisterScreen`, `PerfilScreen`, `HomeScreen`.

---

## 3. Lado del negocio (comerciante)

### 3.1 Mi negocio ✅
- Crear / ver / editar: nombre, descripción, dirección, teléfono, **imagen** (máx 4 MB, se
  guarda en `storage/public/negocios`) y **tipos de negocio** (uno o varios: Panadería,
  Droguería, Restaurante…; se crean al vuelo si no existen).
- **Switch Abierto/Cerrado** en la topbar del Inicio (campo `activo`). Cerrado = no recibe
  pedidos (el cliente lo ve pero con etiqueta "cerrado" y ordenado al final).
- `NegocioContext` centraliza el estado del negocio (switch, tarjeta del Inicio, Mi Tienda)
  con actualización optimista y reversión si falla.
- Pantalla **Mi Tienda**: tarjeta de solo lectura + "Editar información"; el formulario solo
  aparece al crear/editar. Al crear el negocio redirige al Inicio.

### 3.2 Catálogo: productos ✅
- CRUD completo con **aislamiento por negocio** (nadie ve/edita productos ajenos).
- Campos: nombre, descripción, **precio** (solo dígitos, COP), **unidad de venta**
  (dropdown Cantidad / Kilos / Libras → `tipo_venta` + `unidad_medida`), **disponible**,
  **imagen**, **categoría** (opcional), **tipo de producto** y **atributos**.
- `precio_formateado` listo para pintar: `"$8.900 / kg"`, `"$2.500 c/u"`.
  Ver [[Tipos de Venta]].
- **Soft deletes**: borrar oculta pero conserva el historial de pedidos.
- Listado con búsqueda (`?buscar`), filtros (`?categoria_id`, `?disponible`, `?sin_categoria=1`)
  y paginación (`?por_pagina`, máx 100).
- Pantalla **Productos** (`MisProductosScreen`): lista de todo el catálogo + botón
  "Añadir producto"; el formulario es un **modal deslizable** (se cierra arrastrando la barra
  de agarre hacia abajo, con rebote si no alcanza el umbral).

### 3.3 Tipos de producto y atributos ✅ (notable)
Tabla global `tipos_producto` (sembrada por migración, no la crea el comerciante):
**Comida** (Ingredientes) · **Medicamento** (¿Para qué sirve? + sugerencias: gripa, fiebre…) ·
**Herramienta** (¿Para qué se usa?) · **Ropa y calzado** (tallas XS–XXL) · **Tecnología**
(Características) · **Belleza y aseo** · **Otro** (Etiquetas).

- Cada tipo define la pregunta, el texto del botón y **chips sugeridos**; el componente
  `ListaAtributos` combina chips marcados + casillas libres.
- Los atributos se guardan como JSON en `productos.atributos` y **entran en la búsqueda del
  cliente** ("gripa" encuentra el medicamento, "pollo" el plato). Obligatorio al crear
  productos nuevos; nullable en los antiguos.

### 3.4 Categorías del catálogo ✅
CRUD por negocio, nombre único por negocio, con **conteo de productos**. En la app ya no hay
pantalla de categorías: se asignan desde el formulario de producto (la pantalla
`MisCategoriasScreen` se eliminó en el commit `64aac35`).

### 3.5 Pedidos recibidos ✅
- El **Inicio** del comerciante lista los **pedidos en espera** y los refresca cada pocos
  segundos; cada uno abre `ComercioPedidoDetalle` (cliente, dirección, teléfono, pago, ítems)
  con el botón **"Marcar listo"**.
- Marcar listo (`pendiente → listo`) avisa por push a los domiciliarios **en turno** y al
  cliente; la respuesta dice cuántos domiciliarios había en turno.
- Solo pedidos del propio negocio y solo si están pendientes (409 si no).
- **Rechazar / cancelar** ✅ con motivo (chips sugeridos): pendiente = rechazar; listo sin
  domiciliario = cancelar ("nadie lo tomó"). Push `PedidoCancelado` al cliente.
- **Pedidos y ventas** ✅ (`PedidosNegocioScreen`): pestañas En espera / En curso / Entregados /
  Cancelados (20 por página) y resumen de **hoy** (pedidos, entregados, cancelados y lo vendido =
  subtotal entregado, sin domicilios).
- **Contacto** ✅: Llamar / WhatsApp al cliente y, mientras lo lleva, al domiciliario.

### 3.6 Horario del negocio ✅ (2026-10-28)
Horario semanal (lun..dom, o "no abre") en Mi Tienda (`EditorHorario`). La tarea
`negocios:aplicar-horario` (cada minuto) abre y cierra a esas horas; si el dueño usa el switch
a mano, se respeta hasta la siguiente hora del horario. Soporta horarios que pasan la
medianoche (18:00 → 02:00). El cliente ve "Hoy de 7:00 a. m. a 8:00 p. m." en Explorar y en la
tienda.

**Rutas (prefijo `/api/negocios/{negocio}`, autoriza la membresía):** `PUT /`,
`GET/POST /productos`, `GET/PUT/DELETE /productos/{id}`, `GET/POST /categorias`,
`PUT/DELETE /categorias/{id}`, `GET /pedidos[?grupo=]`, `GET /pedidos/resumen`,
`GET /pedidos/{id}`, `PUT /pedidos/{id}/listo|cancelar|dinero`. Público: `GET /api/tipos-producto`.
**Pantallas:** `HomeScreen` (Inicio del negocio), `MiTiendaScreen`, `MisProductosScreen`,
`PedidosNegocioScreen`, `ComercioPedidoDetalleScreen`.

---

## 4. Lado del cliente

### 4.1 Explorar negocios ✅
- `GET /api/negocios` lista **todos** los negocios (abiertos primero, luego alfabético),
  paginados de 50 en 50 con **scroll infinito** en la app, con nº de productos disponibles,
  imagen, tipos y estado abierto/cerrado.
- Filtro por **tipo de negocio** (`?tipo_negocio_id`, chips en la app alimentados por
  `GET /api/tipos-negocio`, que solo devuelve tipos con negocios).
- Búsqueda de negocios (`?buscar`): por nombre/descripción del negocio, tipo de negocio, o por
  tener productos disponibles que coincidan (nombre, atributos o categoría).
- Tarjeta de negocio **expandible**: al tocarla muestra imagen y "Entrar a la tienda"; solo
  una abierta a la vez.
- Pull-to-refresh y debounce de 350 ms en la caja de búsqueda.

### 4.2 Búsqueda de productos por relevancia ✅ (notable)
`GET /api/productos?buscar=` devuelve hasta 50 productos disponibles con su negocio,
ordenados por **relevancia**: negocios abiertos primero → nombre exacto → empieza por →
contiene → coincidencia en descripción/atributos/categoría → alfabético. En la app, escribir
texto cambia la lista de negocios por **tarjetas de producto**; tocar una entra al negocio y
**hace scroll hasta ese producto resaltado**.

### 4.3 Catálogo de un negocio ✅
`GET /api/negocios/{id}`: datos del negocio + productos disponibles. `NegocioScreen` los
agrupa **por categoría** y muestra el botón **"Pedir"** en cada producto.

### 4.4 Carrito y checkout ✅
- Carrito **guardado en el teléfono, uno por cuenta** (`CartContext` + AsyncStorage; sobrevive a
  cerrar la app), regla **un carrito = un negocio**: si agregas de otra tienda, pregunta
  "vaciar y agregar".
- **Costo de domicilio** ✅: tarifa única que fija el admin (4.000 por defecto). El pedido guarda
  `subtotal` + `costo_domicilio` = `total`; Checkout y seguimiento muestran el desglose.
- Animación **"paquete al carrito"** (`FlyToCart`): al tocar Pedir, un paquetito vuela en
  parábola hasta el botón flotante, que rebota y cuyo contador late. Ver
  [[Propuesta - Animaciones y microinteracciones]].
- **Barra flotante inferior** del cliente (`BarraCliente`): Carrito + Mis pedidos, fija en
  Explorar/Negocio; se oculta en Carrito, Checkout y Mis pedidos.
- Pantalla Carrito: cambiar cantidades, quitar, vaciar (con confirmación).
- **Checkout**: dirección (con selector de barrio), teléfono (precargado del perfil),
  forma de pago **efectivo / transferencia**. Puede usar una de sus **direcciones
  guardadas** (`GET/POST /api/cliente/direcciones`) o escribir otra.
- `POST /api/pedidos` valida que el negocio esté abierto y que todos los ítems sean productos
  disponibles **de ese negocio**; copia nombre y precio al momento del pedido; calcula el
  total en el servidor; si el cliente no tenía teléfono, lo guarda en su perfil; avisa por
  push a **todo el equipo** del negocio.
- Tras confirmar, la pila de navegación se **rearma** (Explorar → Negocio → Mis pedidos) para
  que "atrás" no vuelva al formulario.

### 4.5 Barrios de Maicao ✅ (notable)
- Catálogo oficial sembrado por comunas (`BarriosSeeder`), público en `GET /api/barrios`
  (sin token, se usa en el registro).
- Componente `BarrioSelect`: elige de la lista o **escribe uno nuevo** → queda como sugerencia
  `aprobado=false` que solo ese usuario ve hasta que el admin la apruebe (ver 5.3).

### 4.6 Seguimiento de pedidos ✅
`GET /api/pedidos` (mis pedidos) y `GET /api/pedidos/{id}` (detalle con `estados`,
`estado_index`, ítems, domiciliario, minutos de recogida). `PedidoDetalleScreen` pinta la
**línea de tiempo** de estados y se refresca al llegar un push y cada 15 s. Ver [[Lógica de Negocio]].
- **Cancelar mi pedido** ✅ mientras esté pendiente (con motivo opcional; avisa al negocio). Si
  se cancela (cualquiera de los dos), se ve "Pedido cancelado" con quién y por qué.
- **Contacto** ✅: Llamar / WhatsApp al negocio, y al domiciliario mientras lo lleva.
- Mis pedidos: 20 por página con scroll infinito.

**Rutas:** `/api/negocios`, `/api/negocios/{id}`, `/api/productos`, `/api/tipos-negocio`,
`/api/barrios`, `/api/cliente/direcciones`, `/api/pedidos`, `/api/pedidos/{id}`.
**Pantallas:** `ExplorarScreen`, `NegocioScreen`, `CarritoScreen`, `CheckoutScreen`,
`MisPedidosScreen`, `PedidoDetalleScreen`.

---

## 5. Lado del domiciliario y del administrador

### 5.1 Domiciliario ✅
- `GET /disponibles` (pedidos en `listo`), `GET /entregas` (los míos en curso),
  `GET /historial` (entregados).
- **Tomar** un pedido indicando **minutos de recogida** (`listo → tomado`; update condicional
  anti-choque: si dos lo toman a la vez, solo uno gana).
- Avanzar: `recogido → en_camino → entregado`. Cada cambio avisa por push al cliente.
- `DomiciliarioScreen` con las tres listas y pull-to-refresh; historial de 20 en 20 ("Ver más").
- **Turno** ✅: switch En turno / Fuera de turno; solo en turno llegan los avisos de pedidos listos.
- Ve **cuánto cobrar** (efectivo) y el domicilio; Llamar / WhatsApp al negocio antes de recoger
  y al cliente después (el teléfono del cliente solo aparece cuando el pedido es suyo).

### 5.2 Administrador ✅
- `GET /admin/stats` (usuarios, negocios, abiertos, productos) → `AdminTableroScreen`.
- `GET /admin/usuarios?rol=` (pestañas por tipo con conteo), `POST /admin/usuarios` (crear con
  rol), `PUT /admin/usuarios/{id}/rol` con **salvaguarda**: el admin no puede quitarse su
  propio rol → `AdminUsuariosScreen`.
- `GET /admin/negocios` (dueño, productos, abierto/cerrado/vetado/archivado) → `AdminNegociosScreen`.
- Usuarios y negocios con **buscador y 30 por página**.
- **Suspender / reactivar cuentas** ✅ (`PUT /admin/usuarios/{id}/suspender|reactivar`, con motivo).
- **Tarifa de domicilio** ✅ editable en el Tablero (`PUT /admin/ajustes`).

### 5.3 Moderación de barrios ✅
`GET /admin/barrios/pendientes`, `PUT /admin/barrios/{id}/aprobar` (entra a la lista pública),
`DELETE /admin/barrios/{id}` (se descarta; el cliente conserva su texto) →
`AdminBarriosScreen`.

**Rutas:** prefijos `/api/domiciliario` (`role:domiciliario`) y `/api/admin`
(`role:administrador`).

---

## 6. Modelo unificado y equipos de trabajo 🚧 (lo más reciente — commit `9430ede`, 2026-09-11)

Cambio de fondo: **ya no existe "el comerciante" como tipo de cuenta**. Toda persona es cliente
y puede **tener varios negocios** y además **trabajar en otros**. El acceso se decide por
**membresía** (`negocio_user`, rol `propietario` | `trabajador`, con `activo` para suspender
sin borrar historial), no por el rol global.

### 6.1 Lo que ya existe en el backend ✅
- Migración `create_membresias_negocio`: tablas `negocio_user` e `invitaciones_trabajo`,
  columna `users.codigo_publico`, y **backfill** (cada dueño actual pasa a propietario; cada
  usuario recibe código).
- `Negocio::miembros()/miembrosActivos()/esMiembroActivo()/esPropietario()`; al crear un negocio
  su creador queda como propietario automáticamente.
- `User::negocios()/negociosActivos()/invitacionesTrabajo()`.
- Controladores reescritos para recibir **`{negocio}` en la ruta** y validar membresía:
  `NegocioController` (ahora con `index` = "Mis negocios"), `ProductoController`,
  `CategoriaController`, `ComercioPedidoController` (cualquier miembro activo puede marcar
  listo; solo el propietario edita el negocio).
- `TrabajadorController`: resolver código → nombre (previsualizar), listar miembros e
  invitaciones pendientes, **invitar por código**, cancelar invitación, quitar trabajador
  (nunca a un propietario), **salir** del negocio.
- `InvitacionController`: mis invitaciones pendientes, **aceptar** (crea la membresía) o
  **rechazar**.
- Notificación push `InvitacionTrabajoRecibida`.
- `PedidoController@store` avisa a todos los miembros activos; `DashboardController` da panel
  de negocio a quien sea miembro de alguno.

### 6.2 Regla de privacidad del código público
La app **no permite buscar personas**. El flujo es: el trabajador comparte su código
(`#U34F4D`, alfabeto sin 0/O/1/I/L) fuera de la app → el propietario lo ingresa → ve el nombre
para confirmar → se crea la invitación **pendiente** → el invitado recibe push → **solo al
aceptar** entra al negocio. El código nunca sirve para autenticarse.

### 6.3 Cierre del cambio (2026-10-02)
- [x] **Rutas API** sin middleware de rol: `GET /api/negocios/mios`,
      `GET /api/negocios/mios/{negocio}`, `POST /api/negocios`, `PUT /api/negocios/{negocio}`,
      `/api/negocios/{negocio}/productos|categorias|pedidos|miembros`,
      `POST /api/negocios/{negocio}/resolver-codigo|invitar|salir`,
      `DELETE /api/negocios/{negocio}/invitaciones/{id}|miembros/{userId}`,
      `GET /api/invitaciones`, `PUT /api/invitaciones/{id}/aceptar|rechazar`.
      Las `/comerciante/*` se eliminaron (devolvían 403 "No tienes acceso a este negocio" a todos).
- [x] **App móvil**: `api.ts` con `negocioId`; `NegocioContext` con lista de negocios y
      **negocio activo** (persistido); pantallas **Mis negocios** (cambiar/crear, responder
      invitaciones, compartir el código) y **Equipo** (invitar por código, quitar, cancelar,
      salir); acceso desde Mi perfil; registro **sin** selector de rol.
- [x] Tests Pest: `ComercianteTest` (rutas nuevas) + `MembresiasTest`.
- [x] Rol global `comerciante`: **eliminado** (2026-10-28, decisión del usuario).
- [x] Panel web Blade de comerciante/cliente/domiciliario: **eliminado** (2026-10-28); queda
      solo la web del admin.

---

## 7. Notificaciones push (FCM) ✅ (las 3 capas)

Ver [[Reglas de Notificacion]].

| Evento | Quién recibe | Dónde abre la app |
|---|---|---|
| Nuevo pedido | todo el equipo del negocio | `ComercioPedidoDetalle` |
| Pedido listo | todos los domiciliarios + cliente | `Domiciliario` / `PedidoDetalle` |
| Tomado / recogido / en camino / entregado | cliente | `PedidoDetalle` |
| Invitación de trabajo | invitado | `MisNegocios` |
| Pedido cancelado por el negocio | cliente | `PedidoDetalle` |
| Pedido cancelado por el cliente | todo el equipo del negocio | `ComercioPedidoDetalle` |

- Todas las notificaciones van **en cola** (`ShouldQueue`): hace falta `php artisan queue:work`
  (lo levantan `iniciar-dev.bat` e `iniciar-emulador.bat`). El push "pedido listo" solo llega a
  domiciliarios **en turno**. Con la app abierta, un push refresca al instante la pantalla.
- **Capa 1 (backend)**: `App\Support\Push` es **no-op si no hay credenciales** y atrapa fallos
  (un push caído nunca rompe un pedido). Tokens en `device_tokens` (varios aparatos por usuario,
  registro idempotente que reasigna el aparato si cambió de dueño).
- **Capa 2 (Firebase real)**: service account en `backend/storage/app/firebase/` y
  `FIREBASE_CREDENTIALS` en `.env` (proyecto `miproyecto-48045`).
- **Capa 3 (app)**: `@react-native-firebase/messaging` + `@notifee/react-native`;
  `google-services.json` en `android/app`; permiso `POST_NOTIFICATIONS` (Android 13+); canal
  **"Pedidos"** de alta prioridad; registra el token al iniciar sesión y lo elimina al salir;
  en primer plano muestra **toast** + notificación local; al tocar una notificación navega
  según `tipo`/`pedido_id` (`RootNavigation.ts`), incluso si la app estaba cerrada.

---

## 8. Identidad visual y experiencia (app)

Ver [[_MOC Diseño]] y [[Sistema Visual]].

- **Marca Vitrina**: logo "Toldo" (toldo de mercado + V como puerta) en `react-native-svg`,
  con **modo día (05:00–17:59, sol ámbar) y noche (luna, chip índigo)** que rota solo por hora
  local. **Splash animado** (~2,3 s) que respeta "reducir movimiento". Íconos adaptativos
  Android.
- Paleta **Ámbar & Grafito**, tipografía **Sora + Inter** (`frontend/src/theme.ts`).
- **Íconos de línea fina** propios en SVG (`Icon.tsx`), sin emojis.
- **Toasts** globales (`Toast.tsx`) para avisos; `Alert` solo para confirmaciones destructivas.
- **Errores de validación por campo** (`FieldError`, `formErrors.ts`): la API devuelve
  `errors` estructurados (`ApiError`) y cada formulario los pinta bajo su campo y los limpia al
  editar.
- Componentes reutilizables: `Dropdown`, `BarrioSelect`, `SelectorImagen` (picker
  `ACTION_GET_CONTENT`, funciona en todos los Android y emuladores), `ListaAtributos`,
  `HeaderPerfil`, `anim.tsx` (helpers de animación).
- Pull-to-refresh en todas las listas.

---

## 9. Interfaz web (Blade) — solo administrador

Decisión del 2026-10-28: **un solo frontend (la app)**. La web de comerciante, cliente y
domiciliario se eliminó. Queda:
- Admin `/admin` (login por sesión; el login web rechaza a quien no es administrador): tablero,
  usuarios (pestañas por rol, crear, cambiar rol), negocios.
- Páginas públicas que exige Play Store: `/privacidad` (política, Ley 1581; datos del
  responsable en `VITRINA_*`) y `/eliminar-cuenta`.

---

## 10. Datos de prueba y herramientas

- `php artisan migrate:fresh --seed` siembra: roles → barrios de Maicao → usuarios demo →
  catálogo. Imágenes demo aparte: `php artisan db:seed --class=ImagenesDemoSeeder`
  (descarga de Picsum, idempotente).
- Usuarios demo (contraseña `password123`): `admin@demo.co`, `comerciante@demo.co` (cliente
  dueño de "El Rincón Paisa"), `domiciliario@demo.co`, `cliente@demo.co`. Los ~59 negocios demo
  tienen su propio dueño `{slug}@demo.co` (lista en `comercios-demo.txt` en la raíz del repo).
- Catálogo demo: 57–59 negocios de 14 tipos, ~364 categorías, ~980 productos con todos los
  tipos de venta.
- Tests: `cd backend && php artisan test` (Pest, SQLite en memoria). Type-check de la app:
  `cd frontend && npx tsc --noEmit`. Correr la app: `npx react-native run-android`
  (rebuild nativo obligatorio tras añadir módulos nativos).

---

## 11. Modelo de datos (mapa rápido)

```
users ──< negocio_user >── negocios ──< productos ──> tipos_producto
  │  (rol, activo)             │  ──< categorias
  │                            │  ──< negocio_tipo_negocio >── tipos_negocio
  │                            │  ──< pedidos ──< pedido_items (copia nombre/precio)
  ├──< invitaciones_trabajo ───┘        │
  ├──< cliente_direcciones              ├── user_id (cliente)
  ├──< carrito_items (solo web)         └── domiciliario_id
  ├──< device_tokens
  └── codigo_publico, direccion, barrio, telefono
barrios (aprobado, creado_por)
```

Estados del pedido (en orden): `pendiente → listo → tomado → recogido → en_camino → entregado`,
más el final alternativo `cancelado` (desde `pendiente`, o desde `listo` sin domiciliario).
Formas de pago: `efectivo` · `transferencia`. Total = `subtotal` + `costo_domicilio`.
Otras tablas: `ajustes` (tarifa de domicilio), `users.en_turno`, `users.suspendido_at`,
`users.eliminado_at`, `negocios.horario`, `negocios.archivado_at`.

---

## 12. Pendientes y próximos pasos (consolidado)

**Hecho en la revisión del 2026-10-28** — P1: cancelar/rechazar pedidos, costo de domicilio,
historial y ventas del negocio, llamar/WhatsApp ([[ADR-003 Botón llamar o WhatsApp al cliente]]),
recuperar contraseña, eliminar cuenta + privacidad, push en cola, firma y URL de producción.
P2: carrito persistente, turno del domiciliario, suspensión de cuentas, horario de los negocios,
refresco eficiente, paginación.

**Prioridad 1 — publicar el piloto (fuera del código)**
- [ ] Elegir hosting y dominio; montar servidor, cola, cron, SMTP y HTTPS (`DESPLIEGUE.md`).
- [ ] Poner el dominio real en `API_URL_PRODUCCION` y llenar `VITRINA_*` (política de privacidad).
- [ ] Decidir el `applicationId` definitivo antes de subir a Play Store (hoy `com.comercioapp`).
- [ ] Crear la llave de subida y la cuenta de Google Play; ficha con privacidad y borrado de cuenta.
- [ ] Piloto cerrado con 3–5 negocios de Maicao y 2–3 domiciliarios.

**Prioridad 2 — después del piloto**
- [ ] iOS (decisión: después de Android): `GoogleService-Info.plist`, firma, prueba en iPhone.
- [ ] Tiempo real dentro de la app ([[ADR-002 Notificaciones en tiempo real]]); hoy push + 15 s.
- [ ] Tarifa de domicilio por barrio/zona; definir el modelo de ingresos ([[Modelo de Negocio]]).
- [ ] Reclamo cuando un pedido queda "en camino" y nunca se entrega.

**Prioridad 3 — siguiente fase (ideas)**
- [ ] Mapa / ubicación en tiempo real ([[Idea - Mapa en tiempo real]], [[Idea - Seguimiento del domiciliario]]).
- [ ] Búsqueda semántica tolerante a errores ([[Idea - Busqueda semantica]]).
- [ ] Orden por cercanía ([[Idea - Orden por cercania]]), pagos en línea ([[Idea - Pagos en linea]]),
      login con Google ([[ADR-001 Inicio de sesión con Google]]).

---
## 🔗 Relacionado
- [[🏠 Home]] · [[Lógica de Negocio]] · [[Flujos de Usuario]]
- [[Wireframes y Pantallas]] · [[Reglas de Notificacion]] · [[Tipos de Venta]] · [[Glosario]]
- [[_MOC Actores]] · [[_MOC Historias]] · [[_MOC Ideas]]
