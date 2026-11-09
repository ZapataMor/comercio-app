# Probar Vitrina como en produccion

## Acceso web

La web permite iniciar sesion exclusivamente a administradores. No hay registro
publico ni interfaz web para clientes, negocios o domiciliarios; estos usan la app
Android. Las paginas de privacidad y eliminacion de cuenta siguen disponibles.
La antigua variable `WEB_PRUEBAS_HABILITADAS` ya no habilita ninguna ruta.

Para resultados de concurrencia, limites medidos y pruebas reproducibles,
consulta [PRUEBAS-CARGA.md](PRUEBAS-CARGA.md).

Este entorno local usa Linux en Docker Desktop (WSL 2), PHP 8.4-FPM, Nginx,
MySQL 8.4, Caddy con HTTPS, un trabajador de cola, el programador de Laravel
y Mailpit para recibir correos sin enviarlos a personas reales.
La app Android staging compila el JavaScript y los assets dentro de la APK,
con Hermes y sin Metro, igual que release.

## Arrancar

Abre Docker Desktop y espera a que el motor este listo. Desde la raiz:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar-preproduccion.ps1 -Demo -TrustCertificate
```

La primera ejecucion descarga y construye las imagenes. Genera automaticamente
`.env.preproduccion` con claves aleatorias y crea volumenes independientes para
MySQL, archivos subidos y la autoridad de certificados. No lee `backend/.env`
ni usa la base de datos de desarrollo. Conserva los datos entre arranques.
Sin `-Demo` solo carga roles y barrios; con `-Demo` carga el catalogo y cuentas
de prueba, copia las fotos publicas disponibles en Windows y les asigna imagenes
demo en Docker. No usa descargas externas para ese paso. Los platos sin un pool
especifico usan fotos demo generales de comida. No uses esos datos en un servidor publico.

Si ya tenias el catalogo y faltan sus imagenes, ejecuta una sola vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\sincronizar-imagenes-demo.ps1
```

El almacenamiento de Docker es independiente de `backend/storage/app/public`.
Copiar los archivos y asignar las referencias en su base de datos son pasos
necesarios para visualizar las fotos demo. El seeder conserva las imagenes
personalizadas subidas a preproduccion y actualiza las de demostracion.

- API, panel y paginas publicas: https://localhost:8443
- Bandeja de correo: http://localhost:8025
- Administrador de prueba: `admin@demo.co`, clave `password123`.
- Otros usuarios: `cliente@demo.co`, `comerciante@demo.co`,
  `domiciliario@demo.co`, todos con `password123`.

Los puertos se publican solo en el PC (`127.0.0.1`). El navegador puede mostrar
un aviso porque la CA es local. Puedes importar `artifacts/preproduccion-ca.crt`
en el almacen **del usuario actual** si quieres confiar en ella en el navegador.
El parametro `-TrustCertificate` hace esa importacion para el usuario actual.
La APK staging ya incluye esa CA para localhost y valida HTTPS normalmente.
La variante release no incluye ni confia en esa CA.

## Compilar e instalar en Android

Si ya tienes la APK y uno o varios emuladores abiertos, conecta, instala y abre
la app en todos con:

```powershell
powershell -ExecutionPolicy Bypass -File .\abrir-emuladores-preproduccion.ps1
```

Este paso es posterior al arranque de Docker. `iniciar-preproduccion.ps1`
levanta el servidor; `iniciar-emulador.bat` corresponde al desarrollo con Metro.
El nuevo script conserva los datos locales y funciona aunque haya varios
emuladores conectados. Si cambiaste el codigo de la app, recompila primero.

Inicia un emulador con Android Studio o conecta un telefono con depuracion USB:

```powershell
powershell -ExecutionPolicy Bypass -File .\compilar-preproduccion.ps1 -Install
```

El script copia la CA publica de Docker, compila `assembleStaging`, configura
`adb reverse tcp:8443 tcp:8443`, instala y abre la app. Si tienes varios
dispositivos usa `-Device emulator-5554` (consulta `adb devices`).
Genera `artifacts/vitrina-preproduccion.apk` para arm64-v8a y x86_64.
Puedes elegir arquitecturas con `-Architectures x86_64`.

