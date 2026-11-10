---
title: Estado Actual
tags: [inicio, estado, producto]
estado: en-progreso
actualizado: 2026-11-06
---

# 📊 Estado Actual

> Documento único de seguimiento de Vitrina: qué hay hecho, cómo funciona y qué falta. Revisado
> contra el código el **2026-11-06**. Reemplaza a `backend/ESTADO_DEL_PROYECTO.md`, que se eliminó;
> el historial técnico detallado queda en `git log`.

> [!info] Cómo leer y mantener esta nota
> ✅ hecho y verificado en el código · 🚧 a medias · ⏳ pendiente.
> Al cambiar algo del proyecto: actualiza la sección que corresponda, marca o añade pendientes en
> la sección 13, suma un hito en la 14 si el cambio es grande y pon la fecha en `actualizado`.

## 🎯 Foco actual

**Fase: funcionalidades listas para piloto, sin publicar.** La app solo corre en local, con
emuladores y datos demo. No hay servidor ni usuarios reales.

Lo más reciente (2026-11-03 a 11-06): el negocio acepta los pedidos con alarma, códigos de recogida
y de entrega, oferta de pedidos al domiciliario, cierre confirmado por el dueño, pedidos
personalizables, recetas preferidas, reseñas con moderación y Sentry.

Lo que sigue es sobre todo **fuera del código**: hosting y dominio, Play Store y prueba en teléfonos
reales (sección 13). Antes hay dos reglas por decidir y falta que Google apruebe el servicio de mapas.

| Comprobación | Resultado (2026-11-06) |
| ------------------------- | ---------------------------------- |
| `php artisan test` (Pest) | ✅ 301 tests, 1300 comprobaciones |
| `npx jest` (app) | ✅ 144 tests en 18 archivos |
| `npx tsc --noEmit` | ✅ sin errores |
| `composer audit` | ✅ sin alertas |
| `npm audit` | Sin críticas ni altas; quedan 9 bajas y 11 moderadas |

---

## 0. Qué es la app en una frase

**Vitrina** (repo `comercio-app`) es un marketplace de comercio local para **Maicao** con
domicilios: los negocios publican su catálogo, los clientes piden desde la app, el negocio prepara
y un domiciliario entrega. Ver [[Pitch]] y [[Propuesta de Valor]].

## 1. Arquitectura y stack

```
C:\dev\comercio-app\     repo git (GitHub: ZapataMor/comercio-app), rama main
├── backend/             API Laravel + web del admin
├── frontend/            app React Native (paquete com.comercioapp, marca Vitrina)
└── Vitrina/             vault de Obsidian: negocio, producto y diseño
```

| Capa | Tecnología | Dónde |
| ---- | ---------- | ----- |
| API REST | Laravel 13 · PHP 8.4 · MySQL (`comercio_api`) | `backend/` |
| Autenticación | Sanctum (tokens) · Spatie Permission (roles) | `AuthController.php` |
| Web (solo admin) | Blade + Tailwind CDN, sesión; más `/privacidad` y `/eliminar-cuenta` | `backend/routes/web.php` |
| App móvil | React Native 0.86 · TypeScript · React Navigation | `frontend/` |
| Push | Firebase Cloud Messaging + Notifee · `laravel-notification-channels/fcm` | `pushNotifications.ts`, `Support/Push.php` |
| Mapas | MapLibre + calles de OpenStreetMap (OpenFreeMap), sin clave ni cuenta de Google | `components/Mapa.tsx`, `components/estiloMapa.ts`, `MapaScreen.tsx` |
| Errores | Sentry en la API y en la app, apagado hasta poner los DSN | `DESPLIEGUE.md` §6 |
| Pruebas | Pest (SQLite en memoria) · Jest | `backend/tests/Feature`, `frontend/__tests__` |
| Cola y tareas | `queue:work` y `schedule:work` / cron | `iniciar-dev.bat`, `routes/console.php` |
| Docs de API | Postman y `backend/api.http` | `backend/postman/` |

- La app usa `http://10.0.2.2:8000` en desarrollo y `API_URL_PRODUCCION` en la versión final
  (`frontend/src/config.ts`). 🚧 El dominio real falta: hoy es `api.vitrina.example`.
- Zona horaria `America/Bogota`. La API responde JSON en `api/*` con mensajes en español
  (`backend/lang/es/`).
- Entorno: `ENTORNO.md`. Despliegue: `DESPLIEGUE.md`. Arranque diario:
  [[Cómo levantar el proyecto cada día]].

---

