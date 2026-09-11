# 📦 Estado del proyecto — comercio-api

> Documento vivo de seguimiento. Refleja **qué hay hecho** y **qué falta** en la app.
> Última actualización: **2026-09-11**

---

## 🤖 Protocolo para la IA (LEER ANTES DE TRABAJAR)

Cada vez que hagas (la IA) una modificación en el código del proyecto, **debes actualizar este archivo** siguiendo estas reglas:

1. **Si completas algo que ya estaba en la lista** → marca su casilla como hecha: `- [ ]` ➜ `- [x]`.
2. **Si añades una funcionalidad o cambio que NO estaba listado** → agrégalo en la sección correspondiente **ya marcado como completado** `- [x]`, con una frase corta de qué hace.
3. **Si detectas algo nuevo pendiente** → añádelo como `- [ ]` en "Pendiente".
4. Actualiza la fecha de **"Última actualización"** de arriba.
5. Registra el cambio en el **Historial de cambios** al final (fecha + descripción breve).
6. No borres elementos completados: sirven como historial de lo construido.

Leyenda: `- [x]` hecho · `- [ ]` pendiente · 🚧 a medias

---

## 1. Resumen
API REST en **Laravel 13** (PHP 8.4), autenticación por token con **Sanctum** y roles/permisos con **Spatie**. Base de datos **MySQL** (`comercio_api`). Interfaz web Blade para probar, y app móvil React Native (**Vitrina**) con los 4 roles funcionando.

> 🧭 El inventario completo de funcionalidades (de lo mínimo a lo notable, por rol) vive en el vault Obsidian: `Vitrina/00 - Inicio/Estado Actual.md`. Este archivo es el changelog técnico.

### Estructura del proyecto (monorepo, fuera de OneDrive)
```
C:\dev\comercio-app\           ← repo git (GitHub: ZapataMor/comercio-app)
├── backend/                   ← este proyecto Laravel (la API + web Blade)
├── frontend/                  ← app móvil React Native (ComercioApp, marca "Vitrina")
└── Vitrina/                   ← vault Obsidian (segundo cerebro: negocio, producto, diseño)
```
> Movido fuera de OneDrive el 2026-06-24 (OneDrive + node_modules/builds da problemas). Respaldo = Git/GitHub. La carpeta vieja en OneDrive quedó vacía (cascarones inofensivos).

---

## 2. Configuración base
- [x] Laravel 13 + PHP 8.4 funcionando
- [x] Sanctum (tokens de API) configurado
- [x] Spatie Permission instalado y middleware `role:` registrado en `bootstrap/app.php`
- [x] Respuestas en JSON para errores en rutas `api/*`
- [ ] Logs en tiempo real en Windows (Pail no sirve por falta de `pcntl`; alternativa: leer `storage/logs/laravel.log`)

---

## 3. Roles
- [x] Roles base creados: `administrador`, `comerciante`, `usuario`, `domiciliario` (`RoleSeeder`)
- [x] Registro público solo permite `usuario` o `comerciante` (los demás los asigna un admin)
- [x] **Modelo unificado (2026-09-11)**: el registro ya NO pide rol; todo el mundo es `usuario` y puede crear/trabajar en negocios (ver sección 6 → "Negocios y equipos"). 🚧 La app todavía muestra el selector de rol
- [ ] Decidir el destino del rol global `comerciante` (¿se elimina o queda solo para el panel web?)

---

## 4. Autenticación
- [x] `POST /api/register` — registro + token (con `throttle:6,1`)
- [x] `POST /api/login` — login + token (con `throttle:6,1`)
- [x] `POST /api/logout` — revoca solo el token usado
- [x] `GET /api/user` — datos del usuario autenticado
- [x] `PUT /api/perfil` — perfil personal (nombre, email, contraseña con la actual, dirección, barrio, teléfono); sincroniza la dirección principal del cliente
- [x] El registro exige dirección, barrio y teléfono; crea la dirección principal y sugiere el barrio si es nuevo
- [x] Login/registro devuelven `codigo_publico` y la lista de `negocios` (con rol) del usuario

---

## 5. Modelo de datos
- [x] `users` (con roles vía Spatie)
- [x] `negocios` (user_id, nombre, descripcion, direccion, telefono, activo) — 1 por comerciante
- [x] `productos` (negocio_id, categoria_id, nombre, descripcion, precio, **tipo_venta**, **unidad_medida**, disponible) — con **SoftDeletes**
- [x] `categorias` (negocio_id, nombre)
- [x] `carrito_items` (user_id, producto_id, cantidad) — carrito del cliente (1 negocio a la vez)
- [x] `pedidos` (negocio_id, user_id, domiciliario_id, estado, metodo_pago, total, direccion_entrega, telefono_contacto, minutos_recogida)
- [x] `pedido_items` (pedido_id, producto_id, **copia** de nombre/precio/cantidad al momento del pedido)
- [x] `device_tokens` (user_id, token único, plataforma, last_used_at) — tokens FCM para notificaciones push (un usuario puede tener varios aparatos)
- [x] `negocios.imagen` y `productos.imagen` (subida multipart, `storage/public/{negocios,productos}`)
- [x] `negocios.categoria` (texto legado) + `tipos_negocio` y pivote `negocio_tipo_negocio` — un negocio puede tener varios tipos (Panadería, Droguería…); 30 tipos base sembrados por migración
- [x] `users.direccion`, `users.barrio`, `users.telefono` — datos de contacto del cliente
- [x] `cliente_direcciones` (user_id, direccion, barrio, es_principal) — ubicaciones guardadas del cliente
- [x] `barrios` (nombre único, aprobado, creado_por) — catálogo de barrios de Maicao + sugerencias de clientes
- [x] `tipos_producto` (nombre, slug, atributo_label, atributo_boton, sugerencias JSON, orden) + `productos.tipo_producto_id` y `productos.atributos` (JSON) — 7 tipos base sembrados por migración
- [x] `negocio_user` (negocio_id, user_id, rol propietario|trabajador, activo) — membresías; `users.codigo_publico` (ej. `U34F4D`); `invitaciones_trabajo` (negocio_id, user_id, invitado_por, estado) — con backfill de dueños y códigos
- [x] Relaciones: User→Negocio, Negocio→Productos, Negocio→Categorias, Producto→Categoria, Negocio→Pedidos, Pedido→(cliente, domiciliario, items), User→(pedidos, entregas, carritoItems)
- [x] **Tipos de venta de producto**: `cantidad` (unidades/porciones/combos/paquetes/docenas), `peso` (precio por kg/libra), `volumen` (por litro), `longitud` (por metro). El precio se entiende "por `unidad_medida`"

