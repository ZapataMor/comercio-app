---
title: Domiciliario
tags: [actor]
tipo: actor
estado: hecho
rol_sistema: domiciliario
objetivos: [encontrar entregas, entregar rápido]
permisos: [ver disponibles, tomar, avanzar estado, ver historial]
historias_relacionadas: [HU-006]
actualizado: 2026-11-03
---

# 🛵 Domiciliario

> Cliente que además reparte (roles `usuario` + `domiciliario`). Se activa él mismo con
> «Ser domiciliario» en el menú del ícono de usuario (o se lo asigna un admin). Toma pedidos
> listos y los lleva al cliente.

## 🎯 Objetivos
- Ver qué pedidos hay disponibles para entregar.
- Tomar uno y completarlo sin fricción.

## 🛠️ Responsabilidades / acciones
- Ver pedidos **disponibles** (en estado `listo`).
- **Tomar** un pedido indicando **minutos de recogida** (autoasignación, anti-choque).
- Avanzar estado: **Recogido → En camino → Entregado**.
- Ver sus **entregas en curso** e **historial**.

## 🔐 Permisos
- Zona `role:domiciliario` (`/api/domiciliario/*`).
- Solo opera sobre pedidos que tomó (o disponibles para tomar).
- Sus propios pedidos (como cliente) no los ve, no los toma ni le llega su aviso.
- Para activarse necesita un teléfono en su cuenta (el cliente y el negocio lo llaman).

## 🔗 Relacionado
- [[_MOC Actores]] · [[Comerciante]] · [[Cliente]] · [[Lógica de Negocio]]
- Historia: [[HU-006 Tomar y entregar pedidos]]
- Caso de uso: [[CU-004 Entregar un pedido]]