## 2. Cuentas, roles y sesión

### 2.1 Tipos de cuenta ✅
Roles Spatie: `administrador`, `usuario` (cliente) y `domiciliario`. Ver [[Mapa de Actores]].

- **Toda cuenta nueva es Cliente.** Tener un negocio no es un rol: lo decide la membresía (sección 6).
  El rol `comerciante` se eliminó el 2026-10-28.
- **Ser domiciliario** ✅: el cliente se activa solo desde el menú de la cuenta
  (`POST /api/perfil/domiciliario`, exige teléfono) y conserva el rol `usuario`. Puede dejarlo si no
  tiene entregas en curso (`DELETE`); su confiabilidad y un posible veto se conservan.
- El domiciliario no ve, no toma ni recibe el aviso de su propio pedido.
- El administrador se asigna desde el panel de admin.
- **Pantalla inicial según el rol** (`App.tsx`): cliente en Explorar, domiciliario en Entregas,
  negocio y admin en Inicio. Se recalcula al entrar o salir de la cuenta.

### 2.2 Registro ✅
`POST /api/register`. Pide nombre, apellidos, correo, contraseña con confirmación, dirección, barrio
y teléfono, y exige **aceptar la política de privacidad** (Ley 1581, `terminos_aceptados_at`). Crea
el código público (6.2) y la dirección principal; un barrio nuevo queda como sugerencia (5.4).

### 2.3 Sesión ✅
- Login con token Sanctum; sesión persistente en la app (`AuthContext` + AsyncStorage).
- Logout revoca solo ese token y da de baja el token FCM.
- **Recuperar contraseña**: código de 6 dígitos por correo, vence en 15 min, se anula tras 5 fallos
  y cierra las demás sesiones. Nunca revela si el correo existe.
- **Cuenta suspendida** por un admin: no entra y sus sesiones se cierran solas (`CuentaActiva`).
- Límites de intentos con nombre (`AppServiceProvider::limitesDeIntentos`): `acceso`, `codigo-clave`,
  `restablecer-clave`, `eliminar-cuenta`, `publico`, `ubicacion`, `codigo-pedido`.

### 2.4 Mi información ✅
`PUT /api/perfil` y `MiInformacionScreen`, abierta desde el **menú desplegable** del ícono de
usuario. Edita datos personales, contraseña (exige la actual), dirección, barrio y teléfono.

**Eliminar mi cuenta** ✅ (app y web `/eliminar-cuenta`): pide la contraseña, anonimiza los datos y
conserva el historial de pedidos sin contacto; archiva los negocios donde era el único propietario
y borra lo que escribió en reseñas. No deja si hay pedidos en curso.

**Rutas:** `/api/register`, `/login`, `/logout`, `/user`, `/perfil`, `/perfil/domiciliario`,
`/cuenta`, `/dashboard`, `/password/codigo`, `/password/restablecer`.
**Pantallas:** `LoginScreen`, `RegisterScreen`, `MiInformacionScreen`, `HomeScreen`.

---

## 3. Lado del negocio

### 3.1 Mi negocio ✅
- Crear y editar: nombre, descripción, dirección, **barrio** (obligatorio), teléfono, imagen (máx
  4 MB), **pin en el mapa** (`SelectorUbicacion`), tipos de negocio y tiempo de preparación.
- **Abierto/Cerrado**: se cambia manteniendo presionada la tienda en la topbar (campo `activo`).
  Cerrado no recibe pedidos y el cliente lo ve en "Cerrados por ahora".
- Si tiene varios negocios, los cambia desde la topbar. `NegocioContext` guarda el negocio activo.
- **Mi Tienda**: portada, datos rápidos, ubicación, contacto y horario de la semana con el de hoy
  resaltado. El formulario solo aparece al crear o editar.

### 3.2 Catálogo ✅
- CRUD de productos aislado por negocio, con soft delete: lo borrado sale del catálogo pero queda
  en los pedidos antiguos.
- Campos: nombre, descripción, precio en COP, unidad de venta, disponible, imagen, categoría, tipo
  de producto y atributos. `precio_formateado` da `"$8.900 / kg"` o `"$2.500 c/u"`. Ver [[Tipos de Venta]].
- Listado con búsqueda, filtros y paginación (`?buscar`, `?categoria_id`, `?disponible`,
  `?sin_categoria=1`, `?por_pagina`).
- `MisProductosScreen`: formulario en modal deslizable. Las categorías se asignan desde ese
  formulario; su CRUD sigue en la API, con nombre único por negocio y conteo de productos.

