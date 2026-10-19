---
title: CP-004 Comercio marca listo
tags: [caso-prueba]
id: CP-004
caso_de_uso: CU-003 Marcar pedido listo
tipo: integración
estado: pendiente
actualizado: 2026-10-02
---

# CP-004 — Comercio marca listo

> Valida la transición `pendiente → listo` y que se disparan las notificaciones.

| Campo | Valor |
|---|---|
| Caso de uso | [[CU-003 Marcar pedido listo]] |
| Tipo | integración (con `Notification::fake()`) |
| Precondición | pedido `pendiente` de un negocio donde el usuario es miembro activo |

## Pasos
1. `PUT /api/negocios/{negocio}/pedidos/{id}/listo`.
2. Inspeccionar estado y notificaciones encoladas.

## Resultado esperado
- Estado pasa a `listo`.
- Se notifica a domiciliarios (`PedidoDisponibleParaDomiciliario`) y al cliente
  (`EstadoPedidoActualizado`).
- Quien no es miembro del negocio recibe 403 (aislamiento).

## 🔗 Relacionado
- [[_MOC Casos de Prueba]] · [[CU-003 Marcar pedido listo]] · [[Reglas de Notificacion]]
