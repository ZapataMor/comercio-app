---
title: ADR-002 Notificaciones en tiempo real
tags: [adr, notificaciones]
id: ADR-002
estado: propuesto
decididores: []
fecha: 2026-06-28
afecta_a: [notificaciones, app móvil, backend, todos los roles]
actualizado: 2026-06-28
---

# ADR-002 — Notificaciones en tiempo real para cada usuario

> Que cada actor reciba avisos en vivo de lo que le concierne, sin tener que refrescar la vista.

| | |
|---|---|
| **Estado** | propuesto |
| **Fecha** | 2026-06-28 |
| **Decididores** | (pendiente) |

## Contexto
El [[Lógica de Negocio|ciclo del pedido]] atraviesa 4 roles y cada transición **debería** avisar
al actor correcto (ver [[Reglas de Notificacion]]). Hoy:
- **Push FCM — Capa 1 (backend) hecha**: ya se generan `NuevoPedidoParaComercio`,
  `PedidoDisponibleParaDomiciliario`, `EstadoPedidoActualizado`, blindadas para no romper el flujo.
- Falta **Capa 2** (Firebase real) y **Capa 3** (recepción en la app).
- Dentro de la app, los cambios de estado se ven **al refrescar** la pantalla, no en vivo.

Hay que distinguir dos necesidades: (a) **push** cuando la app está cerrada/segundo plano, y
(b) **actualización en vivo** de una pantalla abierta (ej. el cliente mirando el seguimiento, el
domiciliario mirando "disponibles").

## Decisión
Estrategia **en dos canales complementarios, segmentados por usuario**:

1. **Push (app cerrada / segundo plano) → FCM**, completando lo ya empezado:
   - **Capa 2**: proyecto Firebase real + `FIREBASE_CREDENTIALS`.
   - **Capa 3**: `@react-native-firebase/messaging` en la app, registrar el `device_token` al
     login y manejar foreground/background.
2. **Tiempo real en pantalla abierta → WebSockets con Laravel** (Echo + **Laravel Reverb**):
   eventos por **canal privado por usuario** (ej. `App.Models.User.{id}`) para que cada actor solo
   reciba lo suyo. La app se suscribe al abrir las pantallas vivas (seguimiento del cliente,
   disponibles del domiciliario, pedidos del comercio).

Cada notificación se dirige al **destinatario correcto** según [[Reglas de Notificacion]].

## Alternativas consideradas
| Opción | Pros | Contras |
|---|---|---|
| **FCM (push) + Laravel Reverb (WebSockets en vivo)** (elegida) | Cubre app cerrada y pantalla abierta; Reverb es primera-parte de Laravel; canales privados por usuario | Dos mecanismos que mantener |
| **Solo FCM (también para refrescar la UI)** | Una sola pieza; ya empezada | FCM no está pensado para streaming en vivo de UI; latencia/entrega variable |
| **Polling cada N segundos** | Trivial de implementar | Gasta batería/datos y red; no es realmente "tiempo real" |
| **Pusher (SaaS) en vez de Reverb** | Cero infraestructura propia | Costo por conexión/mensaje; dependencia externa |

## Consecuencias
- **Positivas**: experiencia "viva" en el seguimiento de pedidos; avisos aunque la app esté
  cerrada; segmentación por usuario evita fugas de información entre roles.
- **Negativas / costos**: operar un servidor WebSocket (Reverb) además de la API; manejar
  reconexión y autenticación de canales privados (con el token Sanctum).
- **Riesgos / pendientes**:
  > [!todo] Pendiente de decidir
  > - ¿Reverb autohospedado o un SaaS (Pusher/Ably) para empezar?
  > - Estrategia cuando llega **push + websocket** a la vez (no duplicar avisos en pantalla).
  > - Tests del fan-out de notificaciones por rol (ver [[CP-004 Comercio marca listo]]).

## 🔗 Relacionado
- [[_MOC ADR]] · [[Reglas de Notificacion]] · [[Lógica de Negocio]] · [[Estado Actual]]
