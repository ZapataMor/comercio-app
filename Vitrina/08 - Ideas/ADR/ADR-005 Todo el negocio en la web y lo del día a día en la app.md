---
title: ADR-005 Todo el negocio en la web y lo del día a día en la app
tags: [adr]
id: ADR-005
estado: aceptado
decididores: [Luis]
fecha: 2026-11-25
afecta_a: [web del negocio, app móvil, backend, Vitrina Gestión]
actualizado: 2026-11-25
---

# ADR-005 — Todo el negocio en la web y lo del día a día en la app

> En la **web** se maneja el **100 % del negocio**. La **app móvil** hace una parte: lo que Vitrina ya
> hace en el celular y lo que se hace lejos del computador, con prisa o con el teléfono en la mano.
> Las dos usan el mismo servidor y las mismas reglas.

| | |
|---|---|
| **Estado** | aceptado: el principio lo decidió Luis. El reparto de funciones de abajo es un primer borrador que se ajusta |
| **Fecha** | 2026-11-25 |
| **Decididores** | Luis |

## Contexto
- Hoy el negocio se maneja **solo desde la app**: Mi Tienda, productos, servicios, equipo, pedidos,
  agenda de citas, cuentas para transferencias y reseñas. La web solo tiene el sitio público y el
  panel del [[Administrador]] de Vitrina.
- [[Idea - Vitrina Gestión]] (nace de [[Reunión con Grumar]]) trae inventario por sede, caja,
  personal, compras, proveedores y cuentas: muchos datos, tablas, reportes e impresión. Eso no cabe
  bien en un celular.
- Hay que decidir qué se hace en cada lado antes de diseñar pantallas y la propuesta visual.

> [!warning] Ojo con la palabra «administrador»
> En Vitrina, el **Administrador** es quien opera la plataforma. El del negocio es el **dueño**
> (rol `propietario`) o el **administrador del negocio** (permiso `administrador`). En esta nota,
> «el dueño» incluye a los dos.

## Decisión
1. **La web del negocio lo hace todo.** Cualquier cosa que el negocio pueda hacer en Vitrina se
   puede hacer en la web, incluido lo que hoy solo se hace en la app.
2. **La app hace una parte**, elegida con la regla de abajo. **Lo que el negocio ya hace hoy en la
   app se queda en la app.** La app no tiene nada que la web no tenga, salvo lo que solo existe en
   un teléfono (la alarma de pedidos con la pantalla apagada, el GPS en segundo plano).
3. **Un solo servidor, unas solas reglas.** Web y app muestran; las reglas (precios, existencias,
   permisos, estados) viven en el backend. Lo que se cambia en un lado aparece en el otro en vivo.
4. **Módulos y permisos mandan en los dos lados.** Si el negocio no tiene el módulo o la persona no
   tiene el permiso, la opción no aparece ni en la web ni en la app.
5. **Cliente, domiciliario y transportista siguen en la app.** La web es solo administrativa: el
   cliente no compra desde la web.

## La regla: ¿esto va también a la app?
Va a la app si cumple **al menos una**:
- **Se hace lejos del computador**: en la fábrica, en el mostrador, en la calle o en la casa del
  cliente.
- **Es urgente o llega como aviso**: pedido nuevo, cita, tarea asignada, reclamo de garantía.
- **Usa algo del teléfono**: la cámara (foto del producto, del boceto, del comprobante), el GPS
  (llegada, visita) o las notificaciones.
- **Es corto**: se hace en menos de un minuto (aceptar un pedido, marcar agotado, terminar una tarea).

Se queda **solo en la web**: cargar o revisar muchos datos, tablas largas, reportes, configuración,
la plata del negocio (gastos, pagos al personal, cuentas, facturación), imprimir y exportar.

## Reparto propuesto (borrador)
| Área | En la web (todo) | También en la app |
|---|---|---|
| Inicio | tablero por sede: ventas, pendientes, alertas | resumen del día para el dueño |
| Pedidos de Vitrina | lista, filtros, historial, exportar | atender con alarma, aceptar, cambiar estado, llamar *(ya existe)* |
| Catálogo y servicios | carga en cantidad, importar de Excel, fichas técnicas, guía «Antes de pedir», galería de trabajos | crear o editar uno con foto, marcar agotado *(ya existe)* |
| Mi Tienda | datos, sedes, horario, cuentas para transferencias, módulos y plan | abrir y cerrar, horario, cuentas *(ya existe)* |
| Equipo | invitar, permisos, retirar | lo mismo *(ya existe)* |
| Agenda y visitas | agenda de todas las personas y sedes | mis citas y visitas del día, confirmar, registrar presencial *(ya existe)* |
| Reseñas | ver y responder | ver y responder *(ya existe)* |
| Caja (venta de mostrador) | caja en el computador de cada sede | — |
| Inventario y sedes | existencias, movimientos, traslados, conteos, reportes | consultar la existencia de un producto, aviso de existencias bajas |
| Pedidos a la medida | cotizaciones, precios, cola de fabricación, fechas de entrega, garantías | tomar medidas y fotos en la visita, aprobar una cotización, aviso de reclamo |
| Materiales y proveedores | piezas con nombre y figura, pedidos a proveedores, recibir material | — |
| Personal | trabajadores, asignar tareas, ver llegadas, pagos | **mis tareas** (ver y marcar hecha, con foto si hace falta) y **marcar llegada** |
| Clientes preferenciales | niveles, afiliados, descuentos, avisos y ofertas | — |
| Cuentas y DIAN | ingresos, gastos, compras, reportes, exógena, facturación | — |

