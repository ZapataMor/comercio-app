---
title: Configurar acceso con Google
tags: [referencia]
estado: pendiente
actualizado: 2026-11-19
---

# 🔑 Configurar acceso con Google

> Las personas pueden **crear su cuenta y entrar con Google** («Continuar con Google» en el login
> y en el registro). El código ya está hecho y probado. Falta lo que solo puedes hacer tú: crear
> las credenciales en Google Cloud y pegar un ID en dos lugares. Mientras no lo hagas, el botón
> **no aparece** y todo sigue igual que antes.

## Cómo funciona (lo que ya está hecho)

- **Login y registro**: botón «Continuar con Google». Se abre la hoja de cuentas de Google del
  teléfono (Credential Manager de Android, la forma actual que pide Google) y la app manda al
  servidor un *ID token* firmado por Google. El servidor verifica la firma, que el token es para
  Vitrina y que no venció (`backend/app/Support/GoogleIdToken.php`).
- **Cuenta nueva**: la primera vez sale una pantalla corta con el nombre y apellidos que trae Google
  (se pueden corregir) y la casilla de la política de privacidad (Ley 1581). No pide contraseña ni
  celular: el teléfono se pide en el primer pedido, como a cualquier cliente.
- **Cuenta que ya existe con ese correo**: NO se une sola. En Vitrina el correo no se confirma al
  registrarse, así que alguien pudo crear una cuenta con un correo ajeno. La app le dice a la
  persona que entre con su contraseña y conecte Google desde **Mi información → Cuenta**.
- **Mi información**: conectar o desconectar Google. Quien se registró con Google puede **crear
  una contraseña** (sin escribir la actual) para entrar también con su correo. Desconectar Google
  exige tener contraseña.
- **Eliminar la cuenta**: quien no tiene contraseña la confirma eligiendo otra vez su cuenta de
  Google. La página web de eliminar cuenta pide contraseña: esa persona puede crear una con
  «¿Olvidaste tu contraseña?» (le llega un código a su correo de Google).
- **iOS**: todavía no; el botón solo aparece en Android.

## Lo que necesitas hacer

### 1. Abrir el proyecto de Google Cloud

Usa el **mismo proyecto de Firebase** que ya manda las notificaciones (`miproyecto-48045`):

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) con la cuenta de Google
   dueña de Firebase.
2. Arriba, en el selector de proyectos, elige **miproyecto-48045**.

### 2. Pantalla de consentimiento (lo que ve la persona al elegir su cuenta)

En el menú: **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva se
llama **Google Auth Platform**). Si te pide empezar, pulsa **Comenzar**:

1. **Información de la app**: nombre `Vitrina`, correo de asistencia (el tuyo).
2. **Público**: **Externo**.
3. **Información de contacto**: tu correo. Acepta la política de datos de usuario de Google.
4. Luego, en **Desarrollo de la marca** (*Branding*) completa cuando los tengas:
   - Página principal y **política de privacidad**: `https://TU-DOMINIO/privacidad`
     (mientras no haya dominio puedes dejarlo para después; solo es obligatorio para publicar).
   - **Dominios autorizados**: tu dominio propio (no sirve una IP).
   - El logo es opcional. Si lo subes, Google revisa la marca (tarda unos días); sin logo no.
5. En **Público** (*Audience*):
   - Mientras pruebas puede quedar en **Prueba** (*Testing*): agrega como **usuarios de prueba**
     los correos de Google con que vas a probar (el tuyo y los de tus compañeros).
   - Para que **cualquier persona** pueda entrar: **Publicar app** (*Publish app*). Vitrina solo
     pide nombre, correo y foto básica (permisos no sensibles), así que Google **no** exige la
     revisión larga.

### 3. Crear el ID de cliente «Aplicación web» (el que va en el código)

**APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
(o **Google Auth Platform → Clientes → Crear cliente**):

1. Tipo de aplicación: **Aplicación web**. Nombre: `Vitrina servidor`.
2. No pongas orígenes ni URIs de redirección: no hacen falta.
3. **Crear** y copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).
   El «secreto del cliente» **no** se usa: no lo pegues en ningún lado.

### 4. Crear el ID de cliente «Android» (autoriza a la app por su firma)

