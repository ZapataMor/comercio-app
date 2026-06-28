---
title: Comerciante
tags: [actor]
tipo: actor
estado: hecho
rol_sistema: comerciante
objetivos: [vender más, gestionar catálogo, recibir pedidos ordenados]
permisos: [CRUD negocio, CRUD productos, CRUD categorías, ver y confirmar pedidos]
historias_relacionadas: [HU-004, HU-005]
actualizado: 2026-06-28
---

# 🏪 Comerciante

> Dueño de un negocio (rol `comerciante`). Gestiona su tienda y atiende los pedidos. **Un
> negocio por comerciante.**

## 🎯 Objetivos
- Tener su catálogo digital ordenado y visible.
- Recibir y preparar pedidos sin desorden.
- Controlar qué ofrece y a qué precio (por unidad, peso, volumen o longitud).

## 🛠️ Responsabilidades / acciones
- Crear/editar su **negocio** y abrir/cerrar (activo).
- CRUD de **categorías** (nombre único por negocio).
- CRUD de **productos** con [[Tipos de Venta]], disponibilidad y soft delete.
- Ver **pedidos recibidos** (datos del cliente + items) y **"Marcar listo"**.

## 🔐 Permisos
- Zona `role:comerciante` (`/api/comerciante/*`).
- **Aislamiento**: solo ve/edita SU negocio, SUS productos y SUS categorías.

## 🔗 Relacionado
- [[_MOC Actores]] · [[Cliente]] · [[Domiciliario]] · [[Tipos de Venta]]
- Historias: [[HU-004 Gestionar catálogo]] · [[HU-005 Atender pedidos]]
- Casos de uso: [[CU-003 Marcar pedido listo]]
