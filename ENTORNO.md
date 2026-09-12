# 🛠️ Guía de instalación del entorno de desarrollo (Windows 10/11)

Todo lo necesario para levantar **comercio-app** en una máquina nueva.
Versiones tomadas del propio proyecto (`composer.json`, `package.json`, `android/build.gradle`).

> 💡 Esto es la instalación **desde cero**. Para el arranque del **día a día** (qué comando
> ejecutar cada vez que enciendes el PC) usa `iniciar-dev.bat` en la raíz, o lee
> `Vitrina/00 - Inicio/Cómo levantar el proyecto cada día.md`.

---

## 1. Qué lleva el proyecto

| Carpeta     | Qué es                     | Tecnología                                                  |
| ----------- | -------------------------- | ----------------------------------------------------------- |
| `backend/`  | API REST + web Blade       | Laravel 13 · PHP ≥ 8.3 (probado en 8.4) · MySQL · Composer · Vite + Tailwind 4 |
| `frontend/` | App móvil                  | React Native 0.86 **bare** (no Expo) · TypeScript · Hermes + New Architecture · Firebase Messaging + Notifee |
| `Vitrina/`  | Documentación del proyecto | Bóveda de Obsidian (markdown)                                |

> ⚠️ El proyecto **no usa Expo**. Se compila con Android Studio / Gradle, así que hace falta el SDK de Android y un JDK.

---

## 2. Versiones exactas requeridas

| Herramienta        | Versión                             | De dónde sale                           |
| ------------------ | ----------------------------------- | --------------------------------------- |
| PHP                | **≥ 8.3** (recomendado 8.4)         | `backend/composer.json`                 |
| Composer           | 2.x                                 | —                                       |
| MySQL              | 8.x, base `comercio_api`            | `backend/.env.example`                  |
| Node.js            | **≥ 22.11** (usa el 22 LTS)         | `frontend/package.json` → `engines`     |
| JDK                | **17** (Temurin / Adoptium)         | Requisito de React Native 0.86          |
| Android SDK        | **Platform 36** (Android 16)        | `compileSdkVersion = 36`                |
| Build-Tools        | **36.0.0**                          | `buildToolsVersion`                     |
| NDK                | **27.1.12297006**                   | `ndkVersion`                            |
| minSdk             | 24 (Android 7.0) — mínimo del móvil | `minSdkVersion`                         |
| Gradle             | 9.3.1 (lo baja solo el wrapper)     | `gradle-wrapper.properties`             |
| Kotlin             | 2.1.20 (lo resuelve Gradle)         | `kotlinVersion`                         |

No hace falta instalar Gradle ni Kotlin a mano: el *wrapper* (`gradlew`) los descarga la primera vez.

---

## 3. Instalación paso a paso

Abre **PowerShell como administrador**. Con `winget` (viene en Windows 10/11) va todo en una línea cada uno.

### 3.1 Lo básico

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e          # Node 22 LTS (trae npm)
winget install --id Microsoft.VisualStudioCode -e # editor (opcional pero recomendado)
winget install --id Obsidian.Obsidian -e          # para abrir la carpeta Vitrina/
```

Cierra y abre PowerShell y comprueba:

```powershell
git --version
node -v     # debe ser >= 22.11
npm -v
php -v      # >= 8.3  (ya lo tienes)
composer -V
mysql --version
```

### 3.2 JDK 17

```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK -e
```

Luego define `JAVA_HOME` (ajusta la ruta a la que se haya instalado):

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17", "User")
```

Verifica en una terminal nueva: `java -version` → `openjdk version "17..."`.

> Si ya tienes otro JDK (21, 23…), instala igual el 17 y apunta `JAVA_HOME` ahí: Gradle 9 + AGP de RN 0.86 está probado con 17.

### 3.3 Android Studio + SDK

```powershell
winget install --id Google.AndroidStudio -e
```