---

## 6. Funcionalidades por rol

### Comerciante — `role:comerciante` (prefijo `/api/comerciante`)
- [x] `GET/POST/PUT /negocio` — gestionar su tienda
- [x] `GET/POST /productos` y `GET/PUT/DELETE /productos/{id}` — catálogo propio
- [x] Aislamiento: cada comerciante solo ve/edita SU negocio y SUS productos
- [x] Asignar `categoria_id` al crear/editar un producto, validado contra las categorías propias (`ProductoController`)
- [x] Endpoints de **categorías** CRUD (`GET/POST /categorias`, `PUT/DELETE /categorias/{id}`), con nombre único por negocio
- [x] **JSON limpio** con API Resources (`ProductoResource`, `NegocioResource`, `CategoriaResource`)
- [x] **Paginación + búsqueda/filtros** del catálogo (`?buscar`, `?categoria_id`, `?disponible`, `?por_pagina`)
- [x] **Soft deletes** en productos (borrar oculta pero conserva historial)
- [x] Productos con **tipo de venta** (`tipo_venta` + `unidad_medida`) y `precio_formateado` en el JSON (ej. "$8.900 / kg")
- [x] `CategoriaResource` incluye el **conteo de productos** (`productos`, vía `withCount`) para la lista de categorías de la app
- [x] Filtro `?sin_categoria=1` en `GET /productos` (lista los productos sin categoría)
- [x] Subida de **imagen** de negocio y producto (máx 4 MB) al crear/actualizar
- [x] **Tipos de negocio** (`categoria` / `categorias[]`) al crear/editar el negocio; se crean al vuelo si no existen
- [x] **Tipos de producto + atributos**: `tipo_producto_id` obligatorio al crear; `atributos[]` (ingredientes, usos, tallas…) limpiados y validados; `GET /api/tipos-producto` devuelve la config del formulario
- [x] Pedidos recibidos: `GET /comerciante/pedidos` y `PUT /comerciante/pedidos/{id}/listo`

### Negocios y equipos — modelo unificado 🚧 (commit `9430ede`, 2026-09-11)
> Cualquier usuario puede ser **propietario de varios negocios** y **trabajador de otros**. La autorización se hace contra `negocio_user`, no contra el rol global. Nadie entra a un negocio sin aceptar una invitación; la app no permite buscar personas, solo resolver un código público exacto.
- [x] Modelos: `Negocio::miembros()/miembrosActivos()/esMiembroActivo()/esPropietario()`, creador = propietario automático; `User::negocios()/negociosActivos()/invitacionesTrabajo()`; `InvitacionTrabajo`
- [x] `NegocioController` reescrito: `index` (mis negocios + código público), `store` (sin límite), `show`/`update` con `{negocio}` en la ruta; solo el propietario edita
- [x] `ProductoController`, `CategoriaController`, `ComercioPedidoController` reciben `{negocio}` y validan membresía activa
- [x] `TrabajadorController`: resolver código → nombre, listar miembros + invitaciones pendientes, invitar por código (solo propietario), cancelar invitación, quitar trabajador (nunca a un propietario), salir del negocio
- [x] `InvitacionController`: mis invitaciones pendientes, aceptar (crea membresía), rechazar
- [x] Notificación push `InvitacionTrabajoRecibida`; nuevo pedido avisa a todos los miembros activos; `DashboardController` da panel a quien sea miembro
- [ ] **`routes/api.php` NO está actualizado**: sigue con `/comerciante/negocio|productos|categorias|pedidos` sin `{negocio}` y bajo `role:comerciante` → esas rutas hoy rompen. Definir `/api/negocios/mios`, `/api/negocios/{negocio}/...`, `/api/negocios/{negocio}/miembros|invitar`, `/api/invitaciones/{id}/aceptar|rechazar`
- [ ] Adaptar la app: `api.ts`, `NegocioContext` (negocio activo), pantallas Mis negocios / Equipo / Invitaciones, código público en Mi perfil, quitar selector de rol del registro
- [ ] Tests Pest de membresías e invitaciones (`ComercianteTest` quedó sobre las rutas viejas)
- [ ] Panel web Blade: sigue en "1 negocio por comerciante" (`User::negocio()`); decidir si se adapta

