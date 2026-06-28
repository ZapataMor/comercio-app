---
title: Idea - Busqueda semantica
tags: [idea]
estado: semilla
impacto: alto
esfuerzo: alto
actualizado: 2026-06-28
---

# 💡 Búsqueda inteligente / semántica

> Búsqueda tolerante a errores de ortografía y por **intención** (ej. "pastillas para el dolor"
> → analgésicos), como capa sobre la búsqueda actual.

## Problema que resuelve
La búsqueda actual ([[CU-002 Explorar catálogo]]) es por coincidencia de texto: no entiende
sinónimos, intención ni errores de tipeo.

## Cómo podría funcionar
- Capa futura: full-text / trigramas para tolerancia a errores; luego embeddings IA para intención.

## Impacto vs. esfuerzo
- **Impacto**: alto (descubrimiento de productos, conversión).
- **Esfuerzo**: alto (infraestructura de búsqueda/IA).

## 🔗 Relacionado
- [[_MOC Ideas]] · [[CU-002 Explorar catálogo]] · [[CP-003 Buscar productos]]