### 3.3 Tipos de producto y opciones ✅
Tabla global `tipos_producto`: Comida (ingredientes), Medicamento (para qué sirve), Herramienta,
Ropa y calzado (tallas y colores, por separado), Tecnología, Belleza y aseo, y Otro.

Cada tipo define la pregunta del formulario y sus sugerencias (`ListaAtributos`). Los atributos
entran en la búsqueda del cliente: "gripa" encuentra el medicamento y "pollo" el plato.

### 3.4 Pedidos recibidos ✅
- El **Inicio** tiene cuadros de acceso y separa pedidos en espera, en preparación y por entregar al
  domiciliario. Cada pedido abre `ComercioPedidoDetalle`.
- **Aviso en pantalla**: con la app abierta, en cualquier pantalla, un modal muestra el pedido, su
  total y lo que falta para vencer; solo sale al aceptar, rechazar o cuando ya no hay nada que
  decidir. Varios pedidos aparecen en orden de llegada (`AvisoPedidoNuevo`).
- **Alarma**: suena cada 10 segundos hasta que alguien acepta o rechaza, o el pedido vence, también
  con la app cerrada (sección 7).
- Aceptar, marcar listo, entregar al domiciliario con su código y confirmar el dinero: flujo en la
  sección 5.3. El negocio ve las opciones de cada línea (quitar, extra, talla, color).
- **Rechazar o cancelar** con motivo: pendiente = rechazar; aceptado = libre 5 min y luego −8 de
  confiabilidad; listo sin domiciliario = sin consecuencias.
- **Pedidos y ventas** (`PedidosNegocioScreen`): pestañas En espera, En curso, Entregados y
  Cancelados (20 por página), y resumen de hoy. Las ventas son el subtotal entregado, sin domicilios.
- Contacto: Llamar y WhatsApp al cliente y, mientras lo lleva, al domiciliario. Ver el domiciliario
  en el mapa desde que toma el pedido, y hasta confirmar el dinero si le debe efectivo.

### 3.5 Horario del negocio ✅
- Horario semanal más fila **Festivo** (`EditorHorario`). Los festivos de Colombia se calculan solos
  (`Support/Festivos`). Soporta horarios que pasan la medianoche.
- `negocios:aplicar-horario` abre y cierra cada minuto; un cambio manual se respeta hasta la
  siguiente hora del horario.
- **Confirmar el cierre** ✅: 20 min antes, se le pregunta al dueño por push y con un modal
  (`ConfirmarCierre`) si cierra a esa hora, con opción de cambiarla solo ese día.
- **Aviso de cierre próximo** ✅: el catálogo y el checkout le advierten al cliente que la tienda
  está por cerrar. El cliente ve "Hoy de 7:00 a. m. a 8:00 p. m.".

**Rutas (prefijo `/api/negocios/{negocio}`, autoriza la membresía):** `/`, `/productos`, `/categorias`,
`/pedidos[?grupo=]`, `/pedidos/resumen`, `/pedidos/{id}/aceptar|listo|recogido|cancelar|dinero`,
`/reputacion`. También `/api/negocios/mios/por-aceptar|por-cerrar` y `/api/tipos-producto`.
**Pantallas:** `HomeScreen`, `MiTiendaScreen`, `MisProductosScreen`, `PedidosNegocioScreen`,
`ComercioPedidoDetalleScreen`, `MisNegociosScreen`, `EquipoScreen`.

---

## 4. Lado del cliente

### 4.1 Explorar ✅
- Lista con la foto al frente, separada en "Abiertos ahora" y "Cerrados por ahora"; paginada de 50
  en 50 con scroll infinito. Un toque abre el catálogo.
- Categorías en pestañas (`?tipo_negocio_id`), saludo, botón de mapa y actualización sola del estado.
- Muestra nivel de confiabilidad, tiempo de preparación y promedio de reseñas.
- Los negocios vetados o archivados no salen ni reciben pedidos.

### 4.2 Búsqueda ✅
Encuentra negocios por nombre o categoría y productos, sin importar las tildes.
`GET /api/productos?buscar=` ordena por relevancia (hasta 50): abiertos primero, nombre exacto,
empieza por, contiene, y luego descripción, atributos o categoría. Tocar un producto lleva a la
tienda y lo resalta.

### 4.3 Catálogo y detalle de producto ✅
Cuadrícula de dos columnas con fotos grandes, agrupada por categoría (`NegocioScreen`). El detalle
(`ProductoScreen`) cambia por tipo: tallas y colores en ropa, ingredientes en comida, información
en los demás.

