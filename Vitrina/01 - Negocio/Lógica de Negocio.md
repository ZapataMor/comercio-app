---
title: Lógica de Negocio
tags: [negocio, reglas]
estado: hecho
actualizado: 2026-11-05
---

# 🔄 Lógica de Negocio

Reglas núcleo del dominio. Derivadas del código (`Pedido`, `CancelarPedido`, controladores) y de
[[Estado Actual]].

## Ciclo de vida del pedido (máquina de estados)
```
pendiente → aceptado → listo → tomado → recogido → en_camino → entregado
    │           │         │        │
    └───────────┴─────────┴──→ cancelado
                                   └──→ listo (el domiciliario lo suelta)
```

| Estado | Quién lo dispara | Significado |
|---|---|---|
| `pendiente` | [[Cliente]] confirma el checkout | Pedido creado; suena la alarma del negocio hasta que alguien lo acepte |
| `aceptado` | [[Comerciante]] ("Aceptar pedido") | En preparación |
| `listo` | [[Comerciante]] ("Marcar listo") | Preparado, disponible para que un domiciliario lo tome |
| `tomado` | [[Domiciliario]] ("tomar", indica minutos de recogida) | Asignado a un domiciliario |
| `recogido` | [[Comerciante]], con el código que le dicta el domiciliario | Recogido en el comercio; ya no hay vuelta atrás |
| `en_camino` | [[Domiciliario]] | En ruta hacia el cliente |
| `entregado` | [[Domiciliario]], con el código que le da el cliente | Entregado al cliente, con la hora exacta — fin del flujo |
| `cancelado` | [[Cliente]] (hasta que esté `listo`), el negocio (`pendiente`, `aceptado`, o `listo` sin domiciliario) o el sistema (nadie aceptó en 5 minutos) | Final alternativo, con motivo; no se cobra nada |

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
10. **Cancelar.** El cliente cancela mientras el negocio no lo tenga listo. El negocio rechaza un
    pedido pendiente o cancela uno listo que ningún domiciliario tomó, sin consecuencias. Un pedido
    aceptado se puede cancelar sin consecuencias durante 5 minutos; después le baja la confiabilidad.
    Ya tomado, no se cancela desde la app (se llama a la otra parte).
11. **Horario.** Si el negocio tiene horario, se abre y se cierra solo a esas horas; un cambio
    manual del switch se respeta hasta la siguiente hora del horario.
12. **Contacto.** El cliente ve el teléfono del negocio; el del domiciliario y el del cliente solo
    se muestran mientras el domiciliario lleva el pedido ([[ADR-003 Botón llamar o WhatsApp al cliente]]).

13. **Aceptar a tiempo.** El negocio tiene 5 minutos para aceptar un pedido. Si nadie lo hace se
    cancela solo y el cliente recibe que el negocio no recibió su pedido. Aún no tiene consecuencias
    para el negocio: se definirán junto con su reputación.
14. **Alarma.** Desde que llega un pedido hasta que lo aceptan, lo rechazan o vence, los teléfonos
    del equipo suenan cada 10 segundos, también con la app cerrada.
15. **Soltar.** El domiciliario puede soltar un pedido tomado antes de recogerlo; vuelve a estar
    disponible para los demás. Después de recogerlo no hay vuelta atrás.
16. **Códigos.** Dos códigos de 4 dígitos confirman que el pedido pasó a las manos correctas: el
    domiciliario le dicta el de recogida al negocio, y el cliente le dicta el de entrega al
    domiciliario. Los intentos están limitados. Dos códigos vigentes nunca coinciden, ni entre
    pedidos ni entre tipos; un código ya usado puede volver a salir más adelante. Aparte, cada
    pedido se identifica con un código aleatorio y único de 8 letras y números.

## 🔗 Relacionado
- [[_MOC Negocio]] · [[Tipos de Venta]] · [[Reglas de Notificacion]] · [[Glosario]]
- Casos de uso: [[CU-001 Realizar un pedido]] · [[CU-003 Marcar pedido listo]] · [[CU-004 Entregar un pedido]]
