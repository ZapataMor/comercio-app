---
title: Análisis UX-UI - Auditoría de la app
tags: [diseño, auditoría]
estado: hecho
actualizado: 2026-06-29
---

# 🔍 Auditoría UX/UI — cómo se ve Vitrina hoy en Android

> Análisis del [[Rol - Diseñador UX-UI Senior]] sobre la app real (`frontend/src`). Mira el
> estado actual, lo bueno y lo mejorable, antes de proponer la nueva identidad.

## 📸 Estado visual actual (lo que hay en el código)
- **Color primario:** índigo `#4f46e5` / `#4338ca` (header, botones, precios, enlaces).
- **Fondo:** slate frío `#f1f5f9`. **Superficies:** blanco con sombra suave (`elevation` 1–3).
- **Texto:** `#0f172a` fuerte, `#64748b` / `#94a3b8` secundario.
- **Radios:** tarjetas 16–20, chips `999`. **Tipografía:** fuente del sistema, pesos 600–800.
- **Íconos:** línea fina SVG estilo Lucide (buen activo, [[Sistema Visual|consistente]]).
- **Estados:** abierto verde `#dcfce7`/`#15803d`; pedido pendiente borde ámbar `#f59e0b`;
  error/salir rojo `#ef4444`. Header índigo sólido, texto blanco.
- **Animaciones:** prácticamente ninguna (solo `TouchableOpacity` y `ActivityIndicator`).
  No hay `reanimated`/`moti`/`lottie`/haptics instalados.

## ✅ Lo que está bien (conservar)
- Layout limpio, con aire y tarjetas redondeadas: buena base, nada "feo".
- Sistema de íconos de línea propio y coherente → **se mantiene** como lenguaje de íconos.
- Jerarquía de texto razonable y estados con color (abierto/pendiente/error) ya pensados.
- Búsqueda con *debounce*, *pull-to-refresh*, estados vacíos con texto: detalles correctos.

## ⚠️ Lo que resta "wow" (oportunidades)
| # | Hallazgo | Impacto | Heurística |
|---|---|---|---|
| 1 | **Índigo + slate genérico**: se ve como "plantilla de software", sin marca ni calidez. | Alto | Estética/identidad |
| 2 | **Sin movimiento**: la app aparece de golpe; nada responde al tacto. Se siente estática. | Alto | Feedback / deleite |
| 3 | **Tipografía del sistema**: legible pero sin personalidad ni carácter premium. | Medio | Identidad |
| 4 | **Carga con spinner** en listas (Explorar/Negocio): se percibe lento y "vacío". | Medio | Visibilidad del estado |
| 5 | **Marca inconsistente**: el login dice "Comercio", no "Vitrina"; ícono = carrito genérico. | Alto | Reconocimiento de marca |
| 6 | **Estados de pedido sin color sistemático** en la línea de tiempo (solo texto). | Medio | Visibilidad del estado |
| 7 | **Sombras frías y planas**: poca sensación de profundidad/"vidrio de vitrina". | Bajo | Jerarquía |
| 8 | **Sin haptics**: acciones clave (agregar al carrito, confirmar) no se "sienten". | Medio | Feedback |

## 🎯 Diagnóstico en una frase
La app es **limpia y funcional pero anónima y estática**. Para que el usuario se sorprenda hay
que darle **identidad cálida** (color + tipografía + logo) y **vida** (movimiento con
propósito) — sin tocar la arquitectura, solo la capa visual y de interacción.

## ➡️ Qué sigue
- Identidad de color → [[Propuesta - Paleta de color]]
- Tipografía y componentes → [[Propuesta - Tipografía y estilos]]
- Movimiento → [[Propuesta - Animaciones y microinteracciones]]
- Logo y marca → [[Propuesta - Logo e identidad de marca]]

## 🔗 Relacionado
- [[_MOC Diseño]] · [[Sistema Visual]] · [[Rol - Diseñador UX-UI Senior]]
