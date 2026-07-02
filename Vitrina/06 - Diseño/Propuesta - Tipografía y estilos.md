---
title: Propuesta - Tipografía y estilos
tags: [diseño, propuesta, tipografía]
estado: propuesta
actualizado: 2026-06-29
---

# 🔤 Propuesta — Tipografía y sistema de estilos

> Del [[Rol - Diseñador UX-UI Senior]]. Lo que da el salto de "limpio" a "premium" junto con
> [[Propuesta - Paleta de color]]. Pensado para React Native (Android primero).

## ✍️ Tipografía
La fuente del sistema es legible pero anónima. Una fuente propia da carácter al instante.
- **Títulos / display:** **Sora** o **Plus Jakarta Sans** — geométricas, modernas, con
  personalidad sin gritar. (Alternativa con más "carácter editorial": **Clash Display** solo
  para títulos grandes.)
- **Cuerpo / UI:** **Inter** o **Plus Jakarta Sans** — workhorse legible a tamaño pequeño.
- **Precios y números:** versión **tabular** (alineación de cifras) + peso 700.
- Todas **gratis** (Google Fonts / Fontshare) y empaquetables en la app.

> [!tip] Combinación recomendada
> **Sora** (títulos) + **Inter** (cuerpo). Si se quiere una sola fuente para simplificar:
> **Plus Jakarta Sans** en todo.

### Escala tipográfica (dp / peso)
| Rol | Tamaño | Peso |
|---|---|---|
| Display (saludo, marca) | 28 | 700 |
| Título de pantalla / sección | 22 | 700 |
| Título de tarjeta | 17 | 700 |
| Cuerpo | 15 | 400/500 |
| Secundario / meta | 13 | 500 |
| Etiqueta / chip | 11–12 | 700 |

## 📐 Tokens de forma y espacio
- **Espaciado:** rejilla de **4 dp** (4/8/12/16/20/24/32). La app ya usa 12–20: mantener.
- **Radios:** tarjetas **20**, botones **14**, inputs **12**, chips/pills **999**.
  (Subir tarjetas de 16→20 suaviza y "premiumiza".)
- **Sombras (cálidas, en capas):** sombra tenue tintada cálido en vez de negro frío:
  `shadowColor #B8966A`, `opacity 0.12`, `radius 16`, `elevation 3` para tarjetas;
  una versión más baja (`opacity 0.06`) para chips. Da el "brillo de vitrina".

## 🧱 Componentes base (estilo objetivo)
- **Botón primario:** fondo `brand` grafito, texto blanco, alto **52**, radio 14, peso 700;
  estado presionado = `scale 0.97` + leve oscurecido. (Ver
  [[Propuesta - Animaciones y microinteracciones]].)
- **Botón secundario:** *ghost* con borde `border`, texto `text/strong`.
- **Acción dorada (énfasis):** fondo `accent`, texto `accent/onGold` (el "+" de agregar, CTA
  de checkout). Úsalo poco para que mande.
- **Tarjeta de negocio/producto:** *image-forward* — foto grande arriba (radio 16), título 17,
  precio en `gold/text` o grafito 700, chip de estado a la derecha.
- **Chip de estado:** pill con `fondo suave` + `texto fuerte` según
  [[Propuesta - Paleta de color]] (tabla de estados).
- **Input:** borde `border`, radio 12, foco = borde `accent` 1.5 + halo `accent/soft`.
- **Estado vacío:** ícono de línea (los que ya existen) + frase corta amable, centrado.
- **Skeletons:** bloques `surface-2` con *shimmer* en vez de spinner (sube la calidad
  percibida en Explorar/Negocio).

## 🎯 Antes → después (resumen)
| Antes | Después |
|---|---|
| Fuente del sistema | Sora + Inter |
| Índigo sobre slate frío | Grafito + dorado sobre crema cálida |
| Sombra negra plana | Sombra cálida en capas (vitrina) |
| Spinner en listas | Skeletons con shimmer |
| Tarjetas radio 16 | Radio 20, más aire, foto al frente |

## 🔗 Relacionado
- [[Rol - Diseñador UX-UI Senior]] · [[Propuesta - Paleta de color]]
- [[Propuesta - Animaciones y microinteracciones]] · [[Sistema Visual]]
