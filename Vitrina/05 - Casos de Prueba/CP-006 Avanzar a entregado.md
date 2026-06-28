---
title: CP-006 Avanzar a entregado
tags: [caso-prueba]
id: CP-006
caso_de_uso: CU-004 Entregar un pedido
tipo: e2e
estado: pendiente
actualizado: 2026-06-28
---

# CP-006 — Avanzar a entregado (ciclo completo)

> Valida el ciclo end-to-end del pedido a través de los 4 roles hasta `entregado`.

| Campo | Valor |
|---|---|
| Caso de uso | [[CU-004 Entregar un pedido]] |
| Tipo | e2e |
| Precondición | pedido tomado por un domiciliario |

## Pasos
1. Cliente confirma pedido (`pendiente`).
2. Comercio marca `listo`.
3. Domiciliario `tomar` → `recogido` → `en_camino` → `entregado`.

## Resultado esperado
- El pedido recorre todos los estados en orden.
- El cliente ve "Entregado"; aparece en el historial del domiciliario.
- Cada transición notifica a quien corresponde ([[Reglas de Notificacion]]).

## 🔗 Relacionado
- [[_MOC Casos de Prueba]] · [[CU-004 Entregar un pedido]] · [[Lógica de Negocio]]
