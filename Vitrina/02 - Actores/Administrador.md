---
title: Administrador
tags: [actor]
tipo: actor
estado: hecho
rol_sistema: administrador
objetivos: [supervisar plataforma, gestionar usuarios y roles]
permisos: [ver stats, CRUD usuarios, asignar roles, ver todos los negocios]
historias_relacionadas: [HU-007]
actualizado: 2026-06-28
---

# 🛡️ Administrador

> Operador de la plataforma (rol `administrador`). Gestiona el ecosistema completo.

## 🎯 Objetivos
- Tener visión global de usuarios, roles y negocios.
- Crear usuarios y asignar los roles que el registro público no permite (admin, domiciliario).

## 🛠️ Responsabilidades / acciones
- Ver **tablero** con totales (usuarios, negocios, abiertos, productos).
- Gestionar **usuarios** (filtrar por rol, crear, cambiar rol).
- Ver **todos los negocios** (dueño, productos, abierto/cerrado).

## 🔐 Permisos
- Zona `role:administrador` (`/api/admin/*`).
- **Salvaguarda**: no puede quitarse su propio rol de administrador.

## 🔗 Relacionado
- [[_MOC Actores]] · [[Modelo de Negocio]]
- Historia: [[HU-007 Administrar la plataforma]]
