---
title: ADR-003 Botón llamar o WhatsApp al cliente
tags: [adr]
id: ADR-003
estado: propuesto
decididores: []
fecha: 2026-06-28
afecta_a: [app móvil, domiciliario, privacidad]
actualizado: 2026-06-28
---

# ADR-003 — Botón para llamar o escribir por WhatsApp al cliente

> En el pedido, el [[Domiciliario]] toca un botón y llama o abre WhatsApp con el cliente, sin
> copiar el número a mano.

| | |
|---|---|
| **Estado** | propuesto |
| **Fecha** | 2026-06-28 |
| **Decididores** | (pendiente) |

## Contexto
El pedido ya guarda `telefono_contacto` (y `direccion_entrega`). Cuando el domiciliario va a
recoger/entregar ([[CU-004 Entregar un pedido]]) muchas veces necesita coordinar con el
[[Cliente]] ("ya llegué", "¿en qué piso?"). Hoy tendría que **leer y copiar** el número y
salir de la app para marcar o buscar el contacto en WhatsApp — fricción y errores de tipeo.

## Decisión
En la pantalla del pedido del domiciliario, mostrar **dos acciones directas** sobre
`telefono_contacto`, usando los esquemas de enlace del sistema operativo (no requieren backend):

1. **Llamar** → `tel:<telefono>` (abre el marcador con el número ya puesto).
2. **WhatsApp** → `https://wa.me/<telefono_e164>` (o `whatsapp://send?phone=...`), abre el chat
   con el cliente directamente.

El número se **normaliza a formato internacional (E.164)** antes de armar el enlace (prefijo de
país de Colombia `+57` por defecto si viene sin él).

## Alternativas consideradas
| Opción | Pros | Contras |
|---|---|---|
| **Deep links `tel:` y `wa.me`** (elegida) | Cero backend; nativo; instantáneo; sin copiar | Expone el número real del cliente al domiciliario |
| **Número enmascarado vía proxy** (Twilio/etc.) | Privacidad: ninguno ve el número del otro | Costo por minuto/mensaje; integración y backend; complejidad alta |
| **Llamada/chat dentro de la app (VoIP)** | Control total, sin salir de la app | Mucho esfuerzo; fuera de alcance hoy |

## Consecuencias
- **Positivas**: coordinación de entrega en un toque; menos errores; mejora directa de la
  experiencia del domiciliario y del cliente.
- **Negativas / costos**: el domiciliario **ve el número real** del cliente (y viceversa si se
  ofrece al revés). Aceptable para un v1; revisar con la política de privacidad.
- **Riesgos / pendientes**:
  > [!todo] Pendiente de decidir
  > - ¿Ofrecer también el botón **al cliente** para contactar al domiciliario?
  > - ¿Hasta qué estado del pedido se muestra el botón (p. ej. solo `tomado`…`en_camino`)?
  > - Privacidad: evaluar **número enmascarado (proxy)** como evolución futura.
  > - Validar/normalizar `telefono_contacto` en el checkout para garantizar E.164.

## 🔗 Relacionado
- [[_MOC ADR]] · [[Domiciliario]] · [[Cliente]] · [[CU-004 Entregar un pedido]]