### 4.4 Carrito y checkout ✅
- Guardado en el teléfono, uno por cuenta. Regla **un carrito = un negocio**.
- **Pedidos personalizables**: quitar ingredientes, pedir extra (solo de los que trae el producto)
  y cambiar talla o color, a toda la línea o a algunas unidades. El `+` pregunta por la unidad nueva.
  Se valida en el servidor y queda en cada línea (`Support/OpcionesPedido`).
- **Recetas preferidas** ✅: un plato pedido en 2 pedidos entregados con los mismos ajustes se le
  recomienda en esa tienda, con un toque para agregarlo. No se guarda aparte: sale del historial
  (`Support/RecetasPreferidas`).
- **Costo de domicilio**: tarifa única que fija el admin (4.000 por defecto). `total` = `subtotal` +
  `costo_domicilio`.
- **Checkout**: dirección guardada o nueva, teléfono y pago en efectivo o transferencia.
- `POST /api/pedidos` valida negocio e ítems, copia nombre y precio, y calcula el total en el servidor.
- Animación `FlyToCart` y barra flotante `BarraCliente` (Carrito y Mis pedidos), solo en la vista
  del cliente.

### 4.5 Barrios de Maicao ✅
Catálogo sembrado por comunas, público en `GET /api/barrios`. `BarrioSelect` deja elegir o escribir
uno nuevo, que queda pendiente de aprobación.

### 4.6 Seguimiento ✅
- `PedidoDetalleScreen`: línea de tiempo, código de 8 caracteres del pedido, y refresco por push y
  cada 15 s.
- **Cancelar** hasta que el negocio lo tenga listo. Si nadie acepta en 5 min, se le avisa que el
  pedido no fue recibido.
- **Código de entrega**: nace cuando el negocio confirma la recogida; lo ve en el seguimiento y en
  el aviso, y se lo da al domiciliario.
- Ve al domiciliario en el mapa desde la recogida hasta la entrega.
- Llamar y WhatsApp al negocio, y al domiciliario mientras lo lleva.
- **Mis pedidos**: 20 por página, con insignias "Califica" y "Reseña".

### 4.7 Calificación y reseñas del cliente ✅
Son dos cosas separadas: la calificación alimenta la confiabilidad privada (sección 8) y la reseña
es pública. Un pedido con "nunca me llegó" no se reseña.

**Rutas:** `/api/negocios`, `/negocios/mapa`, `/negocios/{id}`, `/negocios/{id}/recetas-preferidas`,
`/negocios/{id}/resenas`, `/productos`, `/tipos-negocio`, `/barrios`, `/ajustes`,
`/cliente/direcciones`, `/pedidos`, `/pedidos/{id}/cancelar|calificacion|resenas`.
**Pantallas:** `ExplorarScreen`, `NegocioScreen`, `ProductoScreen`, `CarritoScreen`, `CheckoutScreen`,
`MisPedidosScreen`, `PedidoDetalleScreen`, `ResenasScreen`, `MapaScreen`.

---

## 5. Domiciliario, administrador y ciclo del pedido

### 5.1 Domiciliario ✅
- `EntregasScreen` con `PanelDomiciliario`: disponibles, entregas en curso y entregados
  (`PedidosEntregadosScreen`, de 20 en 20).
- **Turno**: se cambia manteniendo presionada la moto en la topbar. Solo en turno llegan las ofertas.
- **Oferta de pedido** ✅ (`OfertaPedido`): un modal con el pedido disponible para aceptar o rechazar.
  Se retira sola, con aviso silencioso, cuando otro lo toma o deja de estar disponible.
- **Tomar** con rueda de minutos de recogida. Si dos lo toman a la vez, solo uno gana.
- **Soltar** antes de recoger: vuelve a ofrecerse a los demás.
- Ve cuánto cobrar y el domicilio. Teléfono del negocio antes de recoger; el del cliente solo cuando
  el pedido es suyo.
- **Novedad**: justifica una demora y le quita el castigo.
- **GPS** cada ~10 s con la app abierta, mientras está en turno, lleva una entrega o debe dinero a
  un negocio. Salir de turno borra la posición y una de más de 5 min no se muestra (el negocio sí la
  ve, con su antigüedad).

### 5.2 Administrador ✅
- Tablero con totales, vetados, reseñas reportadas y tarifa de domicilio (`PUT /admin/ajustes`).
- Usuarios: pestañas Cliente, Domiciliario y Administrador, buscador, 30 por página, crear, cambiar
  tipo (no puede quitarse su propio rol), suspender y reactivar.
