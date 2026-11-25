---
title: Idea - Inventario y facturación DIAN
tags: [idea, estrategia, planes]
estado: semilla
impacto: alto
esfuerzo: alto
actualizado: 2026-11-25
---

# 💡 Inventario, facturación DIAN y acceso web

> Que Vitrina deje de ser solo la vitrina del negocio y se vuelva **el sistema con el que el negocio
> funciona**: inventario, ventas, facturación electrónica y acceso desde el computador. Va en el plan
> más caro de [[Planes de membresía]].

## Problema que resuelve
- El tendero lleva el inventario en un cuaderno, en Excel o en la cabeza: no sabe qué se está
  acabando ni cuánto gana de verdad.
- Si vende un producto en el mostrador y también está en la app, puede vender algo que ya no tiene.
- La facturación electrónica de la DIAN obliga a muchos negocios a pagar otro programa aparte.
- **Para Vitrina**: un negocio que maneja su inventario y su facturación en la app **no se va**
  (cambiarse le costaría mucho), y paga más.

## Cómo podría funcionar (por fases)
### Fase 1 — Inventario en la app
- **Existencias por producto**, en la misma unidad de su [[Tipos de Venta|tipo de venta]] (unidades,
  kilos, litros, metros): la base ya existe.
- **Movimientos**: entrada (compra a proveedor), salida (venta), ajuste y pérdida (vencido, dañado).
- Al **confirmar un pedido** de la app se descuenta solo; si se acaba, el producto pasa a **agotado**
  automáticamente (hoy `disponible` se cambia a mano).
- **Alerta de existencias bajas** con un mínimo por producto.
- **Costo de compra** por producto → ganancia por venta y por día.
- **Venta de mostrador** (caja sencilla): sin esto el inventario nunca cuadra, porque la mayoría de
  las ventas de un negocio de barrio son en persona. Es la pieza clave de la fase.

### Fase 2 — Acceso web
- Panel web para el negocio (el backend ya tiene panel web para el administrador): cargar inventario
  en pantalla grande, **importar desde Excel**, ver reportes, imprimir.
- Mismos permisos del equipo que ya existen (propietario y trabajadores con permisos).

### Fase 3 — Facturación electrónica DIAN
- **No** volverse proveedor tecnológico de la DIAN (exige habilitación, certificaciones y mucho
  costo). Lo práctico: **conectarse por API con un proveedor tecnológico autorizado** que emite
  y valida la factura ante la DIAN; Vitrina solo arma los datos y muestra el resultado.
- Cada negocio necesita su **RUT**, su **resolución de numeración** y estar **habilitado como
  facturador electrónico** en la DIAN. Vitrina puede guiarlo paso a paso.
- Además de la factura: el **documento equivalente POS electrónico** (el tiquete de caja), que es lo
  que más usa un negocio de barrio.
- Cobrar por **cupo de documentos al mes** en el plan Pro, porque el proveedor cobra por documento.

> [!todo] Pendiente: confirmar con un **contador público** qué negocios de Maicao están obligados a
> facturar electrónicamente (régimen simple, no responsables de IVA, etc.), qué exige hoy el POS
> electrónico y comparar proveedores tecnológicos con API (precio por documento, firma digital
> incluida, soporte).

## Lo que ya existe y sirve
- [[Tipos de Venta]] (cantidad, peso, volumen, longitud) → unidad del inventario.
- Campo `disponible` del producto → agotado automático.
- Equipo del negocio con permisos (propietario / trabajador) → quién puede tocar el inventario.
- Panel web del administrador → base para el panel web del negocio.
- Los pedidos y sus estados → momento exacto para descontar existencias.

## Competencia y referencias
- Apps de inventario y ventas para tenderos (como Treinta) y programas de facturación con
  inventario (como Alegra o Siigo).
- **Diferenciador de Vitrina**: ninguno junta en un solo lugar **ventas por internet + domicilios +
  inventario + facturación** para el negocio de barrio. El tendero no tendría que usar tres apps.

## Riesgos
- **Es mucho alcance**: puede frenar lo principal. Construirlo solo cuando la vitrina y los pedidos
  ya tengan negocios pagando.
- **Normas de la DIAN que cambian**: por eso conviene el proveedor tecnológico, que absorbe los
  cambios.
- **Soporte**: si una factura falla, el negocio llama. Hay que tener mensajes de error claros.
- **Datos malos**: si el comerciante no registra las ventas de mostrador, el inventario miente y la
  culpa se la echa a la app.

## Validar antes de construir
Preguntar a 10 comerciantes del piloto:
1. ¿Cómo lleva hoy su inventario?
2. ¿Le ha pasado vender algo que ya no tenía?
3. ¿Factura electrónicamente? ¿Con qué programa y cuánto paga?
4. ¿Pagaría más por tener todo en Vitrina? (mostrar el precio del plan)

Si al menos la mitad dice que sí a la 2 y a la 4, se construye la fase 1.

## Impacto vs. esfuerzo
- **Impacto**: alto — sube el precio del plan, retiene negocios y diferencia a Vitrina.
- **Esfuerzo**: alto — fase 1 mediano, fase 2 mediano, fase 3 alto (integración y normas).

> [!info] Primer negocio que lo pide (2026-11-25)
> Grumar, una latonería con 3 sedes y 25 a 30 empleados, necesita justo esto y más (personal,
> materiales, proveedores, cuentas). Ver [[Reunión con Grumar]] y la idea más amplia
> [[Idea - Vitrina Gestión]].

## 🔗 Relacionado
- [[_MOC Ideas]] · [[_MOC Estrategia]] · [[Planes de membresía]] · [[Tipos de Venta]] · [[Modelo de Negocio]]
- [[Idea - Vitrina Gestión]] · [[Reunión con Grumar]]
