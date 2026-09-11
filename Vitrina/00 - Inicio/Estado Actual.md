---
title: Estado Actual
tags: [inicio, estado, producto]
estado: en-progreso
actualizado: 2026-09-11
---

# 📊 Estado Actual

> Snapshot vivo e **inventario completo** de funcionalidades de Vitrina, de lo mínimo a lo
> notable, derivado del código real (`backend/` y `frontend/`) el **2026-09-11**. Sirve para
> refrescar la memoria tras un tiempo sin desarrollar. El changelog técnico detallado vive en
> `backend/ESTADO_DEL_PROYECTO.md`.

> [!info] Cómo leer esta nota
> ✅ hecho y verificado en el código · 🚧 a medias (existe código pero no está cerrado) ·
> ⏳ pendiente. Cada sección cierra con la lista de rutas de API y pantallas para ubicarse rápido.

## 🎯 Foco actual
Cerrar el **modelo unificado multi-negocio** (sección 6): actualizar `routes/api.php`, adaptar
la app móvil (Mis negocios, Equipo, Invitaciones, registro sin rol) y cubrirlo con tests.

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
| Web de pruebas | Blade + Tailwind CDN, login por sesión                                               | `backend/routes/web.php`, `resources/views`                         |
| App móvil      | React Native 0.86 · TypeScript · React Navigation (native stack)                     | `frontend/`                                                         |
| Push           | Firebase Cloud Messaging + Notifee (app) · `laravel-notification-channels/fcm` (API) | `frontend/src/pushNotifications.ts`, `backend/app/Support/Push.php` |
| Tests          | Pest (SQLite en memoria) — 61 tests en 7 archivos                                    | `backend/tests/Feature`                                             |
| Docs de API    | Postman (`backend/postman/`) y `backend/api.http` (REST Client)                      |                                                                     |

- La app apunta a `http://10.0.2.2:8000` (emulador Android) en `frontend/src/config.ts`.
- Nombre técnico del paquete Android: `com.comercioapp`; marca visible: **Vitrina**.
- Convención: la API responde JSON en `api/*`, mensajes de validación en **español**
  (`backend/lang/es/`).

---

## 2. Cuentas, roles y sesión

### 2.1 Roles (Spatie) ✅
`administrador` · `comerciante` · `usuario` (cliente) · `domiciliario`. Ver [[Mapa de Actores]].

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

> [!todo] Transición al modelo unificado
> El backend ya **no acepta elegir rol** al registrarse (todos son clientes; los negocios se
> crean después). La app (`RegisterScreen`) **todavía muestra el selector Cliente/Comerciante**
> y envía `role`, que el backend ignora. Hay que quitar ese selector y rediseñar el
> onboarding a "crea tu negocio desde Mis negocios". Ver 6.

### 2.3 Login / logout / sesión ✅
- `POST /api/login` (throttle 6/min) → token Sanctum + payload del usuario (roles, dirección,
  barrio, teléfono, `codigo_publico`, lista de `negocios` donde es miembro con su rol).
- `POST /api/logout` revoca **solo** el token usado; la app además da de baja el token FCM.
- Sesión **persistente** en la app (`AuthContext` + AsyncStorage): no vuelve a pedir login.
- Mensaje genérico en credenciales inválidas (no revela si el email existe).

### 2.4 Perfil personal ✅
`PUT /api/perfil` y pantalla **Mi perfil** (`PerfilScreen`, accesible desde el botón de la
topbar en todos los roles). Edita nombre, email, contraseña (exige la actual), dirección,
barrio y teléfono. Para clientes esos tres últimos son obligatorios y se sincronizan con su
dirección principal. Aquí también está **Cerrar sesión**.

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
- Marcar listo (`pendiente → listo`) avisa por push a todos los domiciliarios y al cliente.
- Solo pedidos del propio negocio y solo si están pendientes (409 si no).

**Rutas (prefijo `/api/comerciante`, `role:comerciante`):** `GET/POST/PUT /negocio`,
`GET/POST /productos`, `GET/PUT/DELETE /productos/{id}`, `GET/POST /categorias`,
`PUT/DELETE /categorias/{id}`, `GET /pedidos`, `PUT /pedidos/{id}/listo`.
Público: `GET /api/tipos-producto`.
**Pantallas:** `HomeScreen` (Inicio comerciante), `MiTiendaScreen`, `MisProductosScreen`,
`ComercioPedidoDetalleScreen`.

> [!warning] Ver 6: las rutas de arriba están en transición al modelo multi-negocio.

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
- Carrito **en memoria** (`CartContext`), regla **un carrito = un negocio**: si agregas de
  otra tienda, pregunta "vaciar y agregar".
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
**línea de tiempo** de estados y se refresca al entrar. Ver [[Lógica de Negocio]].

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
- `DomiciliarioScreen` con las tres listas y pull-to-refresh.

### 5.2 Administrador ✅
- `GET /admin/stats` (usuarios, negocios, abiertos, productos) → `AdminTableroScreen`.
- `GET /admin/usuarios?rol=` (pestañas por tipo con conteo), `POST /admin/usuarios` (crear con
  rol), `PUT /admin/usuarios/{id}/rol` con **salvaguarda**: el admin no puede quitarse su
  propio rol → `AdminUsuariosScreen`.
- `GET /admin/negocios` (dueño, productos, abierto/cerrado) → `AdminNegociosScreen`.

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

