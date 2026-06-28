---
title: CU-001 Realizar un pedido
tags: [caso-uso]
id: CU-001
actor_principal: Cliente
estado: hecho
historia: HU-002 Hacer un pedido
casos_de_prueba: [CP-001, CP-002]
actualizado: 2026-06-28
---

# CU-001 — Realizar un pedido

> El [[Cliente]] arma un carrito de un negocio, hace checkout y confirma; nace un pedido en
> estado `pendiente`.

## Precondiciones
- El cliente está autenticado (rol `usuario`).
- El negocio está activo y tiene productos disponibles.

## Flujo principal
1. El cliente explora un negocio y agrega productos al carrito.
2. Revisa el carrito (puede actualizar cantidades o quitar items).
3. Va al checkout e indica **dirección**, **teléfono** y **forma de pago** (efectivo/transferencia).
4. Confirma el pedido.
5. El sistema valida que los productos sean del negocio, **copia** nombre/precio/cantidad a
   `pedido_items`, crea el pedido en estado `pendiente` y **vacía el carrito**.
6. Se notifica al [[Comerciante]] (`NuevoPedidoParaComercio`).
7. El cliente ve el pedido en "Mis pedidos" con su línea de tiempo.

## Flujos alternativos / excepciones
- **A1 — Carrito de otro negocio**: si intenta agregar un producto de un negocio distinto, se
  aplica la regla **un carrito = un negocio** (debe vaciar o terminar el carrito actual).
- **A2 — Producto no disponible**: la validación rechaza items que no pertenezcan al negocio o
  no estén disponibles.

## Postcondiciones
- Existe un `pedido` (`pendiente`) con sus `pedido_items`. El carrito queda vacío.

## 🔗 Relacionado
- [[_MOC Casos de Uso]] · [[HU-002 Hacer un pedido]] · [[Lógica de Negocio]]
- Pruebas: [[CP-001 Crear pedido válido]] · [[CP-002 Un carrito un negocio]]