### Cliente (`usuario`)
- [x] Ve su panel en `/api/dashboard`
- [x] Explorar negocios y ver catálogo (vía web)
- [x] **Hacer pedidos** (carrito → pago → confirmar) y seguir su estado (vía web)
- [x] Versión API de lo anterior (para la app nativa): `GET /api/negocios` (paginado 50, `?buscar`, `?tipo_negocio_id`, abiertos primero), `GET /api/negocios/{id}`, `GET /api/tipos-negocio`, `POST/GET /api/pedidos`, `GET /api/pedidos/{id}`
- [x] **Búsqueda de productos por relevancia** `GET /api/productos?buscar=` (nombre exacto → empieza por → contiene → descripción/atributos/categoría; negocios abiertos primero; máx 50) con el negocio que los vende
- [x] **Direcciones guardadas** `GET/POST /api/cliente/direcciones` (principal + otras) para el checkout
- [x] **Barrios de Maicao**: `GET /api/barrios` público (sembrados por comuna en `BarriosSeeder`); un barrio escrito a mano queda como sugerencia pendiente
- [x] Al crear un pedido, si el cliente no tenía teléfono se guarda en su perfil

### Administrador
- [x] Ve su panel en `/api/dashboard`
- [x] Gestionar usuarios y asignar roles (vía web `/admin/usuarios`)
- [x] Ver todos los negocios (vía web `/admin/negocios`)
- [x] API: `GET /admin/stats`, `GET/POST /admin/usuarios`, `PUT /admin/usuarios/{id}/rol`, `GET /admin/negocios`
- [x] **Moderación de barrios**: `GET /admin/barrios/pendientes`, `PUT /admin/barrios/{id}/aprobar`, `DELETE /admin/barrios/{id}`

### Domiciliario
- [x] Ve su panel en `/api/dashboard`
- [x] Vista web del panel (`/domiciliario`) con datos reales: pedidos disponibles, mis entregas, historial
- [x] Tomar pedido (con minutos de recogida) y actualizar estado (Recogido → En camino → Entregado)

### General
- [x] `GET /api/dashboard` — panel adaptativo que responde distinto según el rol

### Interfaz WEB (Blade) — panel del comerciante (sesión con cookies)
> Front web temporal para ver/probar todo en el navegador mientras se desarrolla el frontend nativo (React Native CLI vendrá después y consume la misma API). Login web por **sesión** (independiente de los tokens de la API). Estilo con Tailwind por CDN.
- [x] Login/Logout web (`/login`, `/logout`) — `Web\AuthWebController`, vista `auth/login`
- [x] Panel `/panel` protegido por sesión + `role:comerciante` — `Web\PanelController`, vista `panel/index`
- [x] Crear/editar negocio, abrir/cerrar (activo)
- [x] Crear/borrar categorías
- [x] Crear productos (con categoría), mostrar/ocultar (disponible) y borrar (soft delete)
- [x] **Editar producto** existente (nombre/precio/descripción/categoría/disponible) desde la web — `panel/producto-editar`
- [x] Redirección por rol tras login (`/home` → `HomeController`): comerciante→panel, usuario→explorar, otros→"próximamente"
- [ ] Paginación visual del listado de productos en la web

### Interfaz WEB (Blade) — cliente (rol `usuario`)
- [x] `/explorar` — lista de negocios abiertos con nº de productos disponibles (`Web\ClienteController`, vista `cliente/explorar`)
- [x] `/explorar/{id}` — catálogo de un negocio (productos disponibles agrupados por categoría) — vista `cliente/negocio`
- [x] **Barra de búsqueda** `/buscar?q=` — busca productos por nombre, descripción, **categoría** y nombre del negocio; multi-palabra; insensible a mayúsculas/tildes (colación MySQL). Solo productos disponibles de negocios activos
- [x] Botón **"+ Pedir"** que añade al carrito (ya funcional)
- [ ] **Búsqueda inteligente/semántica** (tolerante a errores de ortografía y por intención, ej: "pastillas para el dolor" → analgésicos). Capa futura sobre la búsqueda actual (full-text / trigramas / embeddings IA)

### Interfaz WEB (Blade) — FLUJO DE PEDIDOS (atraviesa los 4 roles)
> Estados: `pendiente → listo → tomado → recogido → en_camino → entregado`. La "notificación" por ahora es que el pedido aparece en la vista de cada rol (push real con FCM = futuro). Menú del layout adaptado por rol (carrito con contador, "Mis pedidos", "Pedidos", "Entregas").
- [x] **Cliente — carrito**: agregar/actualizar/quitar/vaciar; regla "un carrito = un negocio" — `Web\CarritoController`, vista `cliente/carrito`
- [x] **Cliente — checkout**: dirección + teléfono + **forma de pago (efectivo/transferencia)** antes de confirmar — vista `cliente/checkout`
- [x] **Cliente — confirmar**: crea el pedido (con copia de items) y vacía el carrito
- [x] **Cliente — seguimiento**: `/mis-pedidos` y detalle con línea de tiempo del estado — vistas `cliente/pedidos`, `cliente/pedido`
- [x] **Comercio — pedidos**: `/panel/pedidos` con info del cliente (nombre, dirección, teléfono, pago) y botón **"Marcar listo"** — vista `panel/pedidos`
- [x] **Domiciliario**: ver disponibles, **tomar** (con minutos), marcar Recogido/En camino/Entregado, historial — vista `domiciliario/index`
- [x] Verificado end-to-end: cliente pide → comercio listo → domiciliario toma/recoge/entrega → cliente ve "Entregado"
- [ ] Compartir **ubicación en mapa** del cliente (por ahora solo dirección escrita)
- [ ] **Notificaciones push** en tiempo real (FCM) — hoy se ve al refrescar la vista
- [ ] Tests Pest del ciclo de pedidos

