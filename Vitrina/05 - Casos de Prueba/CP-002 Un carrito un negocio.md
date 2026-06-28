---
title: CP-002 Un carrito un negocio
tags: [caso-prueba]
id: CP-002
caso_de_uso: CU-001 Realizar un pedido
tipo: integración
estado: pendiente
actualizado: 2026-06-28
---

# CP-002 — Un carrito = un negocio

> Valida la regla de negocio de que el carrito solo admite productos de un negocio a la vez.

| Campo | Valor |
|---|---|
| Caso de uso | [[CU-001 Realizar un pedido]] (A1) |
| Tipo | integración |
| Precondición | carrito con un producto del negocio A |

## Pasos
1. Agregar producto del negocio A al carrito.
2. Intentar agregar un producto del negocio B.

## Resultado esperado
- El sistema rechaza o exige vaciar el carrito (no mezcla negocios).

## 🔗 Relacionado
- [[_MOC Casos de Prueba]] · [[Lógica de Negocio]]