### 6.3 Lo que falta para cerrar este cambio ⏳
- [ ] **`routes/api.php` no está actualizado**: sigue exponiendo `/comerciante/negocio`,
      `/comerciante/productos`… sin `{negocio}` y bajo `role:comerciante`, mientras los
      controladores ya exigen `Negocio $negocio`. Hoy esas rutas **rompen**. Falta definir
      `/api/negocios/mios`, `/api/negocios/{negocio}/productos|categorias|pedidos|miembros|invitar…`
      y `/api/invitaciones/{id}/aceptar|rechazar`, y quitar el middleware de rol.
- [ ] La **app móvil** sigue en el modelo viejo (`api.ts` llama a `/comerciante/...`,
      `RegisterScreen` pide rol, `NegocioContext` asume un solo negocio). Faltan pantallas:
      **Mis negocios**, selector de negocio activo, **Equipo** (miembros + invitar por código),
      **Invitaciones** recibidas, y mostrar el código público en Mi perfil.
- [ ] Tests Pest de membresías/invitaciones (los de `ComercianteTest` quedaron sobre las
      rutas viejas).
- [ ] Decidir qué pasa con el rol global `comerciante` (¿se elimina? ¿queda para el panel web?).
- [ ] Panel web Blade: sigue usando `User::negocio()` (1 negocio). Se mantuvo a propósito como
      "legado"; decidir si se adapta o se deja solo para pruebas.

---

## 7. Notificaciones push (FCM) ✅ (las 3 capas)

Ver [[Reglas de Notificacion]].

| Evento | Quién recibe | Dónde abre la app |
|---|---|---|
| Nuevo pedido | todo el equipo del negocio | `ComercioPedidoDetalle` |
| Pedido listo | todos los domiciliarios + cliente | `Domiciliario` / `PedidoDetalle` |
| Tomado / recogido / en camino / entregado | cliente | `PedidoDetalle` |
| Invitación de trabajo | invitado | (pantalla pendiente, ver 6.3) |

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

## 9. Interfaz web (Blade) — solo para gestión/pruebas

Login por sesión (independiente de los tokens). Redirección por rol tras login (`/home`).
- Comerciante `/panel`: negocio, categorías, productos (crear/editar/mostrar-ocultar/borrar),
  `/panel/pedidos` con "Marcar listo".
- Cliente: `/explorar`, `/explorar/{id}`, `/buscar?q=` (multi-palabra, insensible a tildes),
  carrito completo, checkout, `/mis-pedidos`.
- Admin `/admin`: tablero, usuarios (pestañas por rol, crear, cambiar rol), negocios.
- Domiciliario `/domiciliario`: disponibles, entregas, historial.

> [!todo] La web quedó sobre el modelo "1 negocio por comerciante". No se ha adaptado al
> modelo unificado (ver 6.3). Falta paginación visual del catálogo.

---

## 10. Datos de prueba y herramientas

- `php artisan migrate:fresh --seed` siembra: roles → barrios de Maicao → usuarios demo →
  catálogo. Imágenes demo aparte: `php artisan db:seed --class=ImagenesDemoSeeder`
  (descarga de Picsum, idempotente).
- Usuarios demo (contraseña `password123`): `admin@demo.co`, `comerciante@demo.co`,
  `domiciliario@demo.co`, `cliente@demo.co`. Los ~59 negocios demo tienen su propio dueño
  `{slug}@demo.co` (lista en `comercios-demo.txt` en la raíz del repo).
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

Estados del pedido (en orden): `pendiente → listo → tomado → recogido → en_camino → entregado`.
Formas de pago: `efectivo` · `transferencia`.

---

## 12. Pendientes y próximos pasos (consolidado)

**Prioridad 1 — cerrar lo abierto**
- [ ] Rutas API del modelo multi-negocio + adaptar la app (sección 6.3).
- [ ] Onboarding sin selector de rol; "Crea tu negocio" desde la app.
- [ ] Pantallas Equipo / Invitaciones / Mis negocios; código público en Mi perfil.
- [ ] Mantener esta nota y `backend/ESTADO_DEL_PROYECTO.md` al día con cada cambio.

**Prioridad 2 — calidad**
- [ ] Tests Pest del ciclo completo de pedidos y de membresías.
- [ ] Botón llamar / WhatsApp al cliente desde el pedido ([[ADR-003 Botón llamar o WhatsApp al cliente]]).
- [ ] Notificaciones en tiempo real dentro de la app además del push ([[ADR-002 Notificaciones en tiempo real]]).

**Prioridad 3 — siguiente fase (ideas)**
- [ ] Mapa / ubicación en tiempo real ([[Idea - Mapa en tiempo real]], [[Idea - Seguimiento del domiciliario]]).
- [ ] Búsqueda semántica tolerante a errores ([[Idea - Busqueda semantica]]).
- [ ] Orden por cercanía ([[Idea - Orden por cercania]]), pagos en línea ([[Idea - Pagos en linea]]),
      calificaciones ([[Idea - Calificaciones y reseñas]]), login con Google ([[ADR-001 Inicio de sesión con Google]]).

---

## 🔗 Relacionado
- [[🏠 Home]] · [[Lógica de Negocio]] · [[Flujos de Usuario]]
- [[Wireframes y Pantallas]] · [[Reglas de Notificacion]] · [[Tipos de Venta]] · [[Glosario]]
- [[_MOC Actores]] · [[_MOC Historias]] · [[_MOC Ideas]]
