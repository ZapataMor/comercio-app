---
title: CU-002 Explorar catálogo
tags: [caso-uso]
id: CU-002
actor_principal: Cliente
estado: hecho
historia: HU-001 Explorar negocios
casos_de_prueba: [CP-003]
actualizado: 2026-06-28
---

# CU-002 — Explorar catálogo

> El [[Cliente]] descubre negocios y productos.

## Precondiciones
- Cliente autenticado.

## Flujo principal
1. El cliente abre "Explorar" y ve negocios **abiertos** con su nº de productos disponibles.
2. Abre un negocio y ve sus productos disponibles agrupados por categoría, con `precio_formateado`.
3. (Opcional) Busca: escribe un término y el sistema busca por nombre, categoría, descripción y
   nombre del negocio (multi-palabra, sin distinción de mayúsculas/tildes).

## Flujos alternativos / excepciones
- **A1 — Sin resultados**: la búsqueda no encuentra coincidencias → lista vacía.
- **A2 — Negocio cerrado**: los negocios inactivos no aparecen en explorar.

## Postcondiciones
- Ninguna (solo lectura).

## 🔗 Relacionado
- [[_MOC Casos de Uso]] · [[HU-001 Explorar negocios]] · [[Tipos de Venta]]
- Prueba: [[CP-003 Buscar productos]]
