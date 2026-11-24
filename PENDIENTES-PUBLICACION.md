# Pendientes antes de publicar en Play Store y App Store

Revisión del 13 de noviembre de 2026. Se deja para después: por ahora se sigue
con funcionalidades de la app. Complementa a [DESPLIEGUE.md](DESPLIEGUE.md) y a
[REVISION-PRODUCTO.md](REVISION-PRODUCTO.md).

Ya resuelto desde la revisión del 6 de noviembre (no volver a hacerlo): total
reconfirmado si cambia (`total_cambio`), checkout bloqueado sin tarifa, pedidos
sin duplicar (`clave_intento`), faltantes y devoluciones, pedidos en curso del
admin, límites de peticiones, eliminar cuenta desde la app y `codigo_prueba`
solo en local.

## 1. Bloquean la publicación

### Ambas tiendas
- [ ] **Cuenta para los revisores**: Google y Apple no pueden recibir el código
      de WhatsApp. Crear en producción una cuenta con el celular ya verificado
      que entre con contraseña, y darla en "Acceso a la app" (Play) y en las
      notas de revisión (Apple).
- [ ] **Contenido real en producción**: negocios reales con productos (no los
      demo). Una app vacía la rechaza Apple (guía 2.1).
- [ ] **Valores de desarrollo** en `frontend/src/config.ts`:
      `API_URL_PRODUCCION` (hoy `api.vitrina.example`), `EN_VIVO_KEY` (hoy
      `vitrina-local`, debe ser igual a `REVERB_APP_KEY` de producción) y
      `SENTRY_DSN` (vacío).
- [ ] **Servidor de producción** con dominio, HTTPS, cola, cron y Reverb
      (DESPLIEGUE.md §2–3).
- [ ] **Aceptar los términos en el registro**: la página `/terminos` ya existe
      (23 de noviembre de 2026); falta que el registro de la app los haga aceptar
      junto con la política de privacidad.

### Google Play
- [ ] **Prueba cerrada obligatoria**: las cuentas personales nuevas necesitan
      12 personas probando 14 días seguidos antes de producción. Es lo más lento:
      empezarla apenas se cree la cuenta.
- [ ] **`applicationId` definitivo** (hoy `com.comercioapp` en
      `frontend/android/app/build.gradle`). No se cambia tras publicar; si cambia,
      registrar de nuevo la app en Firebase y reemplazar `google-services.json`.
- [ ] Llave de subida (DESPLIEGUE.md §4.2) y ficha: capturas, gráfico destacado,
      clasificación de contenido, seguridad de los datos (texto en §4.4).

### App Store (lo que más falta)
- [ ] **iOS nunca se ha compilado** desde el cambio a MapLibre. Hace falta Mac
      con Xcode, cuenta Apple Developer (USD 99/año) y prueba en un iPhone.
- [ ] **Identificador y nombre**: `PRODUCT_BUNDLE_IDENTIFIER` sigue siendo el de
      la plantilla (`org.reactjs.native.example…`) y `CFBundleDisplayName` dice
      "ComercioApp" en vez de Vitrina.
- [ ] **Push en iOS sin configurar**: falta `GoogleService-Info.plist`,
      `FirebaseApp.configure()` en `AppDelegate.swift`, la capacidad Push
      Notifications (entitlements), `UIBackgroundModes` → `remote-notification`
      y la llave APNs en Firebase.
- [ ] **Alarma de pedidos en iPhone**: iOS no repite sonidos de notificación ni
      admite más de 30 s; hay que definir cómo avisa al negocio allá.
- [ ] **`PrivacyInfo.xcprivacy`** no declara datos recogidos (nombre, teléfono,
      ubicación, dirección, identificadores de push, diagnósticos).
- [ ] **Explorar sin cuenta**: hoy todo el catálogo exige sesión (`App.tsx`).
      Apple suele rechazarlo (guía 5.1.1). Dejar explorar y pedir la cuenta al
      comprar.
- [ ] **Bloquear usuarios**: por las reseñas (contenido de usuarios) Apple pide
      reportar *y* bloquear; reportar ya existe, bloquear no.

## 2. No bloquean la tienda, pero van antes de operar con gente real
- [x] **Transferencia sin verificar** (resuelto el 20 de noviembre de 2026): el
      cliente ve las cuentas del negocio al ser aceptado, avisa «Ya pagué» y el
      negocio confirma que le llegó; sin eso no se marca listo y el domiciliario
      solo ve «No cobrar» con el pago confirmado. La devolución de un pedido
      cancelado ya tiene estados (solicitada → devuelta → recibida, no
      recibida o rechazada), desde el 21 de noviembre.
- [ ] **Botón de ayuda** en el pedido hacia un soporte de Vitrina (puede ser un
      WhatsApp atendido por una persona).
- [ ] **Aprobación de domiciliarios**: hoy cualquier cliente se activa solo
      (`AuthController::hacerseDomiciliario`).
- [ ] **Copias de seguridad automáticas** de la base y de las fotos, con una
      restauración probada.
- [ ] **Dependencias**: probar el APK release tras la subida del CLI/Metro y
      volver a correr `composer audit` y `npm audit`.
- [ ] **DESPLIEGUE.md desactualizado**: aún describe recuperar la contraseña por
      correo SMTP; ahora es por WhatsApp y el correo es opcional.
- [ ] **Token en AsyncStorage**: pasarlo al almacenamiento protegido del sistema
      (preventivo).

## 3. WhatsApp
- [ ] Que Meta apruebe la plantilla `codigo_vitrina` y verificar el negocio en
      Meta; luego `WHATSAPP_DRIVER=cloud`, `config:clear`, `whatsapp:probar`.
- [ ] Número propio para producción (no el de prueba +1 555).
- [ ] Enviar por WhatsApp los códigos de recogida y entrega de pedidos.

## Orden sugerido
1. Crear la cuenta de Play y arrancar la prueba cerrada de 14 días.
2. En paralelo, los cambios de código: términos, explorar sin cuenta, bloquear
   usuarios, transferencia (o solo efectivo), botón de ayuda, `applicationId` y
   nombre/identificador de iOS.
3. iOS completo cuando haya acceso a una Mac.