- Negocios: dueño, productos, estado, vetado o archivado.
- **Confiabilidad** (`AdminReputacionScreen`): historial, anular eventos, levantar veto y suspender.
- **Reseñas** (`AdminResenasScreen`): ocultar, restaurar y descartar reportes (sección 8.2).
- **Mapa** con los domiciliarios que reportaron hace poco.

### 5.3 Ciclo del pedido ✅
Ver [[Lógica de Negocio]].

```
pendiente → aceptado → listo → tomado → recogido → en_camino → entregado
```

| Paso | Quién | Regla |
| ---- | ----- | ----- |
| Aceptar | Negocio | 5 min o se cancela solo (`pedidos:vencer`, `cancelado_por = sistema`) |
| Marcar listo | Negocio | Solo si está aceptado; el tiempo de preparación cuenta desde ahí |
| Tomar | Domiciliario | Nace el código de recogida; lo ve solo él |
| Recoger | Negocio | Escribe el código que le dicta el domiciliario |
| En camino | Domiciliario | Nace el código de entrega al recoger; lo ve solo el cliente |
| Entregar | Domiciliario | Escribe el código del cliente; queda `entregado_at` |

- `cancelado` es el final alternativo (cliente, negocio o sistema).
- Los códigos son de 4 dígitos, comparten `codigo_confirmacion` con índice único y se liberan al
  entregar o soltar: dos vigentes nunca coinciden. Límite: 6 intentos por minuto, por persona y pedido.
- Cada pedido tiene además `codigo`: 8 letras y números que reemplazan al `#id` en la app y los avisos.
- Pago: `efectivo` o `transferencia`. En efectivo, el negocio confirma el dinero recibido.

### 5.4 Moderación de barrios ✅
`GET /admin/barrios/pendientes`, aprobar o rechazar (`AdminBarriosScreen`). Al rechazar, el cliente
conserva su texto.

**Rutas:** `/api/domiciliario/*` (`role:domiciliario`), `/api/admin/*` (`role:administrador`).

---

## 6. Negocios y equipos ✅

Toda persona es cliente y puede **tener varios negocios** y **trabajar en otros**. El acceso se
decide por membresía (`negocio_user`: `propietario` o `trabajador`, con `activo`), no por el rol
global. Solo el propietario edita el negocio; cualquier miembro activo atiende pedidos.

### 6.1 Invitaciones
`MisNegociosScreen` (cambiar, crear, responder invitaciones, compartir el código) y `EquipoScreen`
(invitar, quitar, cancelar, salir). A un propietario nunca se le quita.

### 6.2 Regla de privacidad del código público
La app **no permite buscar personas**. El trabajador comparte su código (`#U34F4D`, sin 0/O/1/I/L)
fuera de la app, el propietario lo escribe, ve el nombre para confirmar y crea una invitación
pendiente. Solo al aceptar entra al negocio. El código nunca sirve para autenticarse.

**Rutas:** `/api/negocios/mios`, `/negocios/{negocio}/miembros|resolver-codigo|invitar|salir`,
`/negocios/{negocio}/invitaciones/{id}`, `/invitaciones`, `/invitaciones/{id}/aceptar|rechazar`.

---

## 7. Notificaciones push ✅

Ver [[Reglas de Notificacion]].

| Evento | Quién recibe | Notificación |
| ------ | ------------ | ------------ |
| Nuevo pedido | Equipo del negocio | `NuevoPedidoParaComercio` (datos: la app arma la alarma) |
| Pedido atendido | Equipo del negocio | `PedidoYaAtendido` (silenciosa: calla la alarma) |
| Pedido disponible | Domiciliarios en turno | `PedidoDisponibleParaDomiciliario` |
| Oferta retirada | Domiciliarios | `PedidoYaNoDisponible` (silenciosa) |
| Cambio de estado | Cliente | `EstadoPedidoActualizado` |
| Pedido cancelado | La otra parte | `PedidoCancelado` |
| ¿Cierras a esa hora? | Dueños | `PreguntaCierreNegocio` |
| Invitación de trabajo | Invitado | `InvitacionTrabajoRecibida` |

- Van en cola: hace falta `queue:work`. `App\Support\Push` no hace nada si no hay credenciales y
  atrapa los fallos: un push caído nunca rompe un pedido.
