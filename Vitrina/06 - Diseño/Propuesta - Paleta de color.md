---
title: Propuesta - Paleta de color
tags: [diseño, propuesta, color]
estado: propuesta
actualizado: 2026-06-29
---

# 🎨 Propuesta — Paleta de color de Vitrina

> Recomendación del [[Rol - Diseñador UX-UI Senior]]. Reemplaza el índigo+slate genérico de
> hoy (ver [[Análisis UX-UI - Auditoría de la app]]) por una identidad **cálida y premium**.

## 🧭 Por qué NO la bandera de Maicao (rojo/verde/azul)
Son colores **cívicos**, no de marca: juntos compiten, saturan y dan aire institucional, no
moderno. La idea fuerte de la marca no es la bandera, es la **vitrina iluminada**: luz cálida,
producto al frente, sensación de tienda premium. De ahí sale el **dorado/ámbar** como acento
(la luz de la vitrina, el sol de La Guajira, el oro del comercio) sobre un **neutro cálido**.

## ⭐ Opción A — "Ámbar & Grafito" (RECOMENDADA)
Negro cálido + dorado + crema. Es el código del lujo retail (vitrina de joyería, escaparate
iluminado): se ve caro, moderno y apetecible. El dorado es el héroe; el grafito hace el trabajo.

### Tokens base (listos para `frontend`)
| Token | Hex | Uso |
|---|---|---|
| `bg/app` | `#FAF8F4` | Fondo de la app (crema cálida, no el slate frío) |
| `surface` | `#FFFFFF` | Tarjetas, inputs |
| `surface-2` | `#F4EFE7` | Fondos suaves, *skeletons* |
| `border` | `#EAE3D8` | Bordes, divisores |
| `text/strong` | `#1F1B16` | Títulos (grafito cálido casi negro) |
| `text` | `#3D372F` | Cuerpo |
| `text/muted` | `#8A8175` | Secundario, *placeholders* |
| `brand` | `#262019` | Primario: header, botón principal (texto blanco) |
| `accent` | `#E8A019` | **Dorado Vitrina**: activo, foco, detalles, "+" |
| `accent/strong` | `#C9851A` | Dorado presionado/hover |
| `accent/soft` | `#FBEED4` | Fondo de chips y *badges* dorados |
| `accent/onGold` | `#3A2A06` | Texto/ícono **sobre** dorado (contraste AA) |
| `gold/text` | `#9A6B0F` | Dorado oscuro **legible** para texto sobre blanco (precios) |

> [!warning] Contraste (regla de oro)
> El dorado `#E8A019` sobre blanco **no** cumple AA para texto pequeño (~2:1). Por eso:
> el dorado se usa en **superficies, íconos grandes, bordes y chips** (con texto oscuro
> `accent/onGold`); para **texto** dorado sobre blanco usa `gold/text #9A6B0F` (≈4.6:1).
> Botón principal = grafito con texto blanco (manda y siempre contrasta).

## 🟢 Opción B — "Esmeralda & Arena"
Verde esmeralda profundo + arena del desierto + cobre. Fresco, confiable, también premium
(el esmeralda lee a "lujo sereno"). El arena conecta con La Guajira sin usar el verde brillante
de la bandera.
- `brand` esmeralda `#0F7A5F` · `brand/deep` `#0A5C47` · `accent` cobre `#C8693C`
- `bg/app` arena `#F7F2EA` · `text/strong` `#1B2420`

## 🔵 Opción C — "Índigo Premium" (menor esfuerzo)
Si quieres el cambio más barato sobre el código actual: **eleva** el índigo en vez de cambiarlo.
- `brand` índigo profundo `#3F37C9` · `accent` dorado `#F5A524` · `bg/app` cálido `#F6F5FB`
- Pros: mínimo trabajo (ya es índigo). Contras: sigue cerca de lo "genérico"; menos sorpresa.

## 🚦 Color por estado de pedido (resuelve TODO de [[Sistema Visual]])
Progresión cálido → frío que se lee como "avanza el viaje del pedido". Funcional, no de marca.
| Estado | Texto | Fondo chip | Lectura |
|---|---|---|---|
| `pendiente` | `#B5740A` | `#FBEED4` | Esperando al comercio (ámbar = atención) |
| `listo` | `#2F6FB0` | `#E2EDF8` | Preparado para recoger |
| `tomado` | `#6D54E0` | `#EBE7FE` | Domiciliario lo aceptó |
| `recogido` | `#0E7C8C` | `#D9F1F2` | En manos del domiciliario |
| `en_camino` | `#0E7490` | `#D2ECEF` | En ruta hacia el cliente |
| `entregado` | `#1E874B` | `#D8F3E0` | ✔ Completado |
| `cancelado` | `#C0392B` | `#FBE3DF` | Anulado |

## 🌙 Modo oscuro (regalo de esta identidad)
"Vitrina iluminada" brilla en oscuro: fondo grafito `#17140F`, superficies `#211C16`, y el
**dorado `#E8A019` resalta espectacular** sobre lo oscuro. Definir tokens *dark* cuando se
implemente; la marca ya está pensada para lucir de noche.

## ✅ Recomendación
**Opción A — "Ámbar & Grafito".** Es la que más separa a Vitrina del "look de plantilla",
encaja con el concepto de escaparate y se ve premium en claro y oscuro. B si se quiere algo
más sobrio/natural; C solo si el tiempo es mínimo.

## 🔗 Relacionado
- [[Rol - Diseñador UX-UI Senior]] · [[Propuesta - Tipografía y estilos]] · [[Sistema Visual]]
- [[Propuesta - Logo e identidad de marca]] · [[Lógica de Negocio]]
