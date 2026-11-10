Validaciones y solicitudes
=========================

- Teléfonos: exactamente diez dígitos ASCII, empezando por 3. Los campos opcionales siguen siendo opcionales; cuando se completan, se aplica la misma regla. La app filtra el texto pegado y el servidor valida de nuevo.
- Direcciones: Calle, Carrera y Número de la casa. Se exige al menos una vía y el número. Se guarda el texto compuesto en la columna existente para conservar la compatibilidad con pedidos, mapas y direcciones anteriores. Las direcciones antiguas incompletas deben completarse al editarlas; no se inventan números.
- Contraseñas: mínimo cinco caracteres, sin requisitos de mayúsculas, dígitos o símbolos. Se aplica a registro, administración, perfil y recuperación.
- Productos: creación y edición exigen precio positivo. El modelo también impide guardar precios cero o negativos. Los registros antiguos con esos precios quedan excluidos del catálogo y de nuevos pedidos hasta corregirlos; sus importes históricos no se modifican.

Límites compartidos mediante la caché del servidor:

- 120 solicitudes por minuto por usuario, compartidas entre sus sesiones y rutas.
- Dentro de ese total, máximo 40 escrituras por minuto por usuario.
- 300 solicitudes por minuto por IP, incluidas las rutas públicas y los intentos con distintos correos.
- Se conservan los límites más estrictos de acceso, recuperación, códigos de pedidos y GPS.
- Las respuestas 429 de Laravel incluyen mensaje en español y `Retry-After`.

La app espera hasta 20 segundos, incluyendo la descarga del cuerpo, y cancela la solicitud local al agotarse ese plazo. Muestra un aviso aunque el consumidor silencie errores de actualizaciones en segundo plano. NetInfo detecta pérdida y recuperación de internet; mientras falta conexión aparece un icono y un mensaje persistente. No se reenvían automáticamente escrituras desde la capa de red. Un timeout no revierte una operación que el servidor ya haya procesado.

En Docker, nginx limita ráfagas a 10 solicitudes por segundo e IP con margen de 30, limita las esperas y PHP-FPM termina solicitudes a los 30 segundos. Solo Caddy debe exponerse al exterior: nginx confía en `X-Forwarded-For` recibido desde las redes privadas del proxy. Si se cambia la topología, deben ajustarse los proxies confiables y mantenerse cerrado el puerto de nginx al público. Los contadores de Laravel deben usar una caché compartida entre réplicas; la configuración actual usa base de datos.

Aplicación: recompilar el binario móvil por la nueva dependencia nativa NetInfo (en iOS también instalar los pods) y reconstruir las imágenes Docker para activar la configuración de nginx y PHP-FPM. No se requieren migraciones nuevas para estas validaciones.
