---
title: Idea - Vitrina Gestión
tags: [idea, estrategia, planes]
estado: semilla
impacto: alto
esfuerzo: alto
actualizado: 2026-11-25
---

# 💡 Vitrina Gestión: el negocio se maneja desde Vitrina

> Extender Vitrina para que, además de vender, sea **el sistema con el que el negocio funciona**:
> inventario, producción, personal, clientes y cuentas. Un solo código para todos, con **módulos que
> se encienden** y **plantillas por tipo de negocio**, para que cada negocio la sienta hecha a su medida.
> Nace de la reunión con [[Reunión con Grumar|Grumar]], el primer negocio que la pide.

## Problema que resuelve
- Los negocios medianos de Maicao llevan todo en **papel y WhatsApp**: ventas, compras, gastos,
  inventario, tareas del personal. El señor Ismael (Grumar, 3 sedes, 25 a 30 empleados) lo dijo así:
  todo va «a lápiz y papel».
- Un programa hecho a la medida para cada negocio es caro (en la reunión se habló de **8 a 9
  millones**) y lo tendría que mantener yo uno por uno.
- Si el catálogo de la tienda y el inventario están en sitios distintos, se vende lo que no hay.
- **Para Vitrina**: un negocio que maneja su operación aquí no se va, paga un plan más alto y trae
  su catálogo completo a la vitrina.

## La clave: personalizar con configuración, no con código aparte
Hacer un programa distinto para cada negocio no escala. La propuesta:

1. **Núcleo común** (lo que ya existe): negocio, equipo con permisos, catálogo, pedidos, citas,
   reseñas, avisos.
2. **Módulos** que se encienden por negocio (y se cobran en el plan):
   | Módulo | Qué trae | Sirve a |
   |---|---|---|
   | Inventario y caja | existencias, venta de mostrador, agotado automático | casi todos |
   | Varias sedes | inventario y ventas por sede, traslados | negocios con sucursales |
   | Personal | tareas por semana y por día, llegadas y días trabajados, pagos | negocios con empleados |
   | Clientes | niveles por frecuencia de compra, descuentos por %, afiliados, avisos | casi todos |
   | Pedidos a la medida | cotización, bocetos, anticipo, fecha de entrega, garantía | talleres y fábricas |
   | Producción y materiales | materia prima que se descuenta al fabricar | talleres y fábricas |
   | Compras y proveedores | pedidos con figuras y medidas, sin WhatsApp | quien compra materiales |
   | Cuentas | ingresos, gastos, compras por tercero, reportes para el contador | todos los que declaran |
   | Facturación DIAN | factura y POS electrónicos con un proveedor autorizado | obligados a facturar |
3. **Plantillas por tipo de negocio**: al crear un negocio de cierto tipo, se encienden los módulos
   que le sirven y se cargan sus **campos de producto**. Por ejemplo, la plantilla *Latonería y
   ornamentación* trae puerta, ventana, portón, reja y escalera, con medidas, material, calibre,
   color, lado de apertura y «con reja o sin reja». Una peluquería traería otra cosa.
4. **Campos propios del negocio**: si a un negocio le falta un dato, lo agrega él mismo sin que yo
   toque el código.

Así «personalizada para cada uno» significa **configurada para cada uno**, y lo que mejore para un
negocio les llega a todos.

## Web para todo el negocio, app para el día a día
Decidido en [[ADR-005 Todo el negocio en la web y lo del día a día en la app]]:
- **Web del negocio**: el 100 % de la administración (catálogo, inventario, caja, compras, personal,
  clientes, cuentas, reportes, imprimir y exportar), incluido lo que hoy solo se hace en la app.
- **App móvil**: lo que el negocio ya hace hoy en el celular, más lo que se hace lejos del
  computador, con prisa o con la cámara y el GPS (el trabajador ve sus tareas y marca su llegada;
  el dueño recibe avisos y aprueba). Cliente, domiciliario y transportista siguen en la app.

## Lo que ya existe y sirve
- **Tipos de producto** (ya definen qué pide el formulario: ingredientes, tallas, usos…): la base
  de las fichas técnicas por plantilla.
- [[Tipos de Venta]] (cantidad, peso, volumen, longitud) → unidades del inventario y de los materiales.
- **Equipo con permisos** (propietario, trabajador, `modificar_inventario`, `gestionar_pedidos`…)
  → se agregan permisos por módulo (ver cuentas, ver pagos al personal…).
- **Servicios y citas** ([[Citas-y-servicios]]) → la *visita para tomar medidas* o asesoría.
- **Pedidos con estados** → pedidos a la medida con estados de cotización y fabricación.
- **Fotos y galerías** → imágenes de productos, bocetos de clientes y trabajos hechos.
- **Notificaciones push** → tarea asignada, cotización lista, llegó el material, oferta nueva.
- **Panel web del administrador** → base del panel web del negocio.

## Ideas que salen de Grumar y sirven a muchos
- **Configurador en vez de dibujo libre**: el cliente elige «puerta», escribe ancho y alto, para
  qué lado abre y si lleva reja, y la app dibuja el esquema con medidas y calcula un precio
  aproximado. Es más fácil de usar y de construir que un lienzo de dibujo libre. Además, el cliente
  puede subir la foto de su boceto a mano.
- **Piezas con nombre para proveedores**: la figura se dibuja una sola vez con sus medidas y luego
  se pide «por el nombre» y la cantidad. Se le manda al proveedor como imagen o PDF.
- **Guía «Antes de pedir»**: el dueño publica recomendaciones con fotos y pasos (cómo medir un vano,
  qué preguntar antes de pedir un portón) y una **galería de trabajos hechos**.
