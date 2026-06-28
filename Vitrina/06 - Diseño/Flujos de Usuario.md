---
title: Flujos de Usuario
tags: [diseño]
estado: hecho
actualizado: 2026-06-28
---

# 🔀 Flujos de Usuario

## Cliente — comprar
```mermaid
flowchart LR
    A[Explorar negocios] --> B[Ver catálogo]
    B --> C[Agregar al carrito]
    C --> D[Checkout: dirección/teléfono/pago]
    D --> E[Confirmar]
    E --> F[Mis pedidos / seguimiento]
```

## Comerciante — atender
```mermaid
flowchart LR
    A[Ver pedidos recibidos] --> B[Preparar]
    B --> C[Marcar listo]
```

## Domiciliario — entregar
```mermaid
flowchart LR
    A[Ver disponibles] --> B[Tomar + minutos]
    B --> C[Recogido] --> D[En camino] --> E[Entregado]
```

Ver el flujo unificado en [[Mapa de Actores]] y los estados en [[Lógica de Negocio]].

## 🔗 Relacionado
- [[_MOC Diseño]] · [[_MOC Casos de Uso]]
