# 📦 Estado del proyecto — comercio-api

> Documento vivo de seguimiento. Refleja **qué hay hecho** y **qué falta** en la app.
> Última actualización: **2026-06-24**

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
API REST en **Laravel 13** (PHP 8.4), autenticación por token con **Sanctum** y roles/permisos con **Spatie**. Base de datos **MySQL** (`comercio_api`). Interfaz web Blade para probar, y app móvil React Native en marcha.

### Estructura del proyecto (monorepo, fuera de OneDrive)
```
C:\dev\comercio-app\           ← repo git (GitHub: ZapataMor/comercio-app)
├── backend/                   ← este proyecto Laravel (la API + web Blade)
└── frontend/                  ← app móvil React Native (ComercioApp)
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

---

## 4. Autenticación
- [x] `POST /api/register` — registro + token (con `throttle:6,1`)
- [x] `POST /api/login` — login + token (con `throttle:6,1`)
- [x] `POST /api/logout` — revoca solo el token usado
- [x] `GET /api/user` — datos del usuario autenticado

---

## 5. Modelo de datos
- [x] `users` (con roles vía Spatie)
- [x] `negocios` (user_id, nombre, descripcion, direccion, telefono, activo) — 1 por comerciante
- [x] `productos` (negocio_id, categoria_id, nombre, descripcion, precio, **tipo_venta**, **unidad_medida**, disponible) — con **SoftDeletes**
- [x] `categorias` (negocio_id, nombre)
- [x] `carrito_items` (user_id, producto_id, cantidad) — carrito del cliente (1 negocio a la vez)
- [x] `pedidos` (negocio_id, user_id, domiciliario_id, estado, metodo_pago, total, direccion_entrega, telefono_contacto, minutos_recogida)
- [x] `pedido_items` (pedido_id, producto_id, **copia** de nombre/precio/cantidad al momento del pedido)
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

### Cliente (`usuario`)
- [x] Ve su panel en `/api/dashboard`
- [x] Explorar negocios y ver catálogo (vía web)
- [x] **Hacer pedidos** (carrito → pago → confirmar) y seguir su estado (vía web)
- [ ] Versión API de lo anterior (para la app nativa)

### Administrador
- [x] Ve su panel en `/api/dashboard`
- [x] Gestionar usuarios y asignar roles (vía web `/admin/usuarios`)
- [x] Ver todos los negocios (vía web `/admin/negocios`)

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

## 8. Pendiente grande (siguiente fase)
- [x] Flujo de **pedidos** (carrito → pedido → estados) en la web — núcleo del comercio
- [x] Panel de administrador (gestión de usuarios/roles) en la web
- [x] Asignación de pedidos a domiciliarios (los toman ellos mismos)
- [ ] Versión **API** del flujo de pedidos (para la app nativa React Native CLI)
- [ ] Ubicación en mapa + notificaciones push (FCM) en tiempo real
- [ ] Búsqueda inteligente/semántica (capa 2 y 3)

---

## 📜 Historial de cambios
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
