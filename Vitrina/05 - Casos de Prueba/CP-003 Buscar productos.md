---
title: CP-003 Buscar productos
tags: [caso-prueba]
id: CP-003
caso_de_uso: CU-002 Explorar catálogo
tipo: integración
estado: hecho
actualizado: 2026-06-28
---

# CP-003 — Buscar productos

> Valida la búsqueda multi-palabra insensible a mayúsculas/tildes. (Cubierto entre los 15 tests
> del comerciante y verificado manualmente para el cliente.)

| Campo | Valor |
|---|---|
| Caso de uso | [[CU-002 Explorar catálogo]] |
| Tipo | integración / manual |
| Precondición | catálogo sembrado (`CatalogoDemoSeeder`) |

## Pasos
1. Buscar un término que coincida por **nombre** de producto.
2. Buscar un término que coincida por **categoría**.
3. Variar mayúsculas/tildes y usar 2 palabras.

## Resultado esperado
- Devuelve solo productos **disponibles** de negocios **activos** que coincidan.
- Insensible a mayúsculas/tildes; multi-palabra.

## 🔗 Relacionado
- [[_MOC Casos de Prueba]] · [[CU-002 Explorar catálogo]] · [[Idea - Busqueda semantica]]
