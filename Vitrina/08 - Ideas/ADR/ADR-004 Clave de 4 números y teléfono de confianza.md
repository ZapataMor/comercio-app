---
title: ADR-004 Clave de 4 números y teléfono de confianza
tags: [adr]
id: ADR-004
estado: aceptado
decididores: [Luis]
fecha: 2026-11-21
afecta_a: [autenticación, app móvil, backend, web pública]
actualizado: 2026-11-21
---

# ADR-004 — Clave de 4 números y teléfono de confianza

> Las cuentas entran con el celular (o Google) y una clave de 4 números, como Nequi. En un
> teléfono nuevo se pide además un código de WhatsApp, una sola vez.

| | |
|---|---|
| **Estado** | aceptado (construido el 2026-11-21) |
| **Fecha** | 2026-11-21 |
| **Decididores** | Luis |

## Contexto
Hasta ahora se entraba con correo, celular o usuario y una contraseña de 5 caracteres, y se
recuperaba por correo (que nunca se enviaba de verdad: `MAIL_MAILER=log`) o por WhatsApp. Se
quería algo tan simple como Nequi: escribir el número, recibir un código para registrarse o
recuperar, y entrar con una clave corta.

Una clave de 4 números solo tiene 10.000 combinaciones, y en Vitrina el celular del cliente **no
es secreto**: lo ven el negocio y el domiciliario. Con número y clave desde cualquier teléfono,
cualquiera podría probar 1234, 0000 o el año de nacimiento.

## Decisión
1. **Dos pasos distintos**: probar *quién eres* una vez por teléfono (código de WhatsApp o
   Google) y probar *que eres tú quien lo usa* cada vez (la clave).
2. **Clave de 4 números** obligatoria para toda cuenta: se crea al registrarse (con el celular o
   con Google); las cuentas de antes la crean al entrar («Crea tu clave»). No se aceptan claves
   fáciles (repetidas, seguidas, pares como 1212, las más usadas).
3. **Teléfono de confianza**: en un teléfono donde ya se demostró quién es, basta celular y
   clave (o «Continuar como» y clave, también para cuentas de Google sin celular). En uno nuevo,
   tras acertar la clave llega un código por WhatsApp. Vence a los 180 días sin usarse.
4. **Bloqueo** a los 5 intentos fallidos seguidos (contando acciones que piden la clave). Se
   desbloquea creando una nueva con «¿Olvidaste tu clave?» (código de WhatsApp o Google).
5. **Sin nombre de usuario**: quien se registró con Google entra con el botón de Google y su clave.
6. **Correo y celular opcionales** al terminar el registro («Completa tu cuenta»): al registrado
   con WhatsApp se le ofrece «Conectar con Google» (correo confirmado y otra forma de entrar) o
   escribir el correo; al registrado con Google, verificar su celular.
7. **Piden la clave**: cambiar el celular verificado, desconectar Google (además exige el celular
   verificado), eliminar la cuenta (app y web) y crear, editar o borrar cuentas de pago del negocio.
8. **Ya no se recupera por correo** (el escrito a mano no se confirma).
9. **Cuentas de antes**: entran con su contraseña mientras no tengan clave, o si no tienen celular
   verificado ni Google. El **panel web de administración** sigue con contraseña.

## Consecuencias
- ✅ Entrar es tan simple como en Nequi, sin regalar la cuenta a quien conoce el número.
- ✅ Cada mensaje de WhatsApp se gasta solo por teléfono nuevo, no por cada entrada.
- ⚠️ Quien conoce el número puede bloquear la clave de otro con 5 intentos; el dueño la desbloquea
  con el código de WhatsApp. Si se vuelve un problema, sumar una espera progresiva antes del bloqueo.
- ⚠️ Quien se registró solo con WhatsApp y pierde su número, sin Google conectado, solo recupera la
  cuenta por soporte: por eso se invita a conectar Google.

## Dónde está
- Backend: `App\Support\ClavePin`, `App\Rules\ClaveCuatro`, `AuthController::login` y
  `confirmarCodigo`, `ClaveController`, tabla `dispositivos_confianza`.
- App: `CampoPin`, `PedirClave`, `CrearClaveScreen`, `CompletarCuentaScreen`, la `fase` de `App.tsx`
  y los `dispositivos` de `AuthContext`.

## Conecta con
- [[_MOC ADR]] · [[ADR-001 Inicio de sesión con Google]] · [[Estado Actual]]