Ábrelo y completa el asistente (*Standard*). Después entra en
**Settings → Languages & Frameworks → Android SDK** y, en cada pestaña, marca:

**SDK Platforms** (activa *Show Package Details*):
- ✅ **Android 16.0 — API Level 36**
  - ✅ Android SDK Platform 36
  - ✅ Google Play Intel x86_64 Atom System Image *(o ARM 64 si tu portátil es ARM)* → para el emulador

**SDK Tools** (activa *Show Package Details*):
- ✅ Android SDK Build-Tools **36.0.0**
- ✅ Android SDK Command-line Tools (latest)
- ✅ Android SDK Platform-Tools
- ✅ Android Emulator
- ✅ **NDK (Side by side) 27.1.12297006**
- ✅ CMake (última)
- ✅ Intel x86 Emulator Accelerator / Android Emulator hypervisor driver *(solo en CPU Intel)*

Pulsa **Apply** y espera la descarga (son varios GB).

### 3.4 Variables de entorno de Android

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")

$p = [Environment]::GetEnvironmentVariable("Path", "User")
$p += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
$p += ";$env:LOCALAPPDATA\Android\Sdk\emulator"
$p += ";$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
[Environment]::SetEnvironmentVariable("Path", $p, "User")
```

Cierra **todas** las terminales, abre una nueva y comprueba:

```powershell
adb --version
emulator -list-avds
```

### 3.5 Emulador o teléfono físico

**Opción A — Emulador:** en Android Studio, **Device Manager → Create Device** →
Pixel 7 → imagen **API 36** → Finish. Arráncalo desde ahí.

**Opción B — Teléfono real (más rápido y realista):**
1. En el móvil: *Ajustes → Acerca del teléfono* → toca 7 veces **Número de compilación**.
2. *Opciones de desarrollador* → activa **Depuración por USB**.
3. Conecta por USB, acepta el diálogo de confianza y verifica con `adb devices`.

---

## 4. Clonar y levantar el proyecto

```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/ZapataMor/comercio-app.git
cd comercio-app
```

> 📌 Mantén el repo **fuera de OneDrive**: `node_modules` y las builds de Gradle dan
> problemas de sincronización (por eso se movió a `C:\dev` en su momento).

### 4.1 Backend (Laravel)

```powershell
cd C:\dev\comercio-app\backend

composer install
copy .env.example .env
php artisan key:generate
```

Crea la base de datos y ajusta el `.env` (`DB_DATABASE=comercio_api`, `DB_USERNAME`, `DB_PASSWORD`):

```powershell
mysql -u root -p -e "CREATE DATABASE comercio_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Migra, siembra datos de prueba y enlaza el almacenamiento de imágenes:

```powershell
php artisan migrate --seed
php artisan storage:link
npm install          # Vite + Tailwind para la web Blade
npm run build
```

Levanta la API:

```powershell
php artisan serve --host=0.0.0.0 --port=8000
```

El `--host=0.0.0.0` es **obligatorio** si vas a probar desde un teléfono físico.

Usuarios de prueba que crea el seeder: uno por rol, contraseña **`password123`**
(mira `database/seeders/DemoUsersSeeder.php` para los correos).

> Las colas van por base de datos (`QUEUE_CONNECTION=database`). Si pruebas
> notificaciones push, deja corriendo en otra terminal:
> `php artisan queue:listen --tries=1`

### 4.2 Frontend (React Native)

En **otra terminal**:

```powershell
cd C:\dev\comercio-app\frontend
npm install
npx react-native-asset       # copia las fuentes Sora + Inter a los proyectos nativos
```

Con el emulador abierto (o el móvil conectado):

```powershell
npm start          # arranca Metro; déjalo corriendo
```

Y en otra terminal:

```powershell
cd C:\dev\comercio-app\frontend
npm run android    # compila e instala la app
```

La primera compilación tarda bastante (Gradle descarga todo). Las siguientes son rápidas.

---

## 5. Conectar la app con tu API

