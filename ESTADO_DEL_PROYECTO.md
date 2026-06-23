# 📦 Estado del proyecto — comercio-api

> Documento vivo de seguimiento. Refleja **qué hay hecho** y **qué falta** en la app.
> Última actualización: **2026-06-23**

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
API REST en **Laravel 13** (PHP 8.4), autenticación por token con **Sanctum** y roles/permisos con **Spatie**. Base de datos **MySQL** (`comercio_api`). Sin frontend: se consume como JSON.

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
- [x] `productos` (negocio_id, categoria_id, nombre, descripcion, precio, disponible) — con **SoftDeletes**
- [x] `categorias` (negocio_id, nombre)
- [x] Relaciones: User→Negocio, Negocio→Productos, Negocio→Categorias, Producto→Categoria

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

### Cliente (`usuario`)
- [x] Ve su panel en `/api/dashboard`
- [ ] Listar negocios activos (`GET /api/negocios`)
- [ ] Ver el catálogo/productos de un negocio
- [ ] Hacer pedidos

### Administrador
- [x] Ve su panel en `/api/dashboard`
- [ ] Gestionar usuarios y asignar roles
- [ ] Ver todos los negocios

### Domiciliario
- [x] Ve su panel en `/api/dashboard`
- [ ] Ver pedidos asignados y actualizar estado de entrega

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
- [ ] Botón "Pedir" (hoy deshabilitado): requiere el flujo de pedidos
- [ ] Vistas web del **administrador** y del **domiciliario** (pendientes, en ese orden)

---

## 7. Pruebas y datos
- [x] Usuarios demo sembrados (`DemoUsersSeeder`), contraseña `password123`:
  `admin@demo.co`, `comerciante@demo.co`, `domiciliario@demo.co`, `cliente@demo.co`
- [x] Verificado manualmente: login por rol, dashboard por rol, comerciante crea negocio (201), cliente bloqueado en zona de comerciante (403)
- [x] Tests automatizados (Pest): 15 tests del flujo de comerciante (negocio, productos, categorías, paginación, búsqueda, soft delete, aislamiento) — `tests/Feature/ComercianteTest.php`. Corren en SQLite en memoria (no tocan MySQL). `RefreshDatabase` activado en `tests/Pest.php`
- [x] Colección **Postman** con todos los endpoints y guardado automático de token — `postman/comercio-api.postman_collection.json` (importable también en Bruno; Thunder Client ya cobra por importar)
- [x] Archivo **`api.http`** (extensión REST Client de VS Code, gratis y sin cuenta) con todos los endpoints y captura automática de token

---

## 8. Pendiente grande (siguiente fase)
- [ ] Flujo de **pedidos** (carrito → pedido → estados): es el núcleo del comercio
- [ ] Endpoints públicos para que el cliente explore negocios y productos
- [ ] Panel real de administrador (gestión de usuarios/roles)
- [ ] Asignación de pedidos a domiciliarios

---

## 📜 Historial de cambios
- **2026-06-23** — Web: **editar producto** desde el panel del comerciante (formulario completo). Nuevas **vistas del cliente**: `/explorar` (negocios abiertos) y `/explorar/{id}` (catálogo por categorías), con botón "Pedir" deshabilitado hasta tener pedidos. Añadida **redirección por rol** tras login (`/home`). Verificado end-to-end (cliente explora; comerciante edita producto y persiste). Pendientes: vistas de admin y domiciliario.
- **2026-06-22** — Creación de este documento de seguimiento. Estado inicial: auth, roles, negocio y productos del comerciante, dashboard por rol y usuarios demo ya implementados; categorías y flujo de cliente/pedidos pendientes.
- **2026-06-22** — **Interfaz web (Blade)** del comerciante: login por sesión + panel `/panel` (role:comerciante) para gestionar negocio, categorías y productos desde el navegador, con Tailwind por CDN. Sirve para ver/probar todo visualmente; la app nativa (React Native CLI) vendrá después sobre la misma API. Verificado el flujo completo (login con CSRF/sesión → panel 200).
- **2026-06-22** — Pulido del comerciante: CRUD de **categorías** (por negocio, nombre único) + asignación validada de `categoria_id` a productos; **soft deletes** en productos; **API Resources** (JSON limpio); **paginación + búsqueda/filtros** del catálogo; **15 tests Pest** del flujo de comerciante (todo verde); colección **Postman** con auto-guardado de token. Añadido `api.http` (REST Client de VS Code, gratis) como alternativa sin suscripción a Thunder Client.
