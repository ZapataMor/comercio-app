---
title: CP-005 Tomar pedido
tags: [caso-prueba]
id: CP-005
caso_de_uso: CU-004 Entregar un pedido
tipo: integración
estado: pendiente
actualizado: 2026-06-28
---

# CP-005 — Tomar pedido (anti-choque)

> Valida que solo un domiciliario puede tomar un pedido `listo` (update condicional).

| Campo | Valor |
|---|---|
| Caso de uso | [[CU-004 Entregar un pedido]] (A1) |
| Tipo | integración |
| Precondición | pedido en `listo` |

## Pasos
1. Domiciliario A: `PUT /api/domiciliario/pedidos/{id}/tomar` con minutos.
2. Domiciliario B intenta tomar el mismo pedido.

## Resultado esperado
- A obtiene el pedido en estado `tomado`.
- B recibe que el pedido ya no está disponible (sin doble asignación).

## 🔗 Relacionado
- [[_MOC Casos de Prueba]] · [[CU-004 Entregar un pedido]]