## Quién usa qué
- **Dueño o administrador del negocio**: la web para todo; la app para avisos, pedidos, el resumen
  del día y aprobar cosas.
- **Trabajador**: la app para sus tareas, su llegada y lo que sus permisos le den (pedidos,
  catálogo). La web solo si tiene un puesto con computador (por ejemplo, la caja de una sede).
- **Pantalla de la sede** (opcional): la web abierta en un computador o una tablet del taller. Cada
  trabajador escribe su código y ve sus tareas del día o marca su llegada, como la pantalla que el
  señor Ismael recordaba de una empresa donde trabajó. Sirve para quien no tiene celular con datos.
- **Cliente, domiciliario y transportista**: la app.
- **Administrador de Vitrina**: igual que el negocio. La web ya lo tiene casi todo; la app conserva
  lo que tiene hoy.

La web se hace **adaptable**: si a alguien le toca, puede entrar desde el navegador del celular,
aunque no sea tan cómodo como la app.

## Alternativas consideradas
| Opción | Pros | Contras |
|---|---|---|
| Todo en la app (como hoy) | un solo lugar; nada nuevo que construir para la web | inventario, nómina y reportes en una pantalla pequeña; no se puede imprimir ni cargar en cantidad |
| Lo mismo en la web y en la app | cada quien usa lo que quiera | cada función se construye y se prueba dos veces; la app se llena de pantallas pesadas |
| Web solo para lo nuevo y app para lo de hoy | menos trabajo al principio | para manejar el negocio habría que usar las dos; el dueño nunca tiene todo en un lugar |
| **Web con todo y app con una parte** (elegida) | el dueño tiene todo en el computador; la app sigue simple; el trabajador no necesita computador | lo que va en los dos lados se construye dos veces; hay que llevar a la web lo que hoy solo está en la app |

## Consecuencias
- **Positivas**: el negocio se puede manejar completo desde un computador; la app no se vuelve
  pesada; Vitrina Gestión se vende como un sistema completo y no como «otra app».
- **Negativas / costos**: antes de los módulos nuevos hay que **construir la base del panel web del
  negocio y llevar ahí lo que hoy existe en la app** (Mi Tienda, productos, servicios, equipo,
  pedidos, agenda, cuentas, reseñas). Es la fase 0 de [[Idea - Vitrina Gestión]].
- **Riesgos / pendientes**: el ingreso con QR depende de que el teléfono de confianza funcione bien;
  quien use Vitrina Gestión necesita un portátil.

## Decisiones complementarias (2026-11-25)
1. **Caja e inventario solo en la web.** Vitrina Gestión no es para todos los negocios: el que la
   necesite tendrá un portátil. La app no lleva caja ni inventario.
2. **Se entra a la web escaneando un código QR con la app**, como WhatsApp Web, con el teléfono de
   confianza de [[ADR-004 Clave de 4 números y teléfono de confianza]]. No se usa la clave de 4
   números sola para el panel.
3. **El panel del negocio se hace con la misma tecnología de la web actual** (Laravel + Blade, como
   el panel del administrador). Las reglas siguen viviendo en el backend, compartidas con la API de
   la app.
4. **La web es administrativa.** El cliente ve y pide **solo desde la app**. Más adelante se
   organizarán mejor esas reglas; por ahora la web no tiene tienda para clientes.

> [!todo] Al construir el ingreso con QR: definir cuánto dura la sesión web, cómo se cierra desde la
> app y qué pasa si se pierde el teléfono.

## 🔗 Relacionado
- [[_MOC ADR]] · [[Idea - Vitrina Gestión]] · [[Reunión con Grumar]] · [[Idea - Inventario y facturación DIAN]]
- [[ADR-004 Clave de 4 números y teléfono de confianza]] · [[Comerciante]] · [[Administrador]]
