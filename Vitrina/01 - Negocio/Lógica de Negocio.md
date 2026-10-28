---
title: Lógica de Negocio
tags: [negocio, reglas]
estado: hecho
actualizado: 2026-10-28
---

# 🔄 Lógica de Negocio

Reglas núcleo del dominio. Derivadas del código (`Pedido`, `CancelarPedido`, controladores) y de
`ESTADO_DEL_PROYECTO.md`.

## Ciclo de vida del pedido (máquina de estados)
```
pendiente → listo → tomado → recogido → en_camino → entregado
    │          │
    └──────────┴──→ cancelado
```

| Estado | Quién lo dispara | Significado |
|---|---|---|
| `pendiente` | [[Cliente]] confirma el checkout | Pedido creado, esperando que el comercio lo prepare |
| `listo` | [[Comerciante]] ("Marcar listo") | Preparado, disponible para que un domiciliario lo tome |
| `tomado` | [[Domiciliario]] ("tomar", indica minutos de recogida) | Asignado a un domiciliario |
| `recogido` | [[Domiciliario]] | Recogido en el comercio |
| `en_camino` | [[Domiciliario]] | En ruta hacia el cliente |
| `entregado` | [[Domiciliario]] | Entregado al cliente — fin del flujo |
| `cancelado` | [[Cliente]] (si está `pendiente`) o el negocio (si está `pendiente`, o `listo` sin domiciliario) | Final alternativo, con motivo; no se cobra nada |

Cada transición notifica (push FCM) a quien corresponde — ver [[Reglas de Notificacion]].
El detalle paso a paso está en [[CU-001 Realizar un pedido]] y [[CU-004 Entregar un pedido]].

## Reglas de negocio clave
1. **Un carrito = un negocio.** El cliente solo puede tener productos de un negocio a la vez en
   el carrito. El carrito se guarda en el teléfono, uno por cuenta.
2. **Copia de precios al pedir.** Al confirmar, los `pedido_items` guardan una **copia** del
   nombre y precio del producto en ese momento (el pedido no cambia si luego cambia el catálogo).
3. **Acceso por membresía.** No hay rol "comerciante": cualquier usuario puede crear negocios o
   trabajar en otros. Solo los **miembros activos** del negocio (propietario o trabajador) ven y
   gestionan su catálogo y pedidos; solo el **propietario** edita los datos del negocio.
4. **Registro público = cliente.** El registro crea siempre un `usuario` y exige aceptar la
   política de privacidad; `administrador` y `domiciliario` los asigna un admin.
5. **El domiciliario se autoasigna.** Toma pedidos en estado `listo` (no se le asignan), con un
   *update condicional* anti-choque para que dos no tomen el mismo. Solo a los que están
   **en turno** les llega el aviso de pedido listo.
6. **Salvaguarda del admin.** Un administrador no puede quitarse su propio rol ni suspender su
   propia cuenta.
7. **Formas de pago**: `efectivo` o `transferencia`, elegidas en el checkout. En efectivo, el
   domiciliario cobra el **total** al entregar.
8. **Productos con tipo de venta**: el precio se entiende "por unidad de medida" — ver
   [[Tipos de Venta]].
9. **Domicilio aparte.** Total = subtotal de productos + **tarifa de domicilio** vigente (la fija el
   admin, igual para toda la ciudad). Se copia en el pedido: si la tarifa cambia, los pedidos ya
   hechos no cambian. Las **ventas** del negocio son el subtotal entregado.
10. **Cancelar.** El cliente cancela mientras el negocio no lo tenga listo; el negocio rechaza un
    pedido pendiente o cancela uno listo que ningún domiciliario tomó. Ya tomado, no se cancela
    desde la app (se llama a la otra parte).
11. **Horario.** Si el negocio tiene horario, se abre y se cierra solo a esas horas; un cambio
    manual del switch se respeta hasta la siguiente hora del horario.
12. **Contacto.** El cliente ve el teléfono del negocio; el del domiciliario y el del cliente solo
    se muestran mientras el domiciliario lleva el pedido ([[ADR-003 Botón llamar o WhatsApp al cliente]]).

## 🔗 Relacionado
- [[_MOC Negocio]] · [[Tipos de Venta]] · [[Reglas de Notificacion]] · [[Glosario]]
- Casos de uso: [[CU-001 Realizar un pedido]] · [[CU-003 Marcar pedido listo]] · [[CU-004 Entregar un pedido]]
