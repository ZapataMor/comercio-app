---
title: ADR-001 Inicio de sesión con Google
tags: [adr]
id: ADR-001
estado: propuesto
decididores: []
fecha: 2026-06-28
afecta_a: [autenticación, app móvil, backend]
actualizado: 2026-06-28
---

# ADR-001 — Inicio de sesión con Google

> Ofrecer "Iniciar sesión con Google" además del registro/login por correo y contraseña.

| | |
|---|---|
| **Estado** | propuesto |
| **Fecha** | 2026-06-28 |
| **Decididores** | (pendiente) |

## Contexto
Hoy la autenticación es **correo + contraseña** con tokens **Sanctum** (`POST /api/register`,
`POST /api/login`). Para el [[Cliente]] esto añade fricción al registro (recordar otra
contraseña), justo en el actor del que dependen las ventas. El proyecto **ya usa Firebase** para
notificaciones push ([[Reglas de Notificacion]]), así que parte de la infraestructura de Google
ya está en juego.

Queremos reducir la fricción de alta sin romper el modelo actual de tokens ni los
[[Convenciones de Negocio|roles]] (`usuario`/`comerciante` en registro público).

## Decisión
Añadir **login social con Google** que termina emitiendo el **mismo token Sanctum** que ya usa
la app, para no tocar el resto de la API:

1. **App móvil (React Native)**: usar el SDK nativo de Google Sign-In; obtiene un `idToken`.
2. **Backend (Laravel)**: endpoint `POST /api/auth/google` que **verifica el `idToken`** de
   Google, busca o crea el `User` por correo, le asigna rol por defecto `usuario` si es nuevo, y
   devuelve un **token Sanctum** (igual que login normal).
3. Vincular cuentas por **correo**: si ya existe un usuario con ese email, se asocia el proveedor
   Google en vez de duplicar.

## Alternativas consideradas
| Opción | Pros | Contras |
|---|---|---|
| **Verificar `idToken` en backend + emitir Sanctum** (elegida) | No cambia el resto de la API; un solo modelo de sesión (token Sanctum); móvil-first | Hay que manejar verificación del token y vinculación por correo |
| **Laravel Socialite (flujo OAuth web/redirect)** | Estándar, poco código en backend | El redirect encaja mal con app nativa; pensado para web |
| **Firebase Authentication** | Ya usamos Firebase; SDK listo | Mete un segundo sistema de identidad junto a Sanctum; más acoplamiento a Firebase |

## Consecuencias
- **Positivas**: menos fricción de registro/login para el cliente; base para futuros proveedores
  (Apple, Facebook) con el mismo patrón "verificar token → emitir Sanctum".
- **Negativas / costos**: configurar credenciales OAuth de Google (Android/iOS/web); manejar
  usuarios sin contraseña (campo `password` nullable / login solo social).
- **Riesgos / pendientes**:
  > [!todo] Pendiente de decidir
  > - ¿Cómo elige el rol un **comerciante** que entra con Google? (el registro normal sí lo pide).
  > - Política de **vinculación de cuentas** si el correo ya existe con contraseña.
  > - ¿Login con Google también para la **web Blade**, o solo para la app?

## 🔗 Relacionado
- [[_MOC ADR]] · [[Cliente]] · [[Convenciones de Negocio]] · [[Estado Actual]]
