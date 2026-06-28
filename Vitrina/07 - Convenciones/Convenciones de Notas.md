---
title: Convenciones de Notas
tags: [convención]
estado: hecho
actualizado: 2026-06-28
---

# 📝 Convenciones de Notas

## Nombres de archivo
- En **español**, legibles.
- Con prefijo de **ID** cuando aplique:
  - Historias: `HU-001 <título>`
  - Casos de uso: `CU-001 <título>`
  - Casos de prueba: `CP-001 <título>`
  - Ideas: `Idea - <título>`
- Los índices empiezan con `_MOC <área>` (el `_` los agrupa arriba).

## Estructura
- **Una nota = una idea** (atomicidad).
- Toda nota lleva **frontmatter** (ver plantillas en `_templates`).
- Toda nota enlaza a su `_MOC` y a sus notas relacionadas con `[[wikilinks]]`.
- Encabezado con emoji + título; cierre con sección `## 🔗 Relacionado`.

## Frontmatter mínimo
`title`, `tags`, `estado`, `actualizado` (+ campos por tipo según plantilla).

## Estados (campo `estado`)
`idea` · `pendiente` · `en-progreso` · `hecho` · `bloqueado` · `descartado`

## Huecos de información
Lo no confirmado se marca con callout `> [!todo] Pendiente: ...` — **no se inventa**.

## 🔗 Relacionado
- [[_MOC Convenciones]] · [[Sistema de Tags]]