`frontend/src/config.ts` define la URL base:

```ts
export const API_URL = 'http://10.0.2.2:8000';
```

| Dónde corres la app | Valor de `API_URL`                             |
| ------------------- | ---------------------------------------------- |
| Emulador Android    | `http://10.0.2.2:8000` (es el localhost del PC)|
| Teléfono físico     | `http://TU_IP_LAN:8000` — mírala con `ipconfig` |

Para el teléfono físico, además:
- PC y móvil en la **misma red WiFi**.
- API levantada con `--host=0.0.0.0`.
- Permite el puerto 8000 en el firewall:

```powershell
New-NetFirewallRule -DisplayName "Laravel 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

> No commitees el cambio de `API_URL` con tu IP local; déjalo en `10.0.2.2` al subir.

---

## 6. Firebase (notificaciones push)

- **App Android:** `frontend/android/app/google-services.json` **ya está en el repo**. No hay que hacer nada.
- **Backend:** la credencial de servidor **NO está en el repo** (es secreta). Necesitas copiar
  el JSON de la *service account* desde tu PC principal (o descargarlo de la consola de Firebase →
  *Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada*) y dejarlo en:

  ```
  backend/storage/app/firebase/service-account.json
  ```

  Luego en `backend/.env`:

  ```
  FIREBASE_PROJECT=app
  FIREBASE_CREDENTIALS=storage/app/firebase/service-account.json
  ```

⚠️ Ese archivo **nunca** va a Git. Pásalo por USB o por un gestor de contraseñas, no por chat.

---

## 7. Documentación (Vitrina)

Abre Obsidian → **Open folder as vault** → selecciona `C:\dev\comercio-app\Vitrina`.
Ahí están historias de usuario, casos de uso, casos de prueba y el sistema visual.

El estado del proyecto se lleva en `backend/ESTADO_DEL_PROYECTO.md`.

---

## 8. Checklist final

```powershell
node -v            # >= 22.11
java -version      # 17.x
php -v             # >= 8.3
composer -V
adb devices        # tu emulador o móvil aparece
```

- [ ] `php artisan serve --host=0.0.0.0` responde en `http://localhost:8000`
- [ ] `npm start` levanta Metro sin errores
- [ ] `npm run android` instala la app en el dispositivo
- [ ] La app hace login con un usuario del seeder (`password123`)

---

## 9. Problemas comunes

| Síntoma                                             | Solución                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `SDK location not found`                             | Falta `ANDROID_HOME`, o crea `frontend/android/local.properties` con `sdk.dir=C\:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk` |
| `Unsupported class file major version` / error de Gradle | `JAVA_HOME` apunta a un JDK que no es el 17                                              |
| La app abre pero no carga datos                      | `API_URL` mal, o la API no está con `--host=0.0.0.0`, o el firewall bloquea el 8000        |
| `Unable to load script` en la app                    | Metro no está corriendo (`npm start`) o falta `adb reverse tcp:8081 tcp:8081`              |
| Build de Gradle con errores raros tras actualizar    | `cd frontend/android; .\gradlew clean` y vuelve a `npm run android`                        |
| Metro se queda con caché vieja                       | `npm start -- --reset-cache`                                                               |
| Las fuentes salen genéricas                          | Faltó `npx react-native-asset` y recompilar                                                |
| Laravel: `could not find driver`                     | Habilita `extension=pdo_mysql` (y `mbstring`, `fileinfo`, `gd`, `intl`) en `php.ini`        |
| `php artisan pail` no funciona                       | En Windows no hay `pcntl`; lee `backend/storage/logs/laravel.log` directamente              |

---

## 10. Lo que NO necesitas en Windows

- **Expo / Expo Go** — el proyecto es *bare*, no funciona con Expo Go.
- **Xcode / CocoaPods / Ruby** — la carpeta `frontend/ios` solo compila en macOS.
- **Watchman** — es para macOS/Linux.
