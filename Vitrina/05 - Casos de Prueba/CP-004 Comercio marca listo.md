---
title: CP-004 Comercio marca listo
tags: [caso-prueba]
id: CP-004
caso_de_uso: CU-003 Marcar pedido listo
tipo: integración
estado: pendiente
actualizado: 2026-06-28
---

# CP-004 — Comercio marca listo

> Valida la transición `pendiente → listo` y que se disparan las notificaciones.

| Campo | Valor |
|---|---|
| Caso de uso | [[CU-003 Marcar pedido listo]] |
| Tipo | integración (con `Notification::fake()`) |
| Precondición | pedido `pendiente` del negocio del comerciante |

## Pasos
1. `PUT /api/comerciante/pedidos/{id}/listo`.
2. Inspeccionar estado y notificaciones encoladas.

## Resultado esperado
- Estado pasa a `listo`.
- Se notifica a domiciliarios (`PedidoDisponibleParaDomiciliario`) y al cliente
  (`EstadoPedidoActualizado`).
- Un comerciante ajeno recibe 403 (aislamiento).

## 🔗 Relacionado
- [[_MOC Casos de Prueba]] · [[CU-003 Marcar pedido listo]] · [[Reglas de Notificacion]]
