---
title: Configurar WhatsApp Cloud API
tags: [referencia]
estado: pendiente
actualizado: 2026-11-11
---

# 💬 Configurar WhatsApp Cloud API

> Los códigos para **registrarse, entrar y recuperar la contraseña con el celular** llegan por
> WhatsApp. El código de la app ya está hecho. Mientras no haya cuenta de Meta funciona en
> **modo prueba**: el código no se envía, se escribe en `backend/storage/logs/laravel.log` y la app
> lo muestra en un recuadro "Modo prueba". Esta guía es para pasar al envío real.

## Qué ya funciona (sin Meta)

- **Registro**: primero se confirma el celular con el código; después se llenan los datos. El
  correo es opcional.
- **Login**: un solo campo acepta correo, celular (con o sin +57) o nombre de usuario. El celular
  solo sirve si está verificado.
- **Olvidé mi contraseña**: si se escribe un celular verificado, el código llega por WhatsApp; si
  se escribe un correo, por correo como antes.
- **Mi información**: muestra si el celular está verificado y permite verificarlo. Cambiar el
  número a mano le quita la verificación.
- Protección del gasto: 60 s entre envíos, máximo 5 códigos por número por hora y 10 por día, y 20
  por IP por hora. Cada código vence a los 10 minutos y se anula tras 5 intentos fallidos.

## Lo que necesitas hacer en Meta

1. **Portafolio comercial (Meta Business)**: entra a `business.facebook.com` con tu cuenta de
   Facebook y crea el portafolio de Vitrina.
2. **App de desarrollador**: en `developers.facebook.com` → *Mis apps* → *Crear app*. Elige el
   caso de uso de **WhatsApp** (conectar con clientes por WhatsApp) y vincúlala al portafolio.
3. **Probar ya con el número de prueba** (opcional, gratis): en *WhatsApp → Configuración de la
   API* Meta da un número de prueba y un token temporal (dura unas 24 h). Agrega tu celular como
   destinatario (hasta 5 números). Sirve para probar antes de tener el número dedicado.
4. **Número dedicado**: en la misma pantalla, *Agregar número de teléfono*. Pon el nombre visible
   ("Vitrina"), la categoría y verifica el número con el código por SMS o llamada.
   - El número **no puede estar en WhatsApp** ni en WhatsApp Business. Si lo estuvo, borra esa
     cuenta desde la app antes.
5. **Método de pago**: en el Administrador de WhatsApp → *Configuración de pagos*, agrega una
   tarjeta. Los mensajes de autenticación se cobran (en 2026, unos USD 0,0008 por mensaje en
   Colombia; confirma la tarifa en la tabla oficial de Meta).
6. **Plantilla del código**: Administrador de WhatsApp → *Plantillas de mensajes* → *Crear
   plantilla*:
   - Categoría: **Autenticación**.
   - Nombre: **`codigo_vitrina`** (si usas otro, cámbialo en `WHATSAPP_PLANTILLA_CODIGO`).
   - Idioma: **Español** (`es`).
   - Entrega del código: **Copiar código**.
   - Opcional: marca "Agregar recomendación de seguridad" y "Vencimiento del código: 10 minutos".
   - Envíala y espera la aprobación (suele tardar minutos).
7. **Token permanente**: *Configuración del negocio* → *Usuarios del sistema* → *Agregar* (rol
   administrador). Asígnale la app y la cuenta de WhatsApp con control total. Luego *Generar
   token*: elige la app, caducidad **Nunca** y los permisos `whatsapp_business_messaging` y
   `whatsapp_business_management`. Cópialo: Meta no lo vuelve a mostrar.
8. **Identificador del número**: en *WhatsApp → Configuración de la API* copia el
   **Identificador del número de teléfono** (Phone number ID). Es un número largo; **no** es el
   número de celular.

> Verificar la empresa no es obligatorio para empezar. Hasta verificarla, Meta limita cuántas
> personas distintas pueden recibir mensajes al día; para el piloto alcanza.

## Conectar el backend

En `backend/.env` (nunca en `.env.example`: el token es secreto):

```
WHATSAPP_DRIVER=cloud
WHATSAPP_TOKEN=el-token-permanente
WHATSAPP_PHONE_NUMBER_ID=el-identificador-del-numero
WHATSAPP_PLANTILLA_CODIGO=codigo_vitrina
WHATSAPP_PLANTILLA_IDIOMA=es
```

Luego, en `backend/`:

```
php artisan config:clear
php artisan whatsapp:probar 3001234567
```

Con tu celular en vez de `3001234567`. Te debe llegar un WhatsApp con el código **123456**. Si
llega, ya funciona en la app y el recuadro "Modo prueba" deja de salir.

## Si falla

`whatsapp:probar` muestra el error de Meta:

| Error de Meta | Qué significa |
|---|---|
| `(código 190)` | El token venció o está mal copiado. Genera el token permanente (paso 7). |
| `(código 132001)` | La plantilla no existe con ese nombre e idioma, o aún no está aprobada. |
| `(código 131030)` | Con el número de prueba: tu celular no está en la lista de destinatarios (paso 3). |
| `(código 131042)` | Falta el método de pago (paso 5). |

En la app, si WhatsApp falla, la persona ve "No pudimos enviarte el código por WhatsApp" y el
error queda en el log.

## Cómo está hecho

- `app/Support/Telefono/CodigosTelefono.php`: crea, envía y revisa los códigos.
- `app/Support/Telefono/EnviadorWhatsApp.php`: la llamada a Meta. `EnviadorLog.php`: el modo prueba.
  Un canal de SMS se agregaría como otra clase que implemente `EnviadorCodigos`.
- `app/Http/Controllers/Api/TelefonoController.php`: registro y Mi información.
- Pruebas: `backend/tests/Feature/AccesoTelefonoTest.php` y `frontend/__tests__/AccesoTelefono.test.tsx`.