### Interfaz WEB (Blade) — administrador (rol `administrador`)
- [x] `/admin` — tablero con totales (usuarios, negocios, abiertos, productos) — `Web\AdminController`, vista `admin/index`
- [x] `/admin/usuarios` — usuarios **filtrados por tipo** (pestañas con conteo por rol) + **crear usuario** (nombre/correo/contraseña/rol) + **cambio de rol** (con salvaguarda: el admin no puede quitarse su propio rol) — vista `admin/usuarios`
- [x] `/admin/negocios` — visión global de todos los negocios (dueño, productos, abierto/cerrado) — vista `admin/negocios`

### Interfaz WEB (Blade) — domiciliario (rol `domiciliario`)
- [x] `/domiciliario` — panel con **datos reales**: pedidos disponibles (tomar con minutos), mis entregas en curso (Recogido→En camino→Entregado) e historial — `Web\DomiciliarioController`, vista `domiciliario/index`

---

## 7. Pruebas y datos
- [x] Usuarios demo sembrados (`DemoUsersSeeder`), contraseña `password123`:
  `admin@demo.co`, `comerciante@demo.co`, `domiciliario@demo.co`, `cliente@demo.co`
- [x] **Catálogo realista sembrado** (`CatalogoDemoSeeder`): 57 negocios de 14 tipos (restaurante, asadero, cafetería, bar, heladería, panadería, papelería, ferretería, ropa, frutería, carnicería, droguería, licorería, minimercado), con sus categorías y ~980 productos de distintos tipos de venta. Cada negocio es de un comerciante propio (`{slug}@demo.co` / `password123`). Idempotente
- [x] Verificado manualmente: login por rol, dashboard por rol, comerciante crea negocio (201), cliente bloqueado en zona de comerciante (403)
- [x] Tests automatizados (Pest): 15 tests del flujo de comerciante (negocio, productos, categorías, paginación, búsqueda, soft delete, aislamiento) — `tests/Feature/ComercianteTest.php`. Corren en SQLite en memoria (no tocan MySQL). `RefreshDatabase` activado en `tests/Pest.php`
- [x] Colección **Postman** con todos los endpoints y guardado automático de token — `postman/comercio-api.postman_collection.json` (importable también en Bruno; Thunder Client ya cobra por importar)
- [x] Archivo **`api.http`** (extensión REST Client de VS Code, gratis y sin cuenta) con todos los endpoints y captura automática de token

---

### Notificaciones push (FCM) — ✅ las 3 capas
> Estados: **Capa 1 (backend), Capa 2 (Firebase real) y Capa 3 (app móvil) HECHAS**. El envío está **blindado**: si Firebase no está configurado, no hace nada; si falla un envío, se registra en log y NUNCA rompe el flujo de pedidos (`App\Support\Push`).
- [x] Librería `laravel-notification-channels/fcm` instalada + `config/firebase.php` publicado (requirió habilitar `ext-sodium` en php.ini)
- [x] Tabla/modelo `device_tokens` + relación `User::deviceTokens()` y `User::routeNotificationForFcm()`
- [x] Endpoints `POST /api/device-tokens` (registrar, idempotente, reasigna si el aparato cambió de dueño) y `DELETE /api/device-tokens` (baja al cerrar sesión)
- [x] Notificaciones: `NuevoPedidoParaComercio`, `PedidoDisponibleParaDomiciliario`, `EstadoPedidoActualizado` (mensaje por estado)
- [x] Disparos enganchados: crear pedido→comercio; marcar listo→domiciliarios + cliente; tomar/recogido/en_camino/entregado→cliente
- [x] Helper `App\Support\Push` (no-op si no hay credenciales, atrapa fallos) + 10 tests Pest con `Notification::fake()`
- [x] **Capa 2**: proyecto Firebase `miproyecto-48045`, service account en `storage/app/firebase/` y `FIREBASE_CREDENTIALS` en `.env` → envío real
- [x] **Capa 3**: app móvil con `@react-native-firebase/messaging` + `@notifee/react-native`, `google-services.json`, permiso `POST_NOTIFICATIONS` (Android 13+), canal "Pedidos" de alta prioridad, registro del token al iniciar sesión y baja al salir, toast + notificación local en primer plano, y navegación al tocar la notificación según `tipo`/`pedido_id` (`RootNavigation.ts`), incluso con la app cerrada
- [x] Notificación `InvitacionTrabajoRecibida` (equipos de trabajo)
- [ ] Notificaciones en tiempo real dentro de la app además del push (ver ADR-002 en el vault)

## 8. Pendiente grande (siguiente fase)
- [x] Flujo de **pedidos** (carrito → pedido → estados) en la web — núcleo del comercio
- [x] Panel de administrador (gestión de usuarios/roles) en la web
- [x] Asignación de pedidos a domiciliarios (los toman ellos mismos)
- [x] Versión **API** del flujo de pedidos (para la app nativa React Native CLI)
- [x] Notificaciones push (FCM): las 3 capas
- [x] Identidad visual **Vitrina** (logo día/noche, splash animado, paleta Ámbar & Grafito, Sora + Inter, íconos de línea)
- [x] Perfil personal, barrios de Maicao, direcciones guardadas, tipos de negocio, tipos de producto con atributos, errores de validación por campo
- 🚧 **Modelo unificado multi-negocio + equipos** (rutas API y app pendientes — ver sección 6)
- [ ] Ubicación en mapa en tiempo real
- [ ] Búsqueda inteligente/semántica (capa 2 y 3)
- [ ] Botón llamar / WhatsApp al cliente desde el pedido (ADR-003)

---

