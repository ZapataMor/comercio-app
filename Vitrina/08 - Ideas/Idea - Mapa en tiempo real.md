---
title: Idea - Mapa en tiempo real
tags: [idea]
estado: implementado
impacto: alto
esfuerzo: alto
actualizado: 2026-10-30
---

# 💡 Mapa / ubicación en tiempo real

> Compartir la ubicación del cliente en un mapa y seguir al domiciliario en ruta, en lugar de
> solo una dirección escrita.

## Problema que resuelve
Hoy el pedido solo lleva **dirección escrita** y teléfono. Es ambiguo en zonas sin nomenclatura
clara y el cliente no ve dónde va el domiciliario.

## Cómo podría funcionar
- El cliente fija un pin en el mapa en el checkout.
- Durante `en_camino`, el domiciliario comparte ubicación y el cliente lo ve avanzar.

## Impacto vs. esfuerzo
- **Impacto**: alto (claridad de entrega + confianza).
- **Esfuerzo**: alto (mapas, geolocalización, tiempo real). Ya está listado como pendiente grande.

## ✅ Implementado (2026-10-30)
- Mapa de negocios en **Explorar → Mapa** (Google Maps en Android, Apple Maps en iOS).
- Cada negocio fija su pin en **Mi Tienda** (`negocios.lat/lng`).
- El cliente ve al domiciliario en vivo en **Seguimiento** mientras está `recogido`/`en_camino`.
- Pendiente: que el cliente fije un pin de entrega en el checkout (hoy sigue siendo dirección escrita).

## 🔗 Relacionado
- [[_MOC Ideas]] · [[Lógica de Negocio]] · [[Estado Actual]]
