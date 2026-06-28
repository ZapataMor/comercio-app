---
title: HU-003 Seguir mi pedido
tags: [historia]
id: HU-003
actor: Cliente
prioridad: alta
estado: hecho
caso_de_uso: CU-001 Realizar un pedido
actualizado: 2026-06-28
---

# HU-003 — Seguir mi pedido

> **Como** [[Cliente]] **quiero** ver el estado de mi pedido **para** saber cuándo llega.

## ✅ Criterios de aceptación
- [x] Veo "Mis pedidos" y el detalle de cada uno.
- [x] El detalle muestra una **línea de tiempo** de estados (`pendiente`→…→`entregado`).
- [ ] Recibo una **notificación push** en cada cambio de estado (Capa 3 pendiente — ver [[Reglas de Notificacion]]).

## 🔗 Relacionado
- [[_MOC Historias]] · [[Cliente]] · [[Lógica de Negocio]] · [[Reglas de Notificacion]]
