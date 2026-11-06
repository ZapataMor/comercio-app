---
title: CU-003 Marcar pedido listo
tags: [caso-uso]
id: CU-003
actor_principal: Comerciante
estado: hecho
historia: HU-005 Atender pedidos
casos_de_prueba: [CP-004]
actualizado: 2026-11-05
---

# CU-003 — Marcar pedido listo

> El [[Comerciante]] acepta un pedido, lo prepara y lo deja disponible para domiciliarios.

## Precondiciones
- Comerciante autenticado, miembro activo del negocio del pedido.
- El pedido está en estado `pendiente`.

## Flujo principal
1. Suena la alarma y el comerciante ve el pedido con los datos del cliente e items.
2. **Acepta** el pedido (`pendiente → aceptado`): la alarma se calla en todo el equipo y se avisa al cliente.
3. Lo prepara y lo marca como **"listo"** (`aceptado → listo`).
4. Se notifica a los [[Domiciliario]]s (`PedidoDisponibleParaDomiciliario`) y al
   [[Cliente]] (`EstadoPedidoActualizado`).

## Flujos alternativos / excepciones
- **A1 — Pedido de otro negocio**: el aislamiento impide actuar sobre pedidos ajenos.
- **A2 — Nadie responde**: a los 5 minutos el pedido se cancela solo y se avisa al cliente y al equipo.
- **A3 — No se puede atender**: se cancela con motivo; pasados 5 minutos de aceptarlo, baja la confiabilidad del negocio.

## Postcondiciones
- El pedido queda en `listo`, visible para domiciliarios.

## 🔗 Relacionado
- [[_MOC Casos de Uso]] · [[HU-005 Atender pedidos]] · [[Reglas de Notificacion]]
- Prueba: [[CP-004 Comercio marca listo]]