- **Asesoría o visita a domicilio**: un servicio con cita en la dirección del cliente, con precio
  opcional que se le paga al negocio en efectivo o transferencia (Vitrina no cobra comisión ni
  maneja pagos; ver [[Idea - Pagos en linea]]).
- **Niveles de cliente**: 1A, 1B… según la frecuencia de compra, que vencen si el cliente deja de
  comprar en 6 meses, con un **descuento por porcentaje** para todo el catálogo.
- **Afiliados**: constructoras, ingenieros, arquitectos, ferreterías y compradores mayoristas entran
  con un código o una aprobación del negocio y ven su precio preferencial.
- **Avisos a los clientes del negocio**: llegó tal material, producto nuevo, oferta del viernes.
- **Garantías**: cada trabajo entregado queda con su garantía (12 o 18 meses) y el cliente la
  reclama desde la app; el reclamo se vuelve una tarea para el equipo.
- **Transportistas** (nuevo actor, como el [[Domiciliario]] pero para carga grande o viajes a otros
  municipios): dicen a dónde llevan y el cliente los encuentra en Vitrina.

## Fases sugeridas
Cada fase se puede mostrar y cobrar por separado. El orden prioriza lo que más le duele a Grumar
y lo que más reutiliza de Vitrina; el detalle está en [[Reunión con Grumar#🪜 Propuesta de fases para Grumar]].

0. **Base del panel web del negocio** (Laravel + Blade, como el panel actual): entrar con un QR
   desde la app, menú por módulos y permisos, y llevar ahí lo
   que hoy solo está en la app (Mi Tienda, productos, servicios, equipo, pedidos, agenda, cuentas y
   reseñas). Lo exige [[ADR-005 Todo el negocio en la web y lo del día a día en la app|ADR-005]].
1. **Catálogo, inventario y caja por sede** (lo de [[Idea - Inventario y facturación DIAN]] fase 1,
   con sedes y la plantilla de latonería).
2. **Gastos, compras y reportes** (egresos, compras por proveedor, archivo para el contador).
3. **Personal**: tareas por semana y por día, llegadas y días trabajados.
4. **Pedidos a la medida**: cotización, configurador, visita para medir, guía «Antes de pedir»,
   galería, fecha de entrega y garantías.
5. **Producción, materiales y proveedores** (piezas con nombre, compras con figuras).
6. **Clientes preferenciales**: niveles, afiliados, descuento por % y avisos.
7. **Facturación DIAN y pagos al personal**, con un proveedor tecnológico autorizado.

> [!info] Construido el 2026-11-25 (base de la fase 0)
> - **Módulos en el código**: `backend/app/Gestion/Modulos.php` (núcleo y opcionales, dependencias,
>   permisos, secciones y lo que va a la app). Reglas en `Gestion.php`; entrada con código en `AccesosWeb.php`.
> - **Base de datos**: `plantillas_gestion`, `negocio_modulos`, `sedes`, `accesos_web`,
>   `negocios.gestion_activa` y `negocio_user.permisos_gestion`. Plantillas iniciales: «Negocio con
>   inventario» y «Latonería y ornamentación».
> - **Super administrador** en `/admin/gestion`: encender el panel, aplicar plantillas, módulos,
>   plantillas con ficha técnica y cerrar sesiones web.
> - **Panel del negocio** en `/negocio`: se entra con el código aprobado en la app (*Mis negocios →
>   Entrar a la web*); menú por módulos y permisos. Funcionan **Sedes** y los **permisos por módulo**
>   en Equipo; el núcleo se ve pero se edita en la app; los demás módulos muestran su estructura.
> - Falta: escanear el QR con la cámara, editar el núcleo en la web y construir cada módulo.

## Cómo cobrarlo
- Plan base de Vitrina + **módulos** que se suman al precio (lo que se habló con el señor Ismael:
  agregar «este tipo de cosas» al plan y cobrarlas directamente).
- Un **pago de implementación** por única vez: cargar el catálogo, las figuras y el personal, y
  capacitar al equipo.
- En la reunión se mencionó un tope de **200.000 pesos al mes**. Ver [[Planes de membresía]].

> [!todo] Pendiente: decidir precios de los módulos, si el pago de implementación se cobra y cuánto,
> y si Grumar entra como piloto con descuento a cambio de probar y dar su opinión.

## Riesgos
- **Alcance enorme**: todo junto es un ERP. Si se construye de una vez, frena la publicación de
  Vitrina (`PENDIENTES-PUBLICACION.md` del repo). Por eso va por fases y cada fase debe servir sola.
- **Normas de la DIAN** (facturación, nómina electrónica, exógena): no volverse software contable;
  conectarse con un proveedor autorizado y entregar reportes al contador.
- **Datos personales** de empleados y clientes (Ley 1581): permisos claros, nada de datos de pago.
- **Datos malos**: si no registran las ventas de mostrador o los materiales usados, el inventario
  miente y la culpa se la echan a la app.
- **Dependencia de un solo cliente**: diseñar cada módulo pensando en varios tipos de negocio, no
  solo en Grumar.

## Impacto vs. esfuerzo
- **Impacto**: alto — nuevo segmento (negocios medianos), planes más caros y negocios que no se van.
- **Esfuerzo**: alto — por eso se construye por fases, cada una con un negocio real probándola.

## 🔗 Relacionado
- [[_MOC Ideas]] · [[_MOC Estrategia]] · [[Reunión con Grumar]] · [[Idea - Inventario y facturación DIAN]]
- [[Planes de membresía]] · [[Citas-y-servicios]] · [[Tipos de Venta]] · [[Modelo de Negocio]]