La URL es `https://localhost:8443` dentro de Android y llega al PC por USB/ADB.
Repite `adb reverse tcp:8443 tcp:8443` si reinicias el dispositivo. Para un
telefono esta prueba necesita mantener la conexion USB.

Staging comparte `applicationId` y la configuracion Firebase existente con la
app de desarrollo: la instalacion reemplaza esa app y puede conservar su sesion.
Cierra sesion para entrar con una cuenta del entorno de prueba. La etiqueta
visible es **Vitrina Pruebas**. Si una version instalada tiene otra firma,
Android rechazara la actualizacion; no se desinstala automaticamente para
evitar borrar datos locales.

## Ejecutar pruebas

```powershell
powershell -ExecutionPolicy Bypass -File .\probar-preproduccion.ps1
```

Ejecuta la suite Laravel en SQLite y MySQL (BD exclusiva `vitrina_tests`, en
memoria temporal del contenedor), Jest y TypeScript. Despues prueba por HTTPS
salud, barrios, autenticacion, registro, dashboard, catalogo, recuperacion por
correo, cierre de sesion y eliminacion de la cuenta temporal. Tambien consulta
las tareas programadas, trabajos fallidos y estado de los servicios.

Para repetir solo las pruebas HTTP e infraestructura:

```powershell
powershell -ExecutionPolicy Bypass -File .\probar-preproduccion.ps1 -SkipUnitTests
```

Los correos se capturan en Mailpit y Sentry esta desactivado. Firebase del
servidor esta desactivado por defecto. Para habilitar las notificaciones usa
`iniciar-preproduccion.ps1 -Firebase`: detecta una cuenta de servicio en
`backend/storage/app/firebase` cuyo proyecto coincida con la app Android, y la
monta solo para lectura, fuera de la imagen. La seleccion persiste en el archivo
local `.env.preproduccion`. Usa solamente dispositivos y cuentas de prueba en
este entorno. Maps conserva la clave local existente, si esta
configurada. Este entorno local no mide latencia de internet, DNS publico,
capacidad del hosting ni entrega real de correo.

## Consultar y detener

```powershell
docker compose --env-file .env.preproduccion -f compose.preproduccion.yaml ps
docker compose --env-file .env.preproduccion -f compose.preproduccion.yaml logs --tail 100 app queue scheduler
powershell -ExecutionPolicy Bypass -File .\detener-preproduccion.ps1
```

No uses `down -v` salvo que quieras borrar todos los datos y la CA del entorno.
Si eliminas la CA, tendras que volver a compilar la APK. Los secretos,
certificados generados y APK quedan fuera de Git. Las imagenes incluyen el
codigo; vuelve a ejecutar el arranque para reconstruir tras cambiar el backend.

## Verificacion realizada el 6 de noviembre de 2026

- Docker Desktop instalado y motor operativo con WSL 2.
- 304 pruebas Laravel aprobadas en SQLite y 304 en MySQL, con 1307
  comprobaciones en cada motor.
- 154 pruebas React Native aprobadas; TypeScript y ESLint de los archivos
  modificados sin errores.
- Registro, login, catalogo, dashboard, correo de recuperacion, trabajador de
  cola, logout, revocacion del token y eliminacion de cuenta probados por HTTPS.
- Tareas programadas ejecutandose; ningun trabajo fallido en la cola.
- APK staging x86_64 compilada con las comprobaciones de Android habilitadas,
  instalada en el emulador Cliente y conectada a Docker sin Metro.
- Notificacion real aceptada por Firebase y recibida en el emulador.
- Corregida una diferencia entre MySQL y SQLite: la busqueda de atributos JSON
  ahora encuentra `Gripa` al consultar `gripa`, tanto en productos como negocios.

La APK entregada en `artifacts/vitrina-preproduccion.apk` es para el emulador
x86_64. El script de compilacion sin `-Architectures` genera tambien arm64-v8a
para telefonos. Evidencias locales: `artifacts/staging-conectada.png`,
`artifacts/staging-notificacion.png` y `artifacts/firebase-prueba.txt`.