Mismo lugar, **Crear credenciales → ID de cliente de OAuth**, tipo **Android**:

1. Nombre: `Vitrina Android debug`.
2. Nombre del paquete: `com.comercioapp`
3. Huella SHA-1 de la llave de **debug** (la usan el APK de desarrollo y el staging del VPS):

   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```

4. **Crear**. Este ID **no** se copia a ningún lado: solo le dice a Google que la app con ese
   paquete y esa firma es Vitrina.

Más adelante, cuando tengas la llave de la versión final (ver `DESPLIEGUE.md`), crea **otro**
cliente Android igual, con la SHA-1 de esa llave:

```
keytool -list -v -keystore RUTA\DE\TU\vitrina-release.keystore -alias TU_ALIAS
```

Y si publicas en Play Store con *Firma de apps de Google Play*, crea **uno más** con la SHA-1 que
aparece en Play Console → **Prueba y lanzamiento → Configuración → Integridad de la app →
Certificado de la clave de firma de apps**. Sin ese, el botón falla en la app descargada de Play.

### 5. Pegar el ID web en la app y en el servidor

1. **App**: en `frontend/src/config.ts` → `GOOGLE_WEB_CLIENT_ID = 'TU-ID.apps.googleusercontent.com'`.
2. **Backend local**: en `backend/.env` → `GOOGLE_CLIENT_IDS=TU-ID.apps.googleusercontent.com`.
3. **Servidor (VPS)**: lo mismo en el `.env` del servidor, y después:

   ```
   php artisan migrate --force
   php artisan config:cache
   ```

   (La migración agrega `google_id` a los usuarios y deja la contraseña opcional.)

### 6. Volver a compilar e instalar la app

El acceso con Google trae código nativo nuevo: **no basta recargar Metro**. Compila e instala el
APK otra vez (`npm run android`, o el APK debug con `adb -s ... install -r`, ver
[[Cómo levantar el proyecto cada día]]). Para el VPS, genera el APK staging de nuevo.

### 7. Probar

1. El emulador debe tener **Google Play** (los tres AVD de Vitrina lo tienen) y una **cuenta de
   Google** agregada: Ajustes del emulador → Contraseñas y cuentas → Agregar cuenta → Google.
2. Si la pantalla de consentimiento está en **Prueba**, esa cuenta debe estar en los usuarios de
   prueba.
3. En el login toca **Continuar con Google**, elige la cuenta, acepta la política → entras.
4. Cierra sesión y vuelve a tocar el botón: debe entrar directo, sin pedir datos.

## Si algo falla

| Lo que ves | Causa probable |
|---|---|
| El botón no aparece | `GOOGLE_WEB_CLIENT_ID` vacío en `config.ts`, o la app no se volvió a compilar. |
| «No fue posible entrar con Google» y en la consola de Metro `[28444] Developer console is not set up correctly` o `DEVELOPER_ERROR` | Falta el cliente **Android** con el paquete `com.comercioapp` y la SHA-1 de la llave con que se firmó **ese** APK, o el ID de `config.ts` no es el de tipo **web**. Los cambios en Google Cloud pueden tardar unos minutos. |
| «No encontramos cuentas de Google en este teléfono» | No hay cuenta de Google en el teléfono, o la cuenta no está entre los usuarios de prueba. |
| «No fue posible confirmar tu cuenta de Google» (lo dice el servidor) | `GOOGLE_CLIENT_IDS` del backend no tiene el mismo ID web de la app, o el reloj del servidor está muy desfasado. |
| «Entrar con Google no está disponible por ahora» (503) | `GOOGLE_CLIENT_IDS` vacío en el `.env` del servidor (o falta `config:cache` tras cambiarlo). |

## Dónde está el código

- Backend: `app/Http/Controllers/Api/GoogleController.php` (rutas `POST /api/google`,
  `POST/DELETE /api/perfil/google`), `app/Support/GoogleIdToken.php`, pruebas en
  `tests/Feature/AccesoGoogleTest.php`.
- App: `src/google.ts`, `src/components/BotonGoogle.tsx`, `src/screens/RegistroGoogleScreen.tsx`,
  módulo nativo `android/app/src/main/java/com/comercioapp/GoogleAccesoPackage.kt`.
