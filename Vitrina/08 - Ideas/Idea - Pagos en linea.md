---
title: Idea - Pagos en linea
tags: [idea]
estado: semilla
impacto: alto
esfuerzo: alto
actualizado: 2026-06-28
---

# 💡 Pagos en línea

> Integrar una pasarela de pago, además de efectivo/transferencia manual.

## Problema que resuelve
Hoy el pago es `efectivo` o `transferencia` (manual, sin confirmación automática). Un pago en
línea reduce fricción y habilita un posible cobro de comisión automático ([[Modelo de Negocio]]).

## Cómo podría funcionar
- Pasarela (ej. Wompi/PSE/Nequi/Mercado Pago) en el checkout.
- Confirmación automática mueve el pedido a `pendiente` ya pagado.

## Impacto vs. esfuerzo
- **Impacto**: alto (monetización, conversión). **Esfuerzo**: alto (integración, conciliación, seguridad).

## 🔗 Relacionado
- [[_MOC Ideas]] · [[Modelo de Negocio]] · [[CU-001 Realizar un pedido]]