- Firebase: proyecto `miproyecto-48045`, credenciales en `backend/storage/app/firebase/`.
- La app registra el token al entrar, lo borra al salir y navega según `tipo` y `pedido_id`, incluso
  si estaba cerrada (`RootNavigation.ts`). Con la app abierta, un push refresca al instante.

**Alarma** (`alarmaPedidos.ts`, `res/raw/alarma_pedido.wav`): notificación con `loopSound` y sonido
de 10 s. Probada en emulador con la app abierta, en segundo plano y cerrada. Tres comportamientos de
Android la condicionan: publicar dos veces la misma notificación la deja muda, solo suena una a la
vez, y bajar la cortina la calla sin avisarle a la app.

---

## 8. Confianza: reputación y reseñas

### 8.1 Nivel de confiabilidad ✅ (privado)
Puntaje 0–100 de negocios y domiciliarios; arranca en 80. Se recalcula siempre desde
`reputacion_eventos`, así un admin puede anular uno injusto. Lógica en `App\Support\Reputacion`,
umbrales en `config/reputacion.php`.

| Quién | Sube | Baja |
| ----- | ---- | ---- |
| Negocio | A tiempo +1, cliente conforme +2 | Tarde −3, mala atención −3, mala calidad −5, incompleto −8, producto equivocado −8, cancelar tras aceptar −8 |
| Domiciliario | Dinero entregado +2, cliente conforme +2 | Recogió tarde −3, llegó tarde −5, mal trato −5, manipulado −15, cobró de más −15, dinero incompleto −15, **nunca llegó −35**, **dinero no entregado −35** |

- **Tiempos**: margen del mayor entre 5 min y 20 %. Una novedad perdona las demoras.
- **Calificación del cliente** (72 h): "Todo bien" o problemas, más **caritas con casco de 1 a 5** para
  el domiciliario en amabilidad, rapidez y estado del producto (1 = −5, 2 = −2, 3 = 0, 4 y 5 = +1).
- **Dinero en efectivo**: el negocio lo confirma hasta 72 h después de recoger.
- **Veto**: puntaje menor a 30, o 2 faltas graves en 30 días. Un domiciliario vetado termina lo que
  lleva pero no toma más; un negocio vetado desaparece de Explorar y no recibe pedidos.
- **Niveles**: Nuevo (< 5 pedidos), Excelente ≥ 90, Confiable ≥ 70, Regular, En riesgo < 50, Vetado.
- **Segunda oportunidad**: levantar el veto deja el puntaje en 50 y las graves viejas no cuentan.
- App: `NivelBadge`, `CalificarPedido`, `Carita`, `HeaderConfiabilidad` en la topbar.

### 8.2 Reseñas públicas ✅
Estrellas 1–5 y comentario, una por tienda y una por producto en cada pedido, hasta 30 días después
de entregado. Se pueden enviar por partes y corregir. **No cambian el puntaje ni pueden vetar.**

- `Support\Resenas::recalcular` mantiene promedios en negocios y productos. El autor sale como "Ana M.".
- **Moderación**: el admin oculta o restaura con motivo (`resena_moderaciones`). Una oculta no sale ni
  cuenta en el promedio, y sigue oculta si el cliente la corrige.
- **Reportes**: cualquier usuario reporta una reseña ajena, una vez. "Dejar publicada" los descarta.
- **Respuesta**: el propietario responde una sola vez, sin edición posterior.

---

## 9. Mapa ✅

Negocios con pin en Explorar → Mapa, domiciliario en el seguimiento y el pedido, y domiciliarios en
el mapa del admin. Desde el 2026-11-10 el mapa ya no depende de Google (que rechazó la cuenta de
facturación): se dibuja con MapLibre sobre OpenStreetMap, con estilo propio de día y de noche
(`ENTORNO.md` §6.1). Visto en el emulador: selector de ubicación de Mi Tienda, mapa de negocios con
pines y tarjeta, y el encuadre del seguimiento con datos de ejemplo. Falta verlo con un pedido real
en camino y en iOS. Los negocios de demostración aún no tienen pin: cada uno lo fija en Mi Tienda.

**Punto de entrega y tiempo estimado (2026-11-10).** El cliente puede marcar cada dirección en el
mapa (opcional, en Mis direcciones y al pedir). El pedido guarda una copia del punto
(`pedidos.entrega_lat/lng`) y, cuando el domiciliario va en camino, el seguimiento muestra «Llega en
unos X min»: distancia en línea recta × 1,35 a 22 km/h más 1 min (`Support/TiempoEntrega.php`), sin
servicios externos ni tráfico. El domiciliario abre «Cómo llegar» con ese punto exacto. Sin punto en
la dirección todo sigue igual que antes, solo que sin tiempo estimado. Pruebas: `PuntoEntregaTest`.

