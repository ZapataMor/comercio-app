---
title: Convenciones de Negocio
tags: [convención, negocio]
estado: hecho
actualizado: 2026-06-28
---

# 🧱 Convenciones de Negocio

Terminología y valores fijos del dominio. Usar **exactamente** estos nombres en notas y código.

## Roles (Spatie)
`administrador` · `comerciante` · `usuario` (cliente) · `domiciliario`

## Estados de pedido
`pendiente` → `listo` → `tomado` → `recogido` → `en_camino` → `entregado`
(en snake_case, tal cual están en la base de datos).

## Métodos de pago
`efectivo` · `transferencia`

## Tipos de venta de producto
`cantidad` · `peso` · `volumen` · `longitud` (ver [[Tipos de Venta]])

## Reglas invariantes
- Un negocio por comerciante.
- Un carrito = un negocio.
- Copia de precios al confirmar el pedido.
- Registro público solo crea `usuario` o `comerciante`.

## 🔗 Relacionado
- [[_MOC Convenciones]] · [[Glosario]] · [[Lógica de Negocio]]
