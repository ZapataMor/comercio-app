---
title: Cliente
tags: [actor]
tipo: actor
estado: hecho
rol_sistema: usuario
objetivos: [comprar fácil, recibir a domicilio, seguir el pedido]
permisos: [explorar negocios, ver catálogo, carrito, pedir, seguir pedido]
historias_relacionadas: [HU-001, HU-002, HU-003]
actualizado: 2026-06-28
---

# 🛒 Cliente

> Consumidor final (rol `usuario`). Explora negocios, arma su carrito y pide a domicilio.

## 🎯 Objetivos
- Encontrar negocios abiertos y productos disponibles.
- Pedir cómodo desde el celular y pagar como prefiera.
- Saber en qué va su pedido (seguimiento por estados).

## 🛠️ Responsabilidades / acciones
- Explorar negocios (`/api/negocios`) y ver catálogo.
- Buscar productos (nombre, categoría, descripción, negocio).
- Agregar/actualizar/quitar del carrito (regla **un carrito = un negocio**).
- Checkout: dirección + teléfono + forma de pago (efectivo/transferencia) → confirmar.
- Seguir sus pedidos (`/mis-pedidos`, detalle con línea de tiempo).

## 🔐 Permisos
- Acceso a catálogo (solo lectura) y a sus propios pedidos/carrito.
- **No** accede a zonas de comerciante/admin/domiciliario.

## 🔗 Relacionado
- [[_MOC Actores]] · [[Comerciante]] · [[Lógica de Negocio]]
- Historias: [[HU-001 Explorar negocios]] · [[HU-002 Hacer un pedido]] · [[HU-003 Seguir mi pedido]]
- Casos de uso: [[CU-001 Realizar un pedido]] · [[CU-002 Explorar catálogo]]
