# 🚀 Despliegue a producción (piloto)

Qué hay que hacer para pasar de "corre en mi PC" a "la gente de Maicao la instala desde
Play Store". Complementa a `ENTORNO.md`, que cubre el entorno de desarrollo.

> iOS va después de Android (decisión del 2026-10-28). Esta guía cubre servidor + Android.

---

## 1. Checklist rápido

| # | Qué | Dónde | Hecho en el código |
|---|-----|-------|--------------------|
| 1 | Servidor con PHP 8.4, MySQL 8, HTTPS y un dominio | proveedor de hosting | ⏳ lo eliges tú |
| 2 | `.env` de producción (ver §3) | servidor | plantilla en `backend/.env.example` |
| 3 | Cola de push corriendo siempre (`queue:work`) | servidor (supervisor) | ✅ los push van en cola |
| 4 | Tareas programadas (`schedule:run` cada minuto) | servidor (cron) | ✅ |
| 5 | Correo SMTP real (códigos de recuperar contraseña) | `.env` | ✅ flujo listo, falta el proveedor |
| 6 | Credenciales de Firebase en el servidor | `storage/app/firebase/` | ✅ |
| 7 | `API_URL_PRODUCCION` con el dominio real (HTTPS) | `frontend/src/config.ts` | ⏳ hoy dice `api.vitrina.example` |
| 8 | Llave de firma de Play Store | `frontend/android/keystore.properties` | ✅ Gradle la lee si existe |
| 9 | Política de privacidad y página para eliminar cuenta | `https://TU-DOMINIO/privacidad` y `/eliminar-cuenta` | ✅ |
| 10 | Datos del responsable y correo de contacto | `.env` (`VITRINA_*`) | ⏳ |
| 11 | `applicationId` definitivo (no se puede cambiar después de publicar) | `android/app/build.gradle` | ⏳ hoy `com.comercioapp` |

---

## 2. Servidor

Cualquier VPS con Linux sirve (DigitalOcean, Hetzner, Contabo, AWS Lightsail…), o un
servicio administrado para Laravel (Laravel Forge + VPS, Ploi, Laravel Cloud). Requisitos:

- PHP **8.4** con extensiones `pdo_mysql`, `mbstring`, `openssl`, `sodium`, `gd`, `curl`, `zip`.
- MySQL 8 (base `comercio_api` o la que quieras).
- Nginx o Apache apuntando a `backend/public`.
- **HTTPS obligatorio**: Android bloquea `http://` en la versión final. Certificado gratis con Let's Encrypt.
- Un subdominio para la API, p. ej. `api.tudominio.co`.

### Primer despliegue

```bash
git clone https://github.com/ZapataMor/comercio-app.git
cd comercio-app/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env        # y llénalo (ver §3)
php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=RoleSeeder --force
php artisan db:seed --class=BarriosSeeder --force
php artisan storage:link
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

> ⚠️ En producción **NO** corras `DemoUsersSeeder` ni `CatalogoDemoSeeder` (crean cuentas con
> contraseña conocida). Crea el primer admin con `php artisan tinker`:
> `$u = App\Models\User::create(['name'=>'...','email'=>'...','password'=>'...']); $u->assignRole('administrador');`

### Cada actualización

```bash
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan queue:restart
```

### Procesos que deben quedar corriendo

**Cola** (envía los push). Con supervisor, `/etc/supervisor/conf.d/vitrina-cola.conf`:

```ini
[program:vitrina-cola]
command=php /ruta/comercio-app/backend/artisan queue:work --tries=3 --max-time=3600
autostart=true
autorestart=true
user=www-data
stdout_logfile=/ruta/comercio-app/backend/storage/logs/cola.log
```

**Tareas programadas** (horarios de los negocios y demás). En `crontab -e` del usuario web:

```
* * * * * cd /ruta/comercio-app/backend && php artisan schedule:run >> /dev/null 2>&1
```

---

## 3. `.env` de producción (lo que cambia respecto a desarrollo)

```dotenv
APP_NAME=Vitrina
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.tudominio.co
APP_LOCALE=es
APP_TIMEZONE=America/Bogota

DB_DATABASE=comercio_api
DB_USERNAME=...
DB_PASSWORD=...

QUEUE_CONNECTION=database

# Correo real para los códigos de "olvidé mi contraseña" (Brevo, Mailgun, SES, Gmail SMTP…)
MAIL_MAILER=smtp
MAIL_HOST=...
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=no-responder@tudominio.co
MAIL_FROM_NAME="Vitrina"

# Firebase (push): el JSON de la cuenta de servicio, fuera de git
FIREBASE_CREDENTIALS=/ruta/comercio-app/backend/storage/app/firebase/service-account.json

# Datos que salen en la política de privacidad y en los correos
VITRINA_RESPONSABLE="Nombre de la persona o empresa responsable"
VITRINA_CORREO_CONTACTO=soporte@tudominio.co
VITRINA_CIUDAD="Maicao, La Guajira, Colombia"
```

> En desarrollo `MAIL_MAILER=log`: el código de recuperación aparece en
> `backend/storage/logs/laravel.log`.

---

## 4. App Android (versión final)

### 4.1 Apuntar al servidor

En `frontend/src/config.ts` cambia `API_URL_PRODUCCION` por tu dominio con HTTPS. La app usa
esa URL automáticamente en la versión final y la de desarrollo con Metro.

### 4.2 Crear la llave de subida (una sola vez)

Desde `frontend/android/app` (necesita el JDK 17 del entorno):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore vitrina-upload.keystore -alias vitrina-upload -keyalg RSA -keysize 2048 -validity 10000
```

Luego copia `frontend/android/keystore.properties.example` como `keystore.properties` y llena
las contraseñas que escogiste.

> 🔐 **Guarda la llave y sus contraseñas en un lugar seguro fuera del PC** (gestor de
> contraseñas + copia del archivo). Ni el `.keystore` ni `keystore.properties` se suben a git.
> Usa "Play App Signing" en la consola de Play: si pierdes la llave de subida se puede reponer.

### 4.3 Compilar el paquete para Play Store

```bash
cd frontend/android
./gradlew bundleRelease
```

Sale en `android/app/build/outputs/bundle/release/app-release.aab`. Antes de cada versión nueva
sube `versionCode` (y `versionName`) en `android/app/build.gradle`.

### 4.4 Ficha de Play Store

- **Política de privacidad**: `https://api.tudominio.co/privacidad`
- **Eliminación de cuenta** (obligatoria para apps con registro): `https://api.tudominio.co/eliminar-cuenta`
- Formulario de **Seguridad de los datos**: la app recoge nombre, correo, teléfono, dirección,
  historial de pedidos e identificadores del dispositivo (push); no recoge pagos ni ubicación GPS.

---

## 5. Antes del piloto

- [ ] Elegir hosting y dominio; montar el servidor (§2) y el `.env` (§3).
- [ ] Revisar con un asesor el texto de `/privacidad` (Ley 1581 de 2012) y llenar `VITRINA_*`.
- [ ] Decidir el `applicationId` definitivo antes de la primera subida a Play Store. Si cambia,
      hay que registrar la app de nuevo en Firebase y reemplazar `android/app/google-services.json`.
- [ ] Crear la llave de subida (§4.2) y la cuenta de desarrollador de Google Play.
- [ ] Ajustar la tarifa de domicilio desde la app del admin.
- [ ] Prueba completa en un teléfono real con la versión final contra el servidor.