## 📜 Historial de cambios
- **2026-09-11** — **Modelo unificado de usuarios y negocios (backend, a medias)**. Migración `create_membresias_negocio` (`negocio_user`, `invitaciones_trabajo`, `users.codigo_publico`, backfill). Controladores `Negocio/Producto/Categoria/ComercioPedido` reciben `{negocio}` y autorizan por membresía; nuevos `TrabajadorController` (invitar por código público, miembros, quitar, salir) e `InvitacionController` (aceptar/rechazar); notificación `InvitacionTrabajoRecibida`; registro sin rol. **Pendiente**: `routes/api.php` no se actualizó (las rutas `/comerciante/*` rompen), app móvil sin adaptar, tests. Además: puesta al día de este documento y del vault (`Vitrina/00 - Inicio/Estado Actual.md` pasa a ser el inventario completo de funcionalidades).
- **2026-07-06** — **Refactor del catálogo del comerciante en la app**: `MisProductosScreen` reemplaza a `MisCategoriasScreen` (las categorías se asignan desde el formulario de producto); modal de producto deslizable con cierre por arrastre; `getProductos` sin filtro por categoría.
- **2026-07-06** — **Tipos de producto y atributos**: tabla global `tipos_producto` (Comida, Medicamento, Herramienta, Ropa y calzado, Tecnología, Belleza y aseo, Otro) con pregunta, botón y chips sugeridos; `productos.tipo_producto_id` (obligatorio al crear) y `productos.atributos` JSON; componente `ListaAtributos`; los atributos entran en la búsqueda del cliente. Tests.
- **2026-07-05** — **Marca Vitrina en la app**: componentes `Logo` (día 05:00–17:59 / noche) y `SplashVitrina` animado; íconos adaptativos Android; el teléfono del checkout se guarda en el perfil si no había; la pila de navegación se rearma tras confirmar el pedido.
- **2026-07-05** — **Barrios de Maicao y teléfono**: modelo `Barrio` + `BarriosSeeder` por comunas; `GET /api/barrios` público; sugerencias de barrio pendientes de aprobación con `AdminBarriosScreen` y endpoints de admin; `users.telefono`; componente `BarrioSelect`; tests.
- **2026-07-05** — **Direcciones del cliente**: `users.direccion/barrio`, tabla `cliente_direcciones`, `GET/POST /api/cliente/direcciones`; registro y perfil piden dirección/barrio; `ClienteDireccionesTest`.
- **2026-07-05** — **Tipos de negocio**: tablas `tipos_negocio` + pivote, 30 tipos base, `GET /api/tipos-negocio`, filtro `?tipo_negocio_id` en negocios y productos, chips de filtro en Explorar. Antes: campo `negocios.categoria` (texto) y `categorias[]` en el formulario.
- **2026-07-05** — **Errores de validación por campo**: tipo `ApiValidationErrors` + `ApiError` en `api.ts`, componente `FieldError` y `formErrors.ts`; aplicado en registro, perfil, negocio, productos.
- **2026-07-01 → 07-05** — **Identidad Vitrina, perfil y búsqueda de productos**: paleta Ámbar & Grafito, Sora + Inter, animación "paquete al carrito" (`FlyToCart`), barra flotante del cliente (`BarraCliente`), tarjetas de negocio expandibles, scroll infinito en Explorar; `GET /api/productos?buscar=` por relevancia con scroll al producto resaltado en el catálogo. Perfil personal (`PUT /api/perfil`, `PerfilScreen`, `HeaderPerfil`). `ImagenesDemoSeeder`. Tests `CatalogoBusquedaTest`, `CatalogoNegociosTest`, `PerfilTest`.
- **2026-06-29** — **Push Capas 2 y 3**: Firebase real (`miproyecto-48045`), `@react-native-firebase/messaging` + Notifee, canal "Pedidos", registro/baja de token con la sesión, navegación al tocar la notificación (`RootNavigation.ts`). Tests de notificaciones ampliados (15).
- **2026-06-29** — **Móvil: íconos de línea, toasts globales y limpieza**.
  - **Íconos de borde fino**: se añadió `react-native-svg` y `src/components/Icon.tsx`, un set propio de íconos *solo borde* (estilo thin/uicons): tienda, etiqueta, bolsa, herramientas, moto, usuario(s), ubicación, teléfono, tarjeta, caja, basura, carrito, efectivo, banco, casa, check, cerrar, imagen, chevron, lista, lupa, reloj. **Se reemplazaron TODOS los emojis** de la app por estos íconos, contextualizados (Home, AdminTablero, Categorías/Productos, detalle de pedido, Explorar, Carrito, Negocio, Checkout, Domiciliario, Login, Register, SelectorImagen). No se usó la fuente Flaticon UICONS porque su paquete npm solo trae woff2/woff (RN no los carga sin convertir a TTF); el SVG logra el mismo estilo de forma fiable.
  - **Toasts en los demás roles**: migrados los `Alert` informativos de cliente/admin/domiciliario (`AdminUsuarios`, `Domiciliario`, `Checkout`) a `useToast`. Se conservan como `Alert` solo las **confirmaciones** (Sí/No: vaciar carrito, borrar producto/categoría).
  - **Limpieza**: eliminadas las pantallas huérfanas `MisProductosScreen.tsx` y `ComercioPedidosScreen.tsx`.
  - **OJO**: requiere **rebuild nativo** (`npx react-native run-android`) porque `react-native-svg` es módulo nativo. `tsc --noEmit` verde.
