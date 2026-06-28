---
title: Lógica de Negocio
tags: [negocio, reglas]
estado: hecho
actualizado: 2026-06-28
---

# 🔄 Lógica de Negocio

Reglas núcleo del dominio. Derivadas del código (`Pedido`, controladores) y de
`ESTADO_DEL_PROYECTO.md`.

## Ciclo de vida del pedido (máquina de estados)
```
pendiente → listo → tomado → recogido → en_camino → entregado
```

| Estado | Quién lo dispara | Significado |
|---|---|---|
| `pendiente` | [[Cliente]] confirma el checkout | Pedido creado, esperando que el comercio lo prepare |
| `listo` | [[Comerciante]] ("Marcar listo") | Preparado, disponible para que un domiciliario lo tome |
| `tomado` | [[Domiciliario]] ("tomar", indica minutos de recogida) | Asignado a un domiciliario |
| `recogido` | [[Domiciliario]] | Recogido en el comercio |
| `en_camino` | [[Domiciliario]] | En ruta hacia el cliente |
| `entregado` | [[Domiciliario]] | Entregado al cliente — fin del flujo |

Cada transición notifica (push FCM) a quien corresponde — ver [[Reglas de Notificacion]].
El detalle paso a paso está en [[CU-001 Realizar un pedido]] y [[CU-004 Entregar un pedido]].

## Reglas de negocio clave
1. **Un carrito = un negocio.** El cliente solo puede tener productos de un negocio a la vez en
   el carrito.
2. **Copia de precios al pedir.** Al confirmar, los `pedido_items` guardan una **copia** del
   nombre y precio del producto en ese momento (el pedido no cambia si luego cambia el catálogo).
3. **Aislamiento del comerciante.** Cada comerciante solo ve y edita SU negocio y SUS productos
   y categorías. Un negocio por comerciante.
4. **Registro público restringido.** El registro público solo permite los roles `usuario` o
   `comerciante`; `administrador` y `domiciliario` los asigna un admin.
5. **El domiciliario se autoasigna.** Toma pedidos en estado `listo` (no se le asignan), con un
   *update condicional* anti-choque para que dos no tomen el mismo.
6. **Salvaguarda del admin.** Un administrador no puede quitarse a sí mismo su propio rol.
7. **Formas de pago**: `efectivo` o `transferencia`, elegidas en el checkout.
8. **Productos con tipo de venta**: el precio se entiende "por unidad de medida" — ver
   [[Tipos de Venta]].

## 🔗 Relacionado
- [[_MOC Negocio]] · [[Tipos de Venta]] · [[Reglas de Notificacion]] · [[Glosario]]
- Casos de uso: [[CU-001 Realizar un pedido]] · [[CU-003 Marcar pedido listo]] · [[CU-004 Entregar un pedido]]