---

## 10. Identidad visual y experiencia

Ver [[_MOC Diseño]] y [[Sistema Visual]].

- Logo "Toldo" con **modo día (05:00–17:59) y noche**. Toda la app sigue ese modo con
  `frontend/src/theme.tsx`. Splash animado que respeta "reducir movimiento".
- Paleta Ámbar & Grafito, Sora + Inter, íconos de línea propios en SVG (`Icon.tsx`), sin emojis.
- Avisos con `Toast.tsx` y confirmaciones con el diálogo propio `Confirmacion.tsx`, nunca la alerta
  del sistema. Errores de validación por campo (`FieldError`, `formErrors.ts`).
- Menú de usuario en cascada con fondo borroso (`MenuDesplegable`, `Desenfoque`).
- Las pantallas se actualizan en su sitio. `usePolling`: cada 15 s, solo con la pantalla visible, y
  al instante con un push.

---

## 11. Web, datos demo y herramientas

**Web (solo admin):** decisión del 2026-10-28, un solo frontend. Quedan `/admin` (tablero, usuarios,
negocios) y las páginas públicas `/privacidad` y `/eliminar-cuenta` que exige Play Store.

**Datos demo:** `php artisan migrate:fresh --seed` siembra roles, barrios, usuarios, catálogo,
opciones, menús de restaurantes, reseñas y recetas. Imágenes aparte con
`php artisan db:seed --class=ImagenesDemoSeeder`.