- **2026-06-29** — **Móvil: rediseño del flujo del comerciante**.
  - **Mi Tienda**: ahora se muestra como **tarjeta de solo lectura** con botón **"Editar información"**; el formulario solo aparece al crear/editar. Al **crear** el negocio, **redirige al Inicio**.
  - **Inicio del comerciante**: muestra **solo "Mi negocio" y "Categorías"**. **Switch Abierto/Cerrado** en la parte derecha de la topbar (reutiliza el campo `activo`: cerrado = oculto en Explorar). Los **pedidos en espera** se listan directamente en el Inicio; cada uno abre un **detalle** (`ComercioPedidoDetalle`) con toda su info y el botón **"Marcar listo"**.
  - **Productos dentro de categorías**: nueva pantalla `CategoriaProductos` (se entra tocando una categoría). La antigua "Unidad" es ahora un **dropdown "Unidad de venta"** con **Cantidad / Kilos / Libras** (mapea a `tipo_venta`+`unidad_medida`). Grupo **"Sin categoría"** para reubicar productos sueltos. Se retiró del Inicio la pantalla plana "Mis Productos".
  - **Notificaciones tipo toast** con estilo de la app (arriba a la derecha, temporales, con barra de color por tipo) en lugar de los `Alert` genéricos para avisos de éxito/error.
  - Infra nueva: `src/Toast.tsx` (ToastProvider/useToast), `src/NegocioContext.tsx` (estado del negocio compartido para el switch y Mi Tienda), `src/components/Dropdown.tsx`.
  - Backend: `CategoriaResource` con `productos` (conteo, `withCount`) y `ProductoController` con `?sin_categoria=1`. **+2 tests Pest** (conteo por categoría y filtro sin categoría) → **29 verdes**. `tsc --noEmit` verde.
  - El editor de productos de `CategoriaProductos` ya incluye `SelectorImagen` (foto del producto) y `crearProducto`/`actualizarProducto` suben la imagen, consistente con el flujo de imágenes en curso.
  - Quedaron sin uso `MisProductosScreen.tsx` y `ComercioPedidosScreen.tsx` (su función se reorganizó); **eliminadas** en la iteración siguiente.
- **2026-06-28** — **Móvil: cierre de brechas de funcionalidad (registro + CRUD comerciante + búsqueda + pull-to-refresh)**. Tras una ronda de QA en el emulador se implementó lo que faltaba en la app:
  - **Registro de cuenta** desde la app: nueva `RegisterScreen` (nombre, correo, contraseña + confirmación, selector de rol) enlazada desde Login; **solo permite roles `usuario` (cliente) y `comerciante`** — admin y domiciliario NUNCA se ofrecen (consistente con `ROLES_PUBLICOS` del backend; los domiciliarios los creará luego un admin de domiciliarios). `api.register()` envía `password_confirmation`. Rutas `Login`/`Register` ahora conviven en el stack no-autenticado de `App.tsx`.
  - **Comerciante: gestión de su negocio**: `MiTiendaScreen` pasó de solo-lectura a **formulario** que crea (`POST`) o edita (`PUT`) el negocio (nombre, descripción, dirección, teléfono, switch abierto/cerrado).
  - **Comerciante: CRUD de productos**: `MisProductosScreen` con "+ Nuevo producto", edición al tocar la tarjeta (modal con nombre, descripción, precio, unidad, **selector de categoría** y disponible) y borrado con confirmación.
  - **Comerciante: gestión de categorías**: nueva `MisCategoriasScreen` (crear, **editar en línea**, eliminar con confirmación) + tarjeta "Categorías" en Home y ruta `MisCategorias`.
  - **Cliente: búsqueda** en `ExplorarScreen` (caja con debounce 350 ms) apoyada en nuevo parámetro `?buscar` de `Api\CatalogoController@index` (filtra negocio por nombre/descripción **o** por tener productos disponibles que coincidan por nombre/categoría).
  - **Pull-to-refresh** (`RefreshControl`) en Explorar, MisProductos, MisCategorias, ComercioPedidos, Domiciliario, MisPedidos, AdminUsuarios y AdminNegocios.
  - `api.ts` ampliado: `register`, `crearNegocio`/`actualizarNegocio`, categorías CRUD, productos CRUD, `getNegocios(token, buscar?)`. Verificado en el emulador end-to-end (registro de comerciante → crear negocio → crear categorías → CRUD producto → búsqueda cliente) + `tsc --noEmit` verde. Pendientes que requieren dependencias externas: push Capa 2/3 (Firebase real), imágenes de producto (almacenamiento + image-picker nativo) y mapa/ubicación (react-native-maps + API key).
