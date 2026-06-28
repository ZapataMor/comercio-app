---
title: Estado Actual
tags: [inicio, estado]
estado: en-progreso
actualizado: 2026-06-28
---

# 📊 Estado Actual

> Snapshot vivo. Fuente de verdad detallada: `backend/ESTADO_DEL_PROYECTO.md`.
> Esta nota resume el panorama de **producto**, no el changelog técnico.

## ✅ Hecho (núcleo funcionando)
- **Autenticación y roles**: registro/login/logout con tokens (Sanctum) + 4 roles (Spatie).
- **Catálogo del comerciante**: negocio, categorías y productos con [[Tipos de Venta]]
  (cantidad/peso/volumen/longitud), soft deletes, búsqueda y paginación.
- **Flujo de pedidos completo en WEB** (los 4 roles): carrito → checkout → confirmar →
  comercio marca listo → domiciliario toma/recoge/entrega → cliente ve "Entregado".
  Ver [[Lógica de Negocio]] y [[CU-001 Realizar un pedido]].
- **Panel de administrador** (web): usuarios, roles y negocios.
- **App móvil (React Native)**: login + vistas de los 4 roles + ciclo de compra del cliente
  y confirmación del comercio.
- **Notificaciones push (FCM) — Capa 1 backend**: tokens de dispositivo + notificaciones por
  cambio de estado, blindadas (nunca rompen el flujo).

## 🚧 En curso / a medias
- **Notificaciones push**: falta Capa 2 (Firebase real) y Capa 3 (recepción en la app móvil).
- **Paridad API ↔ Web**: el flujo de pedidos del cliente ya tiene API; afinando la app nativa.

## ⏳ Pendiente (próxima fase)
- [ ] **Ubicación en mapa** en tiempo real (hoy solo dirección escrita). Ver [[Idea - Mapa en tiempo real]].
- [ ] **Búsqueda inteligente/semántica** (tolerante a errores y por intención). Ver [[Idea - Busqueda semantica]].
- [ ] Tests Pest del **ciclo de pedidos** completo.
- [ ] Paginación visual del catálogo en la web.

## 🎯 Foco actual
Cerrar las **3 capas de notificaciones push** y consolidar la **app móvil** como cliente
principal de la API.

## Relacionado
- [[_MOC Negocio]] · [[_MOC Historias]] · [[_MOC Ideas]]
