---
title: _MOC Actores
tags: [moc, actor]
estado: hecho
actualizado: 2026-06-28
---

# 🗺️ MOC — Actores

Los cuatro roles del sistema (Spatie). El registro público solo crea **cliente** o
**comerciante**; **admin** y **domiciliario** los asigna un administrador.

## Actores
- 🛒 [[Cliente]] — rol `usuario`: explora, pide y sigue su pedido
- 🏪 [[Comerciante]] — rol `comerciante`: gestiona su negocio y catálogo, confirma pedidos
- 🛵 [[Domiciliario]] — rol `domiciliario`: toma, recoge y entrega
- 🛡️ [[Administrador]] — rol `administrador`: gestiona usuarios, roles y negocios

## Cómo se relacionan
Los cuatro convergen en el [[Lógica de Negocio|flujo de pedidos]]. Ver también
[[Mapa de Actores]] para la visión de conjunto.

## Conecta con
- [[_MOC Negocio]] · [[_MOC Historias]] · [[_MOC Casos de Uso]]