- **2026-06-27** — **Notificaciones push (FCM) — Capa 1 backend**. Instalada `laravel-notification-channels/fcm` (hubo que habilitar `ext-sodium` en `C:\tools\php84\php.ini`) y publicado `config/firebase.php`. Nueva tabla/modelo `device_tokens` + `User::deviceTokens()`/`routeNotificationForFcm()`. Endpoints `POST/DELETE /api/device-tokens` (registro idempotente que reasigna el aparato al usuario actual; baja en logout). Notificaciones `NuevoPedidoParaComercio`, `PedidoDisponibleParaDomiciliario`, `EstadoPedidoActualizado`, enganchadas en `Api\PedidoController@store` (→comercio), `Api\ComercioPedidoController@marcarListo` (→domiciliarios + cliente) y `Api\DomiciliarioController` tomar/recogido/enCamino/entregado (→cliente). Helper `App\Support\Push`: **no-op si Firebase no está configurado y atrapa cualquier fallo**, para que el push nunca rompa el flujo de pedidos. Credenciales secretas van a `storage/app/firebase/` (con `.gitignore`) vía `FIREBASE_CREDENTIALS`. 10 tests Pest nuevos con `Notification::fake()` (suite total **27 verdes**). Faltan Capa 2 (Firebase real) y Capa 3 (app).
- **2026-06-26** — **Móvil: el COMERCIO recibe y confirma pedidos** → cierra el ciclo en la app. API `Api\ComercioPedidoController` (`GET /api/comerciante/pedidos`, `PUT /api/comerciante/pedidos/{id}/listo`). Pantalla `ComercioPedidosScreen` (datos del cliente + items; botón "Marcar listo" en los pendientes; se refresca al entrar) + ítem "Pedidos recibidos" en el menú del comerciante. **Ciclo completo en móvil**: cliente confirma (pendiente) → comercio marca listo → domiciliario toma/recoge/en camino/entrega → cliente y comercio ven el avance. Verificado API por curl + tsc verde.
- **2026-06-26** — **Móvil: el CLIENTE ya puede pedir (ciclo de compra completo)**. API nueva `Api\PedidoController` (`POST /api/pedidos` crea pedido validando productos del negocio + copia de precios; `GET /api/pedidos` mis pedidos; `GET /api/pedidos/{id}` seguimiento con estados). En la app: **carrito en memoria** (`CartContext`, una tienda a la vez), botón "+ Pedir" por producto en el catálogo, pantallas `Carrito`, `Checkout` (dirección/teléfono/pago efectivo o transferencia), `MisPedidos` y `PedidoDetalle` (línea de tiempo de estados, se refresca al entrar). El **cliente ahora aterriza en "Negocios abiertos" (Explorar)** al iniciar sesión, con barra de Carrito/Mis pedidos/Salir. Lista de credenciales de los 59 comercios en `comercios-demo.txt` (email = nombre slug + @demo.co, pass password123). Verificado API por curl + tsc verde + app sin crashes.
- **2026-06-24** — **Móvil: rol DOMICILIARIO + API de pedidos**. Nueva `Api\DomiciliarioController` bajo auth:sanctum+role:domiciliario: `GET /disponibles|/entregas|/historial`, `PUT /pedidos/{id}/tomar|recogido|en-camino|entregado` (reusa la máquina de estados, con update condicional anti-choque). Pantalla RN `DomiciliarioScreen` (disponibles con "tomar"+minutos, entregas en curso con avance de estado, historial). Sembrados 2 pedidos demo en estado "listo". Con esto **los 4 roles ya tienen vistas en la app móvil** (comerciante, cliente, admin, domiciliario). Verificado API por curl + tsc verde. Pendiente: flujo de pedidos del CLIENTE en móvil (carrito→confirmar→seguimiento), Nativewind, pull-to-refresh.
- **2026-06-24** — **Móvil: vistas del ADMIN**. API nueva `Api\AdminController` bajo auth:sanctum+role:administrador: `GET /api/admin/stats`, `GET/POST /api/admin/usuarios`, `PUT /api/admin/usuarios/{id}/rol`, `GET /api/admin/negocios`. Pantallas RN `AdminTablero` (stats), `AdminUsuarios` (tabs por tipo + crear + cambiar rol, con salvaguarda anti-autodegradación), `AdminNegocios`. Menú admin en Home; navegación por rol. API probada por curl + tsc verde. Falta el rol **domiciliario**, que depende de exponer la **API de pedidos** (hoy web-only) — igual que el "Pedir" del cliente.
- **2026-06-24** — **Móvil: vistas del CLIENTE (explorar + catálogo)**. Nuevos endpoints API `GET /api/negocios` y `GET /api/negocios/{id}` (`Api\CatalogoController`, solo lectura, bajo auth:sanctum) — porque los flujos de cliente/admin/domiciliario solo existían en web (sesión) y el móvil usa API. Pantallas RN `ExplorarScreen` y `NegocioScreen`; navegación por rol en `App.tsx`; menú de cliente en Home. Verificado API por curl + tsc en verde. Pendiente del cliente móvil: carrito/pedidos (requiere API de pedidos). Siguen: admin y domiciliario.
- **2026-06-24** — **App móvil: React Navigation + sesión persistente**. Rebuild agregando librerías nativas `react-native-screens`, `@react-native-async-storage/async-storage`, `@react-navigation/native` + `native-stack`. Navegación real (header, back nativo) en `App.tsx`; `AuthContext` ahora persiste el token en AsyncStorage (no re-login). Pantallas usan `navigation.navigate`. Build OK, app corre sin crashes. Siguiente: portar vistas de los demás roles (cliente, admin, domiciliario) al móvil.
- **2026-06-24** — **¡App móvil corriendo en el emulador!** Tras configurar el entorno Android (AVD Pixel_6, NDK 27.1.12297006, CMake 3.22.1, Build-Tools, JDK 17), el build compiló e instaló (`com.comercioapp`). **Login funciona end-to-end** contra la API (Sanctum) y muestra usuario+rol. Construidas primeras pantallas reales del comerciante con **navegación por estado** y **AuthContext** (token en memoria): `AuthContext.tsx`, `src/api.ts` (getNegocio/getProductos autenticados), `screens/{HomeScreen(menu), MiTiendaScreen, MisProductosScreen}`. Cambios JS se ven al instante por **Fast Refresh** (sin recompilar). Pendiente: React Navigation + persistir token (AsyncStorage) en un rebuild; Nativewind; resto de pantallas.
- **2026-06-24** — **Monorepo + arranque de la app móvil**: el proyecto se movió fuera de OneDrive a `C:\dev\comercio-app\` con `backend/` (Laravel) y `frontend/` (React Native CLI, TypeScript, app "ComercioApp"). Creado el frontend con la **pantalla de Login** conectada a `POST /api/login` (Sanctum): `src/config.ts` (API_URL, 10.0.2.2 para emulador), `src/api.ts`, `src/screens/{LoginScreen,HomeScreen}.tsx`, `App.tsx` con estado de sesión. Type-check (`tsc --noEmit`) en verde. Falta poder *correrla* (entorno Android: el teléfono está bloqueado por financiación, emulador pendiente). Nativewind/navegación: siguiente paso.
- **2026-06-24** — **Idioma a español**: creados `lang/es/validation.php`, `auth.php` y `pagination.php` (Laravel 11+ no los trae por defecto, por eso los errores salían en inglés aunque `APP_LOCALE=es`). Mensajes de validación, login y paginación ahora en español, con nombres de campos legibles (correo electrónico, contraseña, etc.). 17 tests en verde.
- **2026-06-24** — **Admin — gestión de usuarios mejorada**: ver usuarios **por tipo** (pestañas por rol con conteo, ya no todos en una sola lista) y **crear usuarios** (nombre/correo/contraseña/rol) desde `/admin/usuarios`. Verificado: filtro por rol, creación (persiste con rol) y validación de email duplicado.
- **2026-06-24** — **FLUJO DE PEDIDOS completo (web)**, atravesando los 4 roles. Nuevas tablas/modelos: `carrito_items`, `pedidos`, `pedido_items` (con copia de nombre/precio). Cliente: carrito (1 negocio a la vez) → checkout con **forma de pago (efectivo/transferencia)** + dirección/teléfono → confirmar → seguimiento con línea de tiempo. Comercio: ve pedidos con datos del cliente y marca **"Listo"**. Domiciliario: ve disponibles, **toma** indicando minutos, y marca Recogido→En camino→Entregado. Estados: `pendiente→listo→tomado→recogido→en_camino→entregado`. Menú del layout adaptado por rol (carrito con contador, Mis pedidos, etc.). Verificado **end-to-end** (cliente pide → comercio listo → domiciliario toma/recoge/entrega → cliente ve "Entregado" en BD). 17 tests Pest en verde (actualizado `ExampleTest` porque `/` ahora redirige). Pendiente: versión API, mapa y push.
- **2026-06-23** — **Vista del domiciliario** (`/domiciliario`): estructura basada en las acciones definidas (entregas asignadas, flujo de estados Asignado→Recogido→En camino→Entregado, historial) + tarjeta de ejemplo para revisar diseño; datos reales quedan pendientes del flujo de pedidos. Con esto están las **4 vistas web por rol** (comerciante, cliente, admin, domiciliario). Verificado: login→panel y bloqueo de otros roles (403).
- **2026-06-23** — **Tipos de venta de producto** (cambio de esquema): añadidas columnas `tipo_venta` (`cantidad`/`peso`/`volumen`/`longitud`) y `unidad_medida` a `productos`; validación en `ProductoController` y `precio_formateado` en `ProductoResource` (ej. "$25.700 / kg"). **Seeder de catálogo** (`CatalogoDemoSeeder`): 57 negocios de 14 tipos con categorías y ~980 productos (cantidad/peso/volumen/longitud, incluyendo combos, paquetes, docenas, por kg/libra/litro/metro). Verificado: migración OK, datos sembrados (59 negocios, 364 categorías, 981 productos), 15 tests Pest en verde, JSON formateado correcto.
- **2026-06-23** — **Barra de búsqueda** del cliente (`/buscar`): por nombre, categoría, descripción y negocio; multi-palabra; insensible a mayúsculas/tildes. **Vistas del administrador**: tablero, gestión de usuarios/roles (con salvaguarda anti-autobloqueo) y listado global de negocios. Verificado todo end-to-end (búsqueda por nombre y por categoría; cambio de rol y bloqueo de auto-degradación). Anotada la búsqueda **semántica/IA** como capa futura. Pendiente: vista del domiciliario.
- **2026-06-23** — Web: **editar producto** desde el panel del comerciante (formulario completo). Nuevas **vistas del cliente**: `/explorar` (negocios abiertos) y `/explorar/{id}` (catálogo por categorías), con botón "Pedir" deshabilitado hasta tener pedidos. Añadida **redirección por rol** tras login (`/home`). Verificado end-to-end (cliente explora; comerciante edita producto y persiste). Pendientes: vistas de admin y domiciliario.
- **2026-06-22** — Creación de este documento de seguimiento. Estado inicial: auth, roles, negocio y productos del comerciante, dashboard por rol y usuarios demo ya implementados; categorías y flujo de cliente/pedidos pendientes.
- **2026-06-22** — **Interfaz web (Blade)** del comerciante: login por sesión + panel `/panel` (role:comerciante) para gestionar negocio, categorías y productos desde el navegador, con Tailwind por CDN. Sirve para ver/probar todo visualmente; la app nativa (React Native CLI) vendrá después sobre la misma API. Verificado el flujo completo (login con CSRF/sesión → panel 200).
- **2026-06-22** — Pulido del comerciante: CRUD de **categorías** (por negocio, nombre único) + asignación validada de `categoria_id` a productos; **soft deletes** en productos; **API Resources** (JSON limpio); **paginación + búsqueda/filtros** del catálogo; **15 tests Pest** del flujo de comerciante (todo verde); colección **Postman** con auto-guardado de token. Añadido `api.http` (REST Client de VS Code, gratis) como alternativa sin suscripción a Thunder Client.
