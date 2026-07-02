---
title: Idea - Orden por cercania
tags: [idea]
estado: semilla
impacto: alto
esfuerzo: alto
actualizado: 2026-06-29
---

# 💡 Orden por cercanía de ubicación

> En las búsquedas y en los negocios abiertos, mostrar los resultados al cliente
> ordenados por **distancia a su ubicación**: del más cercano al más lejano.

## Problema que resuelve
Hoy los negocios (y los productos de la búsqueda) se ordenan por nombre o por
relevancia de texto, sin considerar **dónde está el cliente**. Un negocio a 3 km
puede salir antes que uno a 1 cuadra, lo que empeora tiempos y costos de entrega.

## Cómo podría funcionar
- El cliente comparte su ubicación (pin en el mapa o GPS del dispositivo).
- Cada negocio guarda su `lat`/`lng` (hoy solo tiene **dirección escrita**).
- El backend ordena por distancia (fórmula de Haversine o índice geoespacial)
  como criterio principal; el texto/relevancia pasa a desempate.
- Aplica a dos vistas del cliente: **negocios abiertos** y **búsqueda de productos**.

## Impacto vs. esfuerzo
- **Impacto**: alto (descubrimiento local, entregas más rápidas y baratas).
- **Esfuerzo**: alto (capturar coordenadas de negocio y cliente, permisos de
  ubicación, cálculo/orden geoespacial).

## 🔗 Relacionado
- [[_MOC Ideas]] · [[Idea - Mapa en tiempo real]] · [[Idea - Seguimiento del domiciliario]]
- [[CU-002 Explorar catálogo]] · [[CP-003 Buscar productos]]