- Contraseña de todos: `password123`. Usuarios: `admin@demo.co`, `comerciante@demo.co` (dueño de "El
  Rincón Paisa"), `domiciliario@demo.co`, `cliente@demo.co`.
- Cada negocio demo tiene su dueño `{slug}@demo.co`; la lista está en `comercios-demo.txt`.
- Catálogo: unos 59 negocios, 364 categorías y 980 productos, más las cartas de restaurantes.

**Comandos**

```bash
cd backend && php artisan test
```

```bash
cd frontend && npx jest
```

```bash
cd frontend && npx tsc --noEmit
```

- Tras añadir un módulo nativo hay que recompilar con `npx react-native run-android`.
- Tres emuladores, uno por rol. Pail no sirve en Windows (falta `pcntl`): los logs se leen en
  `backend/storage/logs/laravel.log`.

---

## 12. Modelo de datos (mapa rápido)

```
users ──< negocio_user >── negocios ──< productos ──> tipos_producto
  │  (rol, activo)             │  ──< categorias
  │                            │  ──< negocio_tipo_negocio >── tipos_negocio
  │                            │  ──< pedidos ──< pedido_items (copia nombre, precio y opciones)
  ├──< invitaciones_trabajo ───┘        ├── user_id (cliente)
  ├──< cliente_direcciones              ├── domiciliario_id
  ├──< device_tokens                    └──< resenas ──< resena_reportes, resena_moderaciones
  └── codigo_publico, direccion, barrio, telefono, en_turno, suspendido_at, eliminado_at
reputacion_eventos · calificaciones · barrios · ajustes
```

- `negocios`: `horario`, `barrio`, `lat`/`lng`, `tiempo_preparacion`, `archivado_at`, `vetado_at`,
  `reputacion`, `resenas_promedio`, `resenas_total`.
- `pedidos`: `codigo`, `codigo_confirmacion`, `subtotal`, `costo_domicilio`, `total`,
  `minutos_preparacion`, `minutos_recogida`, marcas de cada paso (`aceptado_at`…`entregado_at`),
  `novedad`, `dinero_estado`, `cancelado_por`, `motivo_cancelacion`.

---

## 13. Pendientes y próximos pasos

**Por decidir**
- [ ] Qué consecuencia tiene para el negocio dejar vencer un pedido sin responder. Hoy no le baja
      puntos; se definirá con su reputación.
- [ ] Qué pasa si el cliente no aparece o no da el código. Hoy el pedido se queda `en_camino`.

**Prioridad 1 — publicar el piloto**
- [ ] Google aprueba el servicio de mapas y se revisan en pantalla.
- [ ] Compilar el APK y probarlo: el CLI de React Native y Metro subieron el 2026-11-06 y solo se
      verificó el bundle.
- [ ] Probar la alarma en teléfonos reales: suena con el volumen de notificaciones y algunas marcas
      (Xiaomi, Oppo...) bloquean las apps cerradas sin inicio automático.
- [ ] Elegir hosting y dominio; montar servidor, cola, cron, SMTP y HTTPS (`DESPLIEGUE.md`).
- [ ] Poner el dominio real en `API_URL_PRODUCCION` y llenar `VITRINA_*`.
- [ ] Revisar con un asesor el texto de `/privacidad` (Ley 1581).
- [ ] Decidir el `applicationId` antes de subir a Play Store (hoy `com.comercioapp`; cambiarlo exige
      re-registrar la app en Firebase).
- [ ] Crear la llave de subida y la cuenta de Google Play; ficha con privacidad y borrado de cuenta.
- [ ] Crear la cuenta de Sentry y poner los DSN (`DESPLIEGUE.md` §6).
- [ ] Piloto cerrado con 3–5 negocios de Maicao y 2–3 domiciliarios.
- [ ] Ya en producción: copias de seguridad de la base de datos y las fotos (`DESPLIEGUE.md` §7).

**Prioridad 2 — después del piloto**
- [ ] iOS: `GoogleService-Info.plist`, firma, prueba en iPhone y alarma (el mensaje de datos no
      muestra nada allá).
- [ ] Tiempo real dentro de la app ([[ADR-002 Notificaciones en tiempo real]]); hoy push + 15 s.
- [ ] Tarifa de domicilio por barrio o zona; definir el modelo de ingresos ([[Modelo de Negocio]]).
- [ ] Reclamo cuando un pedido queda "en camino" y nunca se entrega.
- [ ] Push al domiciliario o negocio cuando queda vetado o en riesgo; hoy solo lo ve en la app.
- [ ] Ordenar Explorar por confiabilidad; hoy solo se muestra el nivel.
- [ ] Enviar los códigos también por WhatsApp con la API oficial de Meta. Hace falta cuenta de Meta
      Business, número dedicado y plantilla aprobada; confirmar tarifa en Colombia y si exige
      verificar la empresa. Idea ligada: que el comerciante escriba el código de recogida al WhatsApp
      de Vitrina y el servidor lo valide.
- [ ] Con el mapa funcionando: modal para escribir el código de recogida cuando el domiciliario esté
      muy cerca del negocio.
- [ ] Dependencias: `@react-native-firebase` a 27 (revisar si aún hace falta el override de
      `@grpc/grpc-js`) y las alertas moderadas que quedan en Sentry, `eslint-config` y `deepmerge`.

**Prioridad 3 — ideas**
- [ ] Búsqueda semántica tolerante a errores ([[Idea - Busqueda semantica]]).
- [ ] Orden por cercanía ([[Idea - Orden por cercania]]).
- [ ] Pagos en línea ([[Idea - Pagos en linea]]).
- [ ] Login con Google ([[ADR-001 Inicio de sesión con Google]]).

---

## 14. Hitos

| Fecha | Hito |
| ----- | ---- |
| 2026-06-22 | Inicio: autenticación, roles y catálogo; primera web Blade |
| 2026-06-24 | Monorepo fuera de OneDrive; flujo de pedidos web; app corriendo en emulador |
| 2026-06-26 | Ciclo completo de compra en la app |
| 2026-06-29 | Push con Firebase en las tres capas; íconos y toasts |
| 2026-07-05 | Marca Vitrina, barrios, direcciones, tipos de negocio y búsqueda por relevancia |
| 2026-07-06 | Tipos de producto y atributos |
| 2026-10-02 | Modelo multi-negocio con equipos, completo |
| 2026-10-28 | Revisión general: cancelaciones, domicilio, ventas, cuentas y operación del piloto; reputación; se eliminan el rol `comerciante` y la web que no era del admin |
| 2026-10-31 | Mapa: negocios y domiciliarios en vivo |
| 2026-11-03 | Cliente que se hace domiciliario, caritas, festivos y pedidos personalizables |
| 2026-11-05 | El negocio acepta pedidos: alarma, vencimiento y códigos |
| 2026-11-06 | Oferta al domiciliario, cierre confirmado, códigos únicos, Sentry, auditoría de dependencias, reseñas con moderación, recetas preferidas y menús demo |

---
## 🔗 Relacionado
- [[🏠 Home]] · [[Lógica de Negocio]] · [[Flujos de Usuario]]
- [[Wireframes y Pantallas]] · [[Reglas de Notificacion]] · [[Tipos de Venta]] · [[Glosario]]
- [[_MOC Actores]] · [[_MOC Historias]] · [[_MOC Ideas]]
