---
title: Propuesta - Animaciones y microinteracciones
tags: [diseño, propuesta, animación]
estado: propuesta
actualizado: 2026-06-29
---

# 🎞️ Propuesta — Animaciones y microinteracciones

> Del [[Rol - Diseñador UX-UI Senior]]. La app hoy es estática (ver
> [[Análisis UX-UI - Auditoría de la app]]). El movimiento, **con propósito**, es lo que hace
> que el usuario sienta que la app está "viva" y se sorprenda. Nada decorativo que estorbe.

## 📏 Reglas (las mismas en toda la app)
- **Duración:** 120–300 ms. Entradas con *ease-out*; lo "físico" (badges, switches) con *spring*.
- **Propósito:** cada animación comunica **estado** o **jerarquía**. Si no comunica, fuera.
- **Nunca bloquear** el input ni retrasar al usuario.
- **Respetar `reduce motion`** del sistema (degradar a *fade* corto).

## 🛠️ Stack sugerido (a instalar — hoy no está)
`react-native-reanimated` (motor) + `moti` (API declarativa simple) +
`react-native-haptic-feedback` (vibración sutil) + `lottie-react-native` (solo para 1–2
momentos especiales). Opcional: `react-native-bootsplash` para el splash.

## 📍 Dónde ponerlas (priorizado por impacto)

### 🥇 Las que de verdad sorprenden
1. **Agregar al carrito** *(momento estrella)*: al tocar "+", el contador del carrito hace
   *spring* (bump de escala) + **haptic** suave + toast. Opcional premium: la foto del producto
   "vuela" hacia el ícono del carrito. → en [[HU-002 Hacer un pedido|Negocio/Explorar]].
2. **Seguimiento del pedido** *(emoción)*: la línea de tiempo anima el paso activo con un
   **punto que pulsa**, la barra de progreso se rellena con *spring*, y al llegar una
   notificación push que cambia el estado, transición + haptic. → [[HU-003 Seguir mi pedido]].
3. **Listas que entran escalonadas**: tarjetas de Explorar/Home aparecen con `FadeInDown`
   en cascada (stagger 40–60 ms). Da sensación de calidad inmediata al abrir.
4. **Skeletons con shimmer** mientras carga (en vez del spinner): la app se siente rápida y
   pulida. → Explorar, Negocio, Mis pedidos.

### 🥈 Microinteracciones de tacto (en todos lados)
5. **Press en tarjetas/botones:** migrar `TouchableOpacity` → `Pressable` + `scale 0.97` y leve
   subida de sombra al presionar. Toda la app "responde" al dedo.
6. **Badge del carrito:** *spring pop* cada vez que cambia la cantidad.
7. **Pull-to-refresh:** color dorado (`accent`) en el `RefreshControl`.
8. **Toasts:** entrada *slide-down + fade* con *spring* (ya existe `Toast.tsx`; pulir la curva).
9. **Switch Abierto/Cerrado** (comerciante): transición de color + haptic ligero al alternar.

### 🥉 Detalles premium (opcionales)
10. **Splash → app:** logo aparece (scale + fade) y *cross-fade* a Login/Home.
11. **Pedido confirmado:** micro-Lottie de éxito/confeti **una sola vez** en checkout. Úsalo
    con moderación: es el clímax del flujo del [[Cliente]].
12. **Transición de imagen negocio → producto** (*shared element*): la foto crece de la lista
    al detalle. Muy "app de marca", pero es lo más caro de implementar; dejar para el final.

## 🗺️ Mapa rápido pantalla → animación
| Pantalla | Animación |
|---|---|
| Login | Entrada *fade+slide* de la tarjeta; botón *scale*; error = *shake* sutil |
| Home | Ítems del menú en cascada; press *scale* |
| Explorar / Negocio | Skeletons → cascada; "+" con bump + haptic; badge del carrito |
| Carrito / Checkout | Botón CTA dorado con press; confirmar → Lottie éxito |
| Seguimiento | Punto pulsante del estado activo + barra de progreso animada |
| Toasts (global) | Slide-down con spring |

## ✅ Recomendación
Implementar primero **1–7** (alto impacto, bajo costo). 8–12 son la capa de "lujo" que se
puede sumar después. Con 1–4 sola, la app ya pasa de "estática" a "wow".

## 🔗 Relacionado
- [[Rol - Diseñador UX-UI Senior]] · [[Propuesta - Paleta de color]]
- [[Propuesta - Tipografía y estilos]] · [[HU-003 Seguir mi pedido]]
