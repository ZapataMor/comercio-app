---
title: Reglas de Notificacion
tags: [negocio, reglas, notificaciones]
estado: en-progreso
actualizado: 2026-06-28
---

# 🔔 Reglas de Notificación (push / FCM)

Quién recibe notificación en cada transición del [[Lógica de Negocio|ciclo del pedido]].
Backend (Capa 1) hecho; recepción en la app (Capa 3) pendiente.

| Evento | Notificación | Destinatario |
|---|---|---|
| Cliente crea pedido (`pendiente`) | `NuevoPedidoParaComercio` | [[Comerciante]] |
| Comercio marca `listo` | `PedidoDisponibleParaDomiciliario` | [[Domiciliario]]s |
| Comercio marca `listo` | `EstadoPedidoActualizado` | [[Cliente]] |
| Domiciliario `tomado`/`recogido`/`en_camino`/`entregado` | `EstadoPedidoActualizado` | [[Cliente]] |

## Regla de oro
El envío está **blindado**: si Firebase no está configurado, no hace nada; si un envío falla,
se registra en log y **nunca rompe el flujo de pedidos** (`App\Support\Push`).

## Soporte
- Un usuario puede tener **varios dispositivos** (`device_tokens`).
- El token se registra al iniciar sesión y se da de baja al cerrar sesión.

## 🔗 Relacionado
- [[Lógica de Negocio]] · [[Estado Actual]] · [[Idea - Mapa en tiempo real]]
