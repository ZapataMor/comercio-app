---
title: Idea - Calificaciones y reseñas
tags: [idea]
estado: hecho
impacto: medio
esfuerzo: medio
actualizado: 2026-11-06
---

> ✅ **Hecho el 2026-10-28** como *nivel de confiabilidad* (más que estrellas): puntaje 0–100 para negocios
> y domiciliarios, alimentado por la calificación del cliente, los tiempos que cada uno promete y la
> confirmación del dinero en efectivo; con veto automático. Detalle técnico en
> `backend/ESTADO_DEL_PROYECTO.md` (sección 6) y `backend/app/Support/Reputacion.php`.
>
> ✅ **Reseñas públicas el 2026-11-06**: estrellas y comentario de la tienda y de cada producto, hasta 30
> días después de la entrega y separadas del nivel de confiabilidad. Ver `backend/app/Support/Resenas.php`.
> Falta moderarlas y que el negocio pueda responder.

# 💡 Calificaciones y reseñas

> Que el cliente califique negocio y domiciliario tras recibir el pedido.

## Problema que resuelve
No hay señal de calidad/confianza entre actores. Un sistema de reputación ayuda a clientes a
elegir y motiva a comercios/domiciliarios.

## Cómo podría funcionar
- Tras `entregado`, el cliente deja estrellas + comentario al negocio y al domiciliario.
- Promedio visible en explorar.

## Impacto vs. esfuerzo
- **Impacto**: medio-alto. **Esfuerzo**: medio.

## 🔗 Relacionado
- [[_MOC Ideas]] · [[Cliente]] · [[Domiciliario]]
