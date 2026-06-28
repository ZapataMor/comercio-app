---
title: Tipos de Venta
tags: [negocio, reglas, producto]
estado: hecho
actualizado: 2026-06-28
---

# 🏷️ Tipos de Venta

Cada **producto** tiene un `tipo_venta` y una `unidad_medida`. El precio se entiende
**"por unidad de medida"** y el JSON expone un `precio_formateado` (ej. `"$8.900 / kg"`).

| `tipo_venta` | Ejemplos de `unidad_medida` | Ejemplo de precio |
|---|---|---|
| `cantidad` | unidad, porción, combo, paquete, docena | "$12.000 / combo" |
| `peso` | kg, libra | "$8.900 / kg" |
| `volumen` | litro | "$6.500 / litro" |
| `longitud` | metro | "$3.200 / metro" |

## Por qué importa (negocio)
Permite que **cualquier tipo de comercio** venda en la plataforma con su unidad natural: el
asadero vende combos (cantidad), la carnicería por libra (peso), la licorería por litro
(volumen) y la ferretería cable por metro (longitud).

## 🔗 Relacionado
- [[Lógica de Negocio]] · [[Glosario]] · [[Comerciante]]
