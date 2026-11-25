---
title: Planes de membresía
tags: [estrategia, planes]
estado: idea
actualizado: 2026-11-25
---

# 💳 Planes de membresía

> Cómo cobra Vitrina: **planes por suscripción para los negocios**, sin comisión por pedido. El plan
> más caro trae inventario, facturación electrónica DIAN y acceso web.

## Lo que ya está decidido (`DECISIONES-PILOTO.md` del repo)
- **No hay comisión por pedido** ni participación de Vitrina en el domicilio.
- Piloto gratuito y **dos primeros meses gratis** para cada negocio nuevo.
- Planes **mensuales, semestrales y anuales**.

> [!warning] Ojo con la palabra "membresía"
> En el código, *membresía* ya significa otra cosa: la relación de una persona con un negocio
> (`propietario` o `trabajador`). Al construir los planes pagos, llamarlos **plan** o
> **suscripción** en el código para no mezclar los dos conceptos.

## Propuesta de paquetes (borrador)
| | 🟢 Vitrina | 🔵 Vitrina + Inventario | 🟣 Vitrina Pro |
|---|---|---|---|
| Vitrina digital, catálogo y pedidos | ✅ | ✅ | ✅ |
| Domicilios y seguimiento en el mapa | ✅ | ✅ | ✅ |
| Citas y servicios, reseñas | ✅ | ✅ | ✅ |
| Equipo (trabajadores con permisos) | 1–2 personas | más personas | sin límite práctico |
| **Inventario** (existencias, alertas, agotado automático) | — | ✅ | ✅ |
| **Venta de mostrador** (para que el inventario cuadre) | — | ✅ | ✅ |
| **Acceso web** para el negocio | — | ✅ | ✅ |
| Reportes de ventas y ganancia | básicos | ✅ | ✅ |
| **Facturación electrónica DIAN** | — | — | ✅ (cupo de facturas al mes) |
| Varias sedes | — | — | ✅ |

Detalle de las funciones nuevas en [[Idea - Inventario y facturación DIAN]].

> [!info] Módulos de gestión (2026-11-25)
> Para negocios más grandes, como [[Reunión con Grumar|Grumar]], se suma la idea de cobrar **módulos**
> aparte (personal, producción, proveedores, clientes preferenciales, cuentas) y un pago de
> implementación. Ver [[Idea - Vitrina Gestión#Cómo cobrarlo]].

## Precios: cómo decidirlos
1. **Preguntar antes de cobrar**: entrevistar a 10 comerciantes del piloto. No preguntar "¿cuánto
   pagaría?", sino mostrar tres precios y ver la reacción (uno bajo, uno medio, uno alto).
2. **Comparar** con lo que ya pagan: el plan de datos, el contador, otros programas de inventario o
   facturación que usen.
3. El plan Pro debe cubrir el **costo por factura** del proveedor tecnológico DIAN con margen.
4. **Descuento** por semestral y anual (pagan por adelantado y se quedan más tiempo).
5. Empezar más bien **barato**: es más fácil subir el precio a un negocio que ya depende de la app
   que convencer a uno nuevo con un precio alto.

> [!todo] Pendiente (de `DECISIONES-PILOTO.md`): precios de cada plan, fecha en que empieza la
> gratuidad y reglas de vencimiento (qué pasa cuando un negocio deja de pagar: ¿se oculta la
> vitrina? ¿cuántos días de gracia?).

## 🔗 Relacionado
- [[_MOC Estrategia]] · [[Modelo de Negocio]] · [[Idea - Inventario y facturación DIAN]]
