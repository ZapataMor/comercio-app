---
title: Domiciliario
tags: [actor]
tipo: actor
estado: hecho
rol_sistema: domiciliario
objetivos: [encontrar entregas, entregar rápido]
permisos: [ver disponibles, tomar, avanzar estado, ver historial]
historias_relacionadas: [HU-006]
actualizado: 2026-06-28
---

# 🛵 Domiciliario

> Repartidor (rol `domiciliario`, asignado por un admin). Toma pedidos listos y los lleva al
> cliente.

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

## 🔗 Relacionado
- [[_MOC Actores]] · [[Comerciante]] · [[Cliente]] · [[Lógica de Negocio]]
- Historia: [[HU-006 Tomar y entregar pedidos]]
- Caso de uso: [[CU-004 Entregar un pedido]]
