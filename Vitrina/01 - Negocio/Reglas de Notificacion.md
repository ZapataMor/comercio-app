---
title: Reglas de Notificacion
tags: [negocio, reglas, notificaciones]
estado: en-progreso
actualizado: 2026-11-05
---

# 🔔 Reglas de Notificación (push / FCM)

Quién recibe notificación en cada transición del [[Lógica de Negocio|ciclo del pedido]].
Las tres capas están hechas: envío en cola, Firebase y recepción en la app.

| Evento | Notificación | Destinatario |
|---|---|---|
| Cliente crea pedido (`pendiente`) | `NuevoPedidoParaComercio` (mensaje de datos: hace sonar la alarma) | Todo el equipo del negocio |
| Comercio acepta (`aceptado`) | `EstadoPedidoActualizado` | [[Cliente]] |
| Comercio acepta o rechaza | `PedidoYaAtendido` (silencioso: calla la alarma) | Todo el equipo del negocio |
| Comercio marca `listo` | `PedidoDisponibleParaDomiciliario` | [[Domiciliario]]s en turno |
| Comercio marca `listo` | `EstadoPedidoActualizado` | [[Cliente]] |
| Domiciliario suelta el pedido | `PedidoDisponibleParaDomiciliario` | Los demás [[Domiciliario]]s en turno |
| Domiciliario suelta el pedido | `EstadoPedidoActualizado` ("Cambio de domiciliario") | [[Cliente]] |
| `tomado`/`recogido`/`en_camino`/`entregado` | `EstadoPedidoActualizado` (el de "en camino" trae el código de entrega) | [[Cliente]] |
| Cliente cancela | `PedidoCancelado` | Todo el equipo del negocio |
| Comercio rechaza o cancela | `PedidoCancelado` | [[Cliente]] |
| Nadie acepta en 5 minutos | `PedidoCancelado` ("Tu pedido no fue recibido") | [[Cliente]] y equipo del negocio |

## Regla de oro
El envío está **blindado**: si Firebase no está configurado, no hace nada; si un envío falla,
se registra en log y **nunca rompe el flujo de pedidos** (`App\Support\Push`).

## Soporte
- Un usuario puede tener **varios dispositivos** (`device_tokens`).
- El token se registra al iniciar sesión y se da de baja al cerrar sesión.

## 🔗 Relacionado
- [[Lógica de Negocio]] · [[Estado Actual]] · [[Idea - Mapa en tiempo real]]
