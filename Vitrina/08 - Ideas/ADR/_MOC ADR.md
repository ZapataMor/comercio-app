---
title: _MOC ADR
tags: [moc, adr]
estado: en-progreso
actualizado: 2026-11-25
---

# 🗺️ MOC — ADR (Architecture Decision Records)

Registro de decisiones de arquitectura: **qué** decidimos y, sobre todo, **por qué**. Una
decisión = un ADR. No se borran; si una cambia, se marca `reemplazado por` y se crea otro.

> Diferencia con [[_MOC Ideas|Ideas]]: una *idea* es una semilla sin compromiso; un *ADR* es una
> decisión razonada (aunque sea "propuesta") sobre cómo construir algo.

## Estados
`propuesto` · `aceptado` · `rechazado` · `reemplazado`

## Registro
| ADR | Decisión | Estado |
|---|---|---|
| [[ADR-001 Inicio de sesión con Google]] | Login social con Google | propuesto |
| [[ADR-002 Notificaciones en tiempo real]] | Tiempo real por usuario (FCM + WebSockets) | propuesto |
| [[ADR-003 Botón llamar o WhatsApp al cliente]] | Contacto directo sin copiar el número | propuesto |
| [[ADR-004 Clave de 4 números y teléfono de confianza]] | Entrar con celular (o Google) y clave de 4 números | aceptado |
| [[ADR-005 Todo el negocio en la web y lo del día a día en la app]] | El 100 % del negocio en la web; en la app, lo de hoy y lo del día a día | aceptado |

## Conecta con
- [[_MOC Ideas]] · [[Estado Actual]] · [[_MOC Convenciones]]
