---
title: CU-004 Entregar un pedido
tags: [caso-uso]
id: CU-004
actor_principal: Domiciliario
estado: hecho
historia: HU-006 Tomar y entregar pedidos
casos_de_prueba: [CP-005, CP-006]
actualizado: 2026-06-28
---

# CU-004 — Entregar un pedido

> El [[Domiciliario]] toma un pedido `listo` y lo lleva hasta el [[Cliente]].

## Precondiciones
- Domiciliario autenticado (rol `domiciliario`).
- Existe al menos un pedido en estado `listo`.

## Flujo principal
1. El domiciliario ve los pedidos **disponibles** (`listo`).
2. **Toma** uno indicando los **minutos de recogida** → estado `tomado`.
3. Marca **Recogido** (`recogido`), luego **En camino** (`en_camino`), luego **Entregado** (`entregado`).
4. En cada transición se notifica al cliente (`EstadoPedidoActualizado`).

## Flujos alternativos / excepciones
- **A1 — Carrera al tomar**: si dos domiciliarios intentan tomar el mismo pedido, el *update
  condicional* anti-choque permite que solo uno lo logre; el otro recibe que ya no está disponible.

## Postcondiciones
- El pedido llega a `entregado` — fin del [[Lógica de Negocio|ciclo]]. Aparece en el historial
  del domiciliario y como "Entregado" para el cliente.

## 🔗 Relacionado
- [[_MOC Casos de Uso]] · [[HU-006 Tomar y entregar pedidos]] · [[Lógica de Negocio]]
- Pruebas: [[CP-005 Tomar pedido]] · [[CP-006 Avanzar a entregado]]
