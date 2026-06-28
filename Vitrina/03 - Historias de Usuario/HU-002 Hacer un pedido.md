---
title: HU-002 Hacer un pedido
tags: [historia]
id: HU-002
actor: Cliente
prioridad: alta
estado: hecho
caso_de_uso: CU-001 Realizar un pedido
actualizado: 2026-06-28
---

# HU-002 — Hacer un pedido

> **Como** [[Cliente]] **quiero** armar un carrito y confirmar un pedido **para** recibir los
> productos en mi dirección.

## ✅ Criterios de aceptación
- [x] Agrego productos al carrito (regla **un carrito = un negocio**).
- [x] En el checkout indico dirección, teléfono y forma de pago (efectivo/transferencia).
- [x] Al confirmar se crea el pedido con **copia** de nombre/precio de cada item y se vacía el carrito.
- [x] El pedido nace en estado `pendiente`.

## 🔗 Relacionado
- [[_MOC Historias]] · [[Cliente]] · [[CU-001 Realizar un pedido]] · [[Lógica de Negocio]]
