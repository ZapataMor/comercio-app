---
title: Glosario
tags: [negocio, glosario, referencia]
estado: hecho
actualizado: 2026-06-28
---

# 📖 Glosario (lenguaje ubicuo)

Términos del dominio y su significado. Usar siempre estas palabras en notas y código.

| Término | Definición |
|---|---|
| **Negocio** | Tienda/comercio de un comerciante (1 por comerciante). Tiene nombre, dirección, teléfono y un estado activo (abierto/cerrado). |
| **Producto** | Ítem del catálogo de un negocio, con precio y [[Tipos de Venta\|tipo de venta]]. Usa *soft delete* (borrar lo oculta pero conserva historial). |
| **Categoría** | Agrupación de productos dentro de un negocio (nombre único por negocio). |
| **Carrito** | Items que el cliente acumula antes de pedir. Regla: **un carrito = un negocio**. |
| **Pedido** | Compra confirmada por un cliente a un negocio. Avanza por [[Lógica de Negocio\|estados]]. |
| **Pedido item** | Línea de un pedido con **copia** de nombre/precio/cantidad al momento de pedir. |
| **Estado del pedido** | `pendiente → listo → tomado → recogido → en_camino → entregado`. |
| **Método de pago** | `efectivo` o `transferencia`. |
| **Minutos de recogida** | Tiempo que el domiciliario indica al **tomar** un pedido. |
| **Device token** | Identificador del dispositivo para enviar push (FCM). Un usuario, varios aparatos. |
| **Rol** | `administrador`, `comerciante`, `usuario` (cliente), `domiciliario`. |

## 🔗 Relacionado
- [[_MOC Negocio]] · [[Lógica de Negocio]] · [[Tipos de Venta]] · [[_MOC Actores]]
