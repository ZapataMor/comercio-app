---
title: Mapa de Actores
tags: [actor, diseño]
estado: hecho
actualizado: 2026-06-28
---

# 🗺️ Mapa de Actores — visión de conjunto

```mermaid
flowchart LR
    Cliente -->|crea pedido| Pedido
    Comerciante -->|prepara y marca listo| Pedido
    Domiciliario -->|toma, recoge, entrega| Pedido
    Pedido -->|entregado| Cliente
    Administrador -.->|gestiona usuarios/roles/negocios| Cliente
    Administrador -.-> Comerciante
    Administrador -.-> Domiciliario
```

- [[Cliente]] inicia la demanda. [[Comerciante]] la satisface. [[Domiciliario]] la transporta.
  [[Administrador]] supervisa el ecosistema.
- El objeto que los conecta a todos es el **Pedido** ([[Lógica de Negocio]]).

## 🔗 Relacionado
- [[_MOC Actores]] · [[_MOC Diseño]]
