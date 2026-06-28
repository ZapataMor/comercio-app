---
title: CU-003 Marcar pedido listo
tags: [caso-uso]
id: CU-003
actor_principal: Comerciante
estado: hecho
historia: HU-005 Atender pedidos
casos_de_prueba: [CP-004]
actualizado: 2026-06-28
---

# CU-003 — Marcar pedido listo

> El [[Comerciante]] confirma que preparó un pedido y lo deja disponible para domiciliarios.

## Precondiciones
- Comerciante autenticado, dueño del negocio del pedido.
- El pedido está en estado `pendiente`.

## Flujo principal
1. El comerciante ve sus pedidos recibidos con datos del cliente e items.
2. Marca el pedido como **"listo"**.
3. El sistema cambia el estado `pendiente → listo`.
4. Se notifica a los [[Domiciliario]]s (`PedidoDisponibleParaDomiciliario`) y al
   [[Cliente]] (`EstadoPedidoActualizado`).

## Flujos alternativos / excepciones
- **A1 — Pedido de otro negocio**: el aislamiento impide actuar sobre pedidos ajenos.

## Postcondiciones
- El pedido queda en `listo`, visible para domiciliarios.

## 🔗 Relacionado
- [[_MOC Casos de Uso]] · [[HU-005 Atender pedidos]] · [[Reglas de Notificacion]]
- Prueba: [[CP-004 Comercio marca listo]]
