---
title: CP-001 Crear pedido válido
tags: [caso-prueba]
id: CP-001
caso_de_uso: CU-001 Realizar un pedido
tipo: integración
estado: pendiente
actualizado: 2026-06-28
---

# CP-001 — Crear pedido válido

> Valida que confirmar un checkout crea un pedido `pendiente` con copia de items y vacía el carrito.

| Campo | Valor |
|---|---|
| Caso de uso | [[CU-001 Realizar un pedido]] |
| Tipo | integración (Pest, SQLite en memoria) |
| Precondición | cliente autenticado, negocio activo con productos disponibles |

## Pasos
1. Agregar 2 productos de un negocio al carrito.
2. `POST /api/pedidos` con dirección, teléfono y `metodo_pago = efectivo`.
3. Consultar `GET /api/pedidos`.

## Resultado esperado
- Respuesta 201; pedido en estado `pendiente`.
- `pedido_items` con copia de nombre y precio de cada producto.
- El carrito queda vacío.

## 🔗 Relacionado
- [[_MOC Casos de Prueba]] · [[CU-001 Realizar un pedido]]
