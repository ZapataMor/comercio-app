---
title: Sistema Visual
tags: [diseño]
estado: hecho
actualizado: 2026-06-29
---

# 🎨 Sistema Visual

## Estado actual
- **Móvil (React Native)**: ✅ **Identidad "Ámbar & Grafito" (Opción A) implementada.**
  Se probó la Opción B "Esmeralda & Arena" pero se descartó; se volvió a la A. Cambiar entre
  paletas es solo editar los tokens de color en `theme.ts`. Fuente única de verdad:
  `frontend/src/theme.ts` (color, tipografía, radios, sombras). Logo en `Logo.tsx`
  ("V-toldo") y animaciones en `anim.tsx`.
- **Web**: Tailwind CSS por CDN (sin cambios todavía; el rediseño se aplicó solo a la app móvil).

> [!check] Identidad aplicada en toda la app móvil
> Se aplicó a TODO: login/registro, vistas de los 4 roles, notificaciones y nombre de marca.
> - 🎨 Paleta + estados de pedido → [[Propuesta - Paleta de color]] (**activa: Opción A**)
> - 🔤 Tipografía **Sora + Inter** (en `assets/fonts`) → [[Propuesta - Tipografía y estilos]]
> - 🎞️ Animaciones con `Animated` nativo → [[Propuesta - Animaciones y microinteracciones]]
> - 🏷️ Logo y marca "Vitrina" → [[Propuesta - Logo e identidad de marca]]
>
> Para ver las fuentes hay que **reconstruir** la app (`npm run android`); el color y las
> animaciones se ven recargando JS.

## Tokens de marca (activos — Opción A, ver `theme.ts`)
- Fondo crema `#FAF8F4` · Grafito `#262019` (primario/header) · Dorado `#E8A019` (acento/CTA).
- Texto `#1F1B16` · Dorado legible para texto `#9A6B0F`.

## Color por estado de pedido
Implementado en `theme.ts` (`estado`/`estadoColor`): `pendiente` ámbar, `listo` azul,
`tomado` morado, `recogido`/`en_camino` teal, `entregado` verde, `cancelado` rojo.
Tabla completa en [[Propuesta - Paleta de color]].

## 🔗 Relacionado
- [[_MOC Diseño]] · [[Wireframes y Pantallas]] · [[Lógica de Negocio]]
- [[Rol - Diseñador UX-UI Senior]] · [[Propuesta - Paleta de color]]
