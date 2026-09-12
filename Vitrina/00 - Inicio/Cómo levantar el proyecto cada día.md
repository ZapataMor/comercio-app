---
title: Cómo levantar el proyecto cada día
tags: [referencia]
estado: hecho
actualizado: 2026-09-12
---

# ▶️ Cómo levantar el proyecto cada día

> Guía práctica para arrancar el entorno y ver la app funcionando en el **teléfono** y en el
> **PC**. Sin tecnicismos: qué comando ejecutar, qué hace y cuándo hace falta.
> La instalación desde cero (una sola vez) está en `ENTORNO.md`, en la raíz del repo.

## ⚡ Atajo: `iniciar-dev.bat`

En la raíz del repo hay un archivo **`iniciar-dev.bat`**. Doble clic y abre las tres ventanas
que se necesitan, ya con los comandos correctos. Es el camino recomendado.

Si cambias de teléfono o el teléfono cambia de IP, edita la primera línea del archivo:

```bat
set "TELEFONO=192.168.1.5:5555"
```

## 🧩 Las tres piezas (y por qué son tres)

El proyecto no es un solo programa, son tres cosas que se hablan entre sí:

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **API (Laravel)** | El servidor: base de datos, login, pedidos. También sirve la web del PC. | `backend/` |
| **Metro** | El "servidor de código" de la app móvil. Le envía al teléfono el JavaScript recién guardado. | `frontend/` |
| **adb** | El puente entre el PC y el teléfono. Sin él, Metro no encuentra el móvil. | Android SDK |

Por eso son tres terminales: cada pieza se queda **corriendo**, no termina.

## 📅 El día a día (después de reiniciar el PC)

### Ventana 1 — La API

```powershell
cd C:\dev\comercio-app\backend
php artisan serve --host=0.0.0.0 --port=8000
```

El `--host=0.0.0.0` es lo que permite que el **teléfono** entre. Sin eso, solo respondería al
propio PC.

### Ventana 2 — Conectar el teléfono

```powershell
adb connect 192.168.1.5:5555
```

Una línea, sin cable. El teléfono recuerda que quedó escuchando por WiFi.

> [!warning] Si reiniciaste el **teléfono**
> Se olvida del modo WiFi. Hay que conectarlo por USB una vez y repetir:
> ```powershell
> adb devices -l                     # copia el serial del movil
> adb -s TU_SERIAL tcpip 5555
> adb connect 192.168.1.5:5555
> ```
> Después ya puedes quitar el cable.

### Ventana 3 — Metro

```powershell
cd C:\dev\comercio-app\frontend
npm start
```

Déjala abierta mientras programas. Si algo se queda raro, pulsa `r` ahí para recargar la app.

### Y ya

- **En el móvil:** abre la app desde su ícono, como cualquier app normal.
- **En el PC:** abre `http://localhost:8000` en el navegador (es la web Blade de Laravel).

## 🔄 ¿Qué se actualiza solo?

| Qué cambias | Qué tienes que hacer |
|---|---|
| Archivos de `frontend/src` (pantallas, estilos, lógica de la app) | **Nada.** Guardas y el teléfono se actualiza en 1-2 segundos |
| Archivos de `backend/` (controladores, rutas, vistas Blade) | **Nada.** Recargas la página del navegador |
| `backend/.env` | Parar la API (`Ctrl+C`) y volver a levantarla |
| Algo dentro de `frontend/android/`, íconos, permisos o una librería nativa nueva | Volver a ejecutar `npm run android` |

**`npm run android` no es de todos los días.** La app ya está instalada en el teléfono y ahí se
queda. Solo se vuelve a ejecutar en los casos de la última fila.

## 📖 Qué hace cada comando

| Comando | Qué hace |
|---|---|
| `php artisan serve --host=0.0.0.0 --port=8000` | Levanta la API en el puerto 8000, abierta a la red local |
| `adb connect IP:5555` | Conecta el PC con el teléfono por WiFi |
| `adb devices` | Lista los dispositivos conectados (sirve para comprobar) |
| `npm start` | Arranca Metro (igual que `npx react-native start`) |
| `npm run android` | Compila e **instala** la app en el teléfono (igual que `npx react-native run-android`) |
| `npm run dev` (en `backend/`) | Recarga en vivo los estilos Tailwind de la web. Solo si tocas CSS |
| `php artisan queue:listen --tries=1` | Procesa la cola. Solo si estás probando **notificaciones push** |
| `npm start -- --reset-cache` | Metro con la caché limpia. Cuando ves errores que "no tienen sentido" |

## 🚫 Lo que NO se ejecuta cada día

Estos son de instalación, una sola vez por PC:

`npm install` · `npx react-native-asset` · `composer install` · `php artisan migrate --seed` ·
`php artisan storage:link` · `npm run build`

## 🌐 La conexión app ↔ API

`frontend/src/config.ts` tiene la dirección a la que llama la app:

```ts
export const API_URL = 'http://192.168.1.X:8000';
```

| Dónde corre la app | Valor |
|---|---|
| Emulador de Android | `http://10.0.2.2:8000` |
| Teléfono físico | `http://IP_DEL_PC:8000` |

La IP es la del **PC**, no la del teléfono. Se ve con `ipconfig` (la IPv4 del adaptador Wi-Fi),
o directamente en la cabecera de `iniciar-dev.bat` al arrancar.

> [!danger] No subir la IP al repo
> Antes de hacer commit: `git checkout -- frontend/src/config.ts`.
> En el repo ese archivo debe quedar siempre con `10.0.2.2`.

## 🔧 Cuando algo falla

| Síntoma | Casi siempre es |
|---|---|
| La app abre pero **no carga datos** | La IP del PC cambió. Mira `ipconfig` y actualiza `config.ts` |
| `Unable to load script` | Metro no está corriendo, o el móvil no sabe dónde está: agita el teléfono → *Settings → Debug server host & port* → `IP_DEL_PC:8081` |
| `more than one device/emulator` | Hay emulador y móvil a la vez. Cierra el emulador, o usa `-s TU_SERIAL` |
| `cannot connect ... 10061` | El `adb tcpip 5555` no llegó a ejecutarse. Repítelo con el cable puesto |
| `adb devices` sale vacío | El teléfono se reinició: hay que rehacer el `tcpip` por USB |
| La web del PC no carga | La API no está levantada (ventana 1) |
| Las notificaciones push no llegan | Falta `php artisan queue:listen` |

## 🔗 Relacionado
- [[🏠 Home]] · [[Estado Actual]]
- Instalación desde cero: `ENTORNO.md` (raíz del repo)
