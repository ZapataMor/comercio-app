---
title: Idea - Seguimiento del domiciliario
tags: [idea]
estado: implementado
impacto: alto
esfuerzo: alto
actualizado: 2026-10-30
---

# 💡 Seguimiento en vivo del domiciliario

> Todos los domiciliarios comparten su **ubicación activa** mientras llevan un
> pedido, para que el cliente vea el camino de su producto en el mapa.

## Problema que resuelve
El cliente no sabe dónde va su pedido: solo ve el estado (`recogido`, `en_camino`)
como texto. No hay forma de ver al domiciliario avanzar ni estimar cuánto falta.

## Cómo podría funcionar
- El domiciliario comparte ubicación **desde que toma/recoge el producto hasta
  que lo entrega** (ventana de seguimiento: `recogido` → `entregado`).
- La app del domiciliario envía su posición periódicamente; el cliente la ve en
  un mapa sobre la ruta hacia su dirección.
- Al entregar (`entregado`) se detiene el envío de ubicación.

## Impacto vs. esfuerzo
- **Impacto**: alto (confianza, menos llamadas "¿dónde está mi pedido?").
- **Esfuerzo**: alto (ubicación en segundo plano, tiempo real, mapas, batería y
  privacidad del domiciliario).

## Notas
- Extiende a [[Idea - Mapa en tiempo real]], que planteaba compartir ubicación
  solo durante `en_camino`; aquí la ventana arranca al **recoger** el producto.

## ✅ Implementado (2026-10-30)
- La app del domiciliario envía su GPS cada ~10 s **solo con la app abierta**, mientras está en
  turno o lleva una entrega (`PUT /api/domiciliario/ubicacion`). Salir de turno borra la posición.
- Quién lo ve: el **cliente** (de `recogido` a `entregado`), el **negocio** (en `tomado`, viene a
  recoger) y el **administrador** (todos los que reportaron en los últimos 5 min).
- Una posición de más de 5 min no se muestra.
- Pendiente: seguimiento con la app en segundo plano (servicio en primer plano de Android y
  declaración de ubicación en Play Store).

## 🔗 Relacionado
- [[_MOC Ideas]] · [[Idea - Mapa en tiempo real]] · [[Idea - Orden por cercania]]
- [[Lógica de Negocio]] · [[Estado Actual]]
