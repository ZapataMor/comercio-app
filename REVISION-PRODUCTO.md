# Revisión funcional y operativa de Vitrina

Fecha: 6 de noviembre de 2026. Proyecto: `C:/dev/comercio-app`.

## Conclusión

Vitrina tiene una base amplia para un piloto supervisado de comercio local en
Maicao. El ciclo principal está implementado: descubrir, elegir, pedir, aceptar,
preparar, recoger, entregar y valorar. La prioridad para mejorar la satisfacción
es cerrar los problemas que una persona puede encontrar entre esos pasos:
pagos ambiguos, totales que cambian, entregas detenidas, falta de ayuda,
conectividad irregular y disponibilidad de repartidores.

La satisfacción no se puede certificar leyendo el código. Las prioridades de
producto de este documento son hipótesis que deben contrastarse con clientes,
negocios y domiciliarios reales.

### Alcance y nivel de evidencia

Se revisaron rutas, modelos, controladores principales, navegación, pantallas,
componentes de pedidos, sesión, carrito, ubicación, documentación y despliegue.
Se incorporaron las pruebas funcionales y de carga realizadas en esta sesión.
No se ejecutó una nueva auditoría de seguridad ni una prueba nueva de todas las
pantallas en teléfonos físicos. Tampoco se inspeccionaron cuentas externas de
hosting, mapas, correo o tiendas de aplicaciones.

Se distingue entre **implementado**, **brecha comprobable en el código**,
**mejora recomendada** y **servicio externo pendiente de confirmar**. Las notas
históricas de UX y algunos contadores de pruebas están desactualizados; no se
tomaron sus pendientes como prueba de que una función siga faltando.

## 1. Lo que ya está construido

| Área | Capacidades presentes |
|---|---|
| Cuenta | Registro, recuperación por correo, sesión persistente, edición de perfil, cambio de contraseña, suspensión y eliminación de cuenta. |
| Cliente | Exploración por categorías, búsqueda de negocios y productos, abiertos/cerrados, catálogo, detalle, carrito persistente por cuenta y direcciones guardadas. |
| Pedido | Personalización de ingredientes, tallas y colores; total calculado en servidor; estados, cancelación, códigos de recogida y entrega, historial y contacto por llamada/WhatsApp. |
| Negocio | Catálogo, categorías, imágenes, disponibilidad, horarios semanales/festivos, apertura manual, confirmación de cierre, pedidos, ventas de hoy y varios negocios por usuario. |
| Equipo | Invitaciones, aceptación/rechazo, propietarios y trabajadores, selección de negocio activo. |
| Domiciliario | Turno, ofertas, tomar y soltar antes de recoger, novedades, recogida/entrega con código, historial, contacto y apertura de navegación externa. |
| Confianza | Reputación, reseñas públicas, respuesta del negocio, reportes y moderación. |
| Administración | Usuarios, roles, suspensiones, negocios, barrios, tarifa, reputación y moderación de reseñas. |
| Servicios preparados | Firebase/Notifee, mapas, integración Sentry, cola, programador, Docker, HTTPS local y pruebas reproducibles. |

Estas funciones no deben volver a aparecer como si hubiera que construirlas
desde cero. Varias necesitan ajustes operativos o validación real.

## 2. Prioridad inmediata: confianza y pedidos que puedan terminar

**P0** significa resolver antes de abrir el servicio al público sin supervisión.
Un piloto pequeño puede utilizar los procedimientos manuales indicados.

### P0-1. Separar «elegí transferencia» de «el pago fue verificado»

**Brecha comprobable.** El checkout ofrece transferencia. El servidor asigna
cero a cobrar si el método no es efectivo y el domiciliario ve «Pagado por
transferencia: no cobres nada». En el flujo revisado no hay un estado de pago
independiente, confirmación de recepción, comprobante ni validación de pasarela.
Elegir el método no demuestra que el dinero haya llegado.

Hace falta definir destinatario, datos para pagar, referencia del pedido,
importe, confirmación, responsable de verificar y resolución de diferencias.
También falta un tratamiento coherente de devoluciones: el detalle cancelado
afirma «No se te cobra nada», lo que no resuelve una transferencia ya realizada.

**Mínimo para el piloto:** operar solo con efectivo, o incorporar verificación
manual explícita de la transferencia por el negocio. La app debe distinguir
pendiente, confirmado y devolución pendiente. Una pasarela automática puede
incorporarse después; el flujo de pago claro es necesario desde el principio.

### P0-2. Confirmar el precio y el domicilio realmente aceptados

**Brecha comprobable.** El carrito conserva precios locales y el servidor
recalcula con precios actuales. Eso protege el cálculo del servidor, pero no
solicita una nueva aceptación si el importe aumentó. Si falla la carga de la
tarifa, el checkout utiliza cero para presentar el total y permite confirmar.

Hace falta una cotización previa con productos, extras, domicilio y total.
Si hay cambios, el cliente debe aceptarlos antes de crear el pedido. Si no se
conoce la tarifa, debe mostrarse un error recuperable y evitar confirmar un
importe incompleto. No conviene anunciar extras con costo hasta representarlos
y cobrarlos explícitamente.

**Criterio:** lo que acepta el cliente coincide con lo registrado en el pedido.

### P0-3. Evitar pedidos duplicados ante cortes de red

**Brecha comprobable en el diseño revisado.** Se deshabilita el botón mientras
se envía, pero no encontré una clave de idempotencia ni deduplicación del intento
de compra en el servidor. Si el servidor crea el pedido y se pierde la respuesta,
el usuario puede reintentar y crear otro. No se ha reproducido aquí ese corte
de red; el riesgo se deriva del flujo de creación.

Hace falta identificar cada intento de compra y devolver el mismo pedido al
reintentar. La interfaz debe poder decir «Estamos comprobando si se creó» y
recuperar el resultado. Un indicador de carga en el botón no cubre ese caso.

### P0-4. Soporte y resolución de pedidos atascados

**Brecha comprobable.** Existe vencimiento automático de pedidos pendientes y
hay cancelaciones/novedades. No encontré un flujo integral de incidencia y
resolución para todos los estados. La propia documentación reconoce el caso
de cliente ausente o que no da el código: el pedido puede quedar `en_camino`.
El administrador modera usuarios y reputación, pero no dispone de una mesa
completa de pedidos/incidencias con cierre justificado y trazabilidad.

Hay que resolver al menos:

- negocio que aceptó y deja de responder;
- pedido listo sin domiciliario;
- domiciliario que no puede continuar después de recoger;
- cliente ausente, dirección incorrecta o código que no se puede obtener;
- entrega incompleta, producto agotado, cobro discutido o devolución;
- desacuerdo sobre cancelación y sobre quién asume el costo.

**Mínimo para el piloto:** botón de ayuda con número de pedido, canal de soporte
atendido, responsable y horario de atención, procedimiento de escalamiento y
registro del motivo/resultado. Puede empezar con WhatsApp y una operación
manual controlada. Llamar a los participantes ya existe, pero no sustituye al
responsable de resolver una incidencia.

### P0-5. Cobertura y disponibilidad real de reparto

**Brecha de producto y operación.** Los barrios funcionan como catálogo y
sugerencias, no como reglas completas de cobertura. La tarifa es global. El
negocio abierto puede recibir pedidos sin que eso garantice un repartidor
disponible para esa zona, horario o trayecto.

Definir zonas atendidas, horario, costos, tiempo de búsqueda de domiciliario y
qué se hace cuando nadie toma el pedido. Mostrar esa información antes de
confirmar. Debe quedar claro quién recibe la tarifa y cómo se liquida.

**Mínimo para el piloto:** pocos negocios y zonas conocidas, domiciliarios
confirmados por turno y una persona que pueda resolver falta de reparto. Una
tarifa única es viable si la cobertura acotada hace que sea sostenible.

### P0-6. Validar seguimiento y alarmas en el uso real del domiciliario

**Implementado parcialmente respecto a una promesa de seguimiento continuo.**
El GPS se detiene cuando la app pasa a segundo plano. Al abrir Google Maps o
bloquear el teléfono no seguirá enviando posiciones. El servidor distingue
posiciones antiguas y limita su vigencia, lo cual es una protección útil, pero
no convierte el seguimiento en continuo.

Definir la promesa: ubicación mientras está abierta, con antigüedad visible,
o seguimiento durante una entrega compatible con navegación externa y pantalla
bloqueada. La segunda opción requiere trabajo específico de plataforma,
permisos, consumo de batería y validación en dispositivos reales.

Firebase se probó en el emulador. Falta ensayar alarmas y recepción con pantalla
bloqueada, ahorro de batería, permisos denegados, pérdida de datos y distintas
marcas de teléfonos. El negocio necesita enterarse del pedido aunque esté
ocupado; ese es un requisito operativo del servicio.

### P0-7. Preparar una versión pública y sus servicios reales

**Pendiente comprobable o por confirmar externamente.** El dominio de producción
sigue siendo de ejemplo y Sentry de la app tiene el DSN vacío. El login conserva
correo y contraseña demo prellenados y una leyenda demo sin condición de
desarrollo. Deben retirarse de la versión pública. Las cuentas/seeders demo
también deben quedar fuera de la base de producción.

Completar hosting, HTTPS público, correo real, configuración de Firebase/mapas,
firma de distribución, publicación y datos de contacto. Verificar el paquete
release final en un teléfono real contra ese servidor. La variante staging y
el certificado local sirven para ensayo, no son la entrega pública.

## 3. Comodidad y repetición de compra: siguiente prioridad

| Mejora | Estado observado y beneficio | Prioridad |
|---|---|---|
| Explorar antes de registrarse | Las rutas del catálogo requieren sesión. Permitir ver valor primero y solicitar cuenta al comprar reduce fricción; hoy el registro pide muchos datos antes de explorar. | Alta para captación. |
| Direcciones completas | Ya hay direcciones guardadas y edición de la principal desde perfil. Faltan gestión de las adicionales, alias Casa/Trabajo, edición/borrado, referencias y pin del cliente. Ayuda a evitar llamadas y entregas fallidas. | Alta. |
| Incertidumbre de entrega | Ya hay preparación estimada, estados, novedad y minutos de recogida. Añadir una expectativa de entrega comprensible y alertas de demora, sin prometer precisión que no se pueda cumplir. | Alta. |
| Conexión inestable | Ya persiste el carrito. No encontré una gestión general de conectividad ni tiempos límite de fetch. Añadir reintento seguro, mensajes claros y conservación del contexto; no enviar una compra nueva a ciegas. | Alta. |
| Activación de negocios | Ya existen catálogo, horarios y equipos. Añadir una guía breve para completar negocio, ubicación, horario y primeros productos. Hacer más descubrible abrir/cerrar: hoy depende de mantener presionada la tienda. | Alta para el piloto. |
| Productos agotados y sustituciones | Ya hay disponibilidad booleana. Falta un acuerdo cuando un artículo se agota después de pedir: sustitución aprobada, ajuste de total o cancelación parcial. Stock numérico depende del tipo de comercio. | Alta si ocurre con frecuencia. |
| Cantidades fraccionadas | Se muestra venta por kg/litro/metro, pero cantidad se valida como entero y el selector suma unidades. No permite naturalmente 0,5 kg o 1,5 m. Añadir decimales con reglas o vender presentaciones fijas explícitas. | Alta si entran fruterías, carnicerías o ferreterías. |
| Repetir y guardar | Hay historial y recetas preferidas. Añadir repetir un pedido completo y favoritos, revalidando productos, precio, opciones y disponibilidad. | Media, útil para retención. |
| Confianza al incorporar repartidores | Hoy un cliente con teléfono puede activar el rol. Definir aprobación/onboarding y comprobar contacto e identidad con el mínimo de datos necesario. No confundir reputación posterior con verificación inicial. | Alta al abrir el registro público; manual en piloto. |
| Gestión comercial | Hay ventas de hoy e historial. Añadir rangos de fechas, saldos/conciliación, exportación y resumen de ganancias del domiciliario. Aprovechar la confirmación de efectivo existente. | Media. |
| Accesibilidad y dispositivos modestos | Existen etiquetas y componentes accesibles en varias partes. Falta evidencia de prueba sistemática con TalkBack, texto grande, contraste, teclado, movimiento reducido y Android de pocos recursos. | Alta como validación; corregir lo que aparezca. |
| Protección de cuentas | El token se guarda con la sesión en AsyncStorage. Migrarlo a almacenamiento protegido del sistema, definir verificación de contacto y reforzar acceso administrativo. Es una recomendación preventiva, no una intrusión demostrada. | Alta antes de una apertura amplia. |

La ubicación por cercanía, filtros adicionales y tolerancia a errores de
escritura pueden mejorar la exploración después de confirmar qué buscan las
personas. La búsqueda y las categorías ya existen.

## 4. Servicios necesarios para operar

| Servicio o proceso | Situación conocida | Qué falta comprobar o completar |
|---|---|---|
| Servidor/API/BD | Docker local y pruebas disponibles. | Infraestructura definitiva, capacidad, despliegue repetible y retorno a una versión anterior. |
| Dominio y HTTPS | HTTPS local verificado. | Dominio público, certificado y configuración final de la app. |
| Correo | Recuperación funciona con Mailpit. | Proveedor real, remitente propio, entrega a bandejas reales, manejo de fallos y supervisión. |
| Notificaciones | FCM y Notifee integrados; notificación real recibida en emulador. | Configuración de distribución y matriz de teléfonos/estados de batería/permisos. |
| Mapas | Integración y componentes presentes. | Confirmar habilitación, claves de la app distribuida, restricciones, cuota y funcionamiento visible en teléfono real. No se verificó la consola del proveedor. |
| Cola y programador | Funcionan en Docker. | Supervisión permanente, alertas de caída, trabajos fallidos y recuperación en producción. |
| Errores y disponibilidad | Integración Sentry presente, app desactivada sin DSN. | Activar y probar reporte, alertas atendidas y comprobaciones externas de disponibilidad. |
| Imágenes | Archivos en almacenamiento local del servidor; validaciones de subida existentes. | Compresión/tamaños adecuados, copias y recuperación. Almacenamiento externo/CDN puede añadirse según volumen. |
| Copias de seguridad | Hay un pendiente documentado; no se encontró aquí una rutina probada. | Copias automáticas fuera del servidor, retención y restauración ensayada **antes** de recibir datos reales. |
| Soporte y despacho | Contacto entre participantes presente. | Canal de plataforma, operador, horarios y resolución documentada. Es trabajo humano además de software. |
| Pagos y conciliación | Efectivo y elección de transferencia. | Verificación, responsables, estados y devoluciones. Pasarela si después se decide automatizar. |
| Medición de producto | Admin muestra conteos y Sentry detecta errores técnicos. | Embudo, cancelaciones por causa, aceptación/reparto/entrega, recurrencia y motivos de abandono. |
| Distribución y documentos | Guía de despliegue y páginas públicas presentes. | Firma definitiva, publicación, revisión de textos/datos del responsable y condiciones operativas. La necesidad y prioridad de iOS dependen del público; no se validó iPhone. |

Los servicios externos quedan **por confirmar**, no declarados inexistentes:
esta revisión no tuvo acceso a esas cuentas. No hace falta contratar todos los
proveedores posibles para un piloto; sí cubrir cada responsabilidad.

## 5. Capacidad y rendimiento

Las pruebas locales anteriores no certifican cualquier servidor. Con el perfil
de PHP 2 CPU/512 MiB y MySQL 2 CPU/1 GiB, 200 usuarios en la mezcla ensayada
pasaron una meseta de tres minutos, p95 de 265 ms. Con 300 subió a 1,60 s y con
1000 a 10,19 s. El refresco a tasa fija tampoco completó toda la carga prevista.

Antes de una apertura masiva: medir y reducir consultas periódicas, revisar CPU
y procesos FPM, conservar margen, y repetir con el hosting definitivo y un
generador externo. No basta con aumentar el número de procesos si la CPU ya
está saturada. No se ha probado resistencia de varias horas ni toda la carga
combinada de imágenes, GPS y notificaciones.

Ver [mediciones y metodología](C:/dev/comercio-app/PRUEBAS-CARGA.md).

## 6. Funciones que pueden esperar

- Chat propio: el contacto por llamada/WhatsApp ya cubre coordinación básica.
- Pasarela de pago: puede esperar si el piloto usa efectivo o transferencia
  verificada con un procedimiento claro.
- Login con Google: reduce fricción, pero no resuelve pedidos ni entregas.
- Cupones, puntos, recomendaciones con IA y búsqueda semántica: validar antes
  el servicio base y la recurrencia.
- Carrito de varios negocios y optimización de rutas múltiples: agregan mucha
  complejidad de cobros, tiempos y reparto.
- Suscripciones, publicidad y automatización financiera avanzada: definir
  primero el modelo de ingresos y la operación real.

Si el público objetivo necesita iOS desde el comienzo, cambia su prioridad;
el piloto documentado del proyecto está centrado en Android.

## 7. Orden recomendado de trabajo

1. **Compra confiable:** pago, total confirmado y reintentos sin duplicados.
2. **Entrega resoluble:** cobertura, turnos, incidencias, ayuda y responsable
   de resolver excepciones; probar GPS/alarma en teléfonos reales.
3. **Operación protegida:** servicios de producción, copias/restauración,
   alertas, versión sin demo y control del alta de participantes.
4. **Piloto supervisado:** pocos negocios y domiciliarios confirmados; clientes
   reales que reciban pedidos reales, con soporte disponible.
5. **Comodidad y recurrencia:** direcciones, exploración sin registro, repetir
   compra, agotados y mejoras que los participantes realmente necesiten.
6. **Ampliación:** corregir los problemas observados y repetir carga antes de
   sumar zonas, usuarios o nuevas categorías de comercio.

No se propone una fecha cerrada sin estimar el trabajo y conocer el equipo.
La expansión de funciones debe seguir los problemas del piloto.

## 8. Cómo saber si las personas se sienten cómodas

Propuesta de validación, todavía no ejecutada con usuarios reales:

- Cliente nuevo: encuentra un producto, entiende el total y pide sin que alguien
  le explique la interfaz. Sabe cómo consultar estado y pedir ayuda.
- Negocio nuevo: publica algunos productos, entiende abierto/cerrado y recibe
  el aviso con el teléfono bloqueado; acepta o rechaza sin perder el pedido.
- Domiciliario: comprende qué cobra, cómo llega, cómo entrega y qué hacer ante
  un problema; se ensaya alternar con la app de navegación.
- Fallo de red intencional: una compra creada cuya respuesta se pierde no se
  duplica al reintentar. El carrito y el contexto no desaparecen.
- Cambio de precio/tarifa: la app pide aceptación; no cambia silenciosamente
  el total. Una transferencia no verificada no aparece como pagada.
- Incidencia: falta de repartidor, cliente ausente, código imposible y producto
  agotado tienen un responsable y una salida registrada.
- Operación: se restaura una copia en un entorno aislado y se verifica que una
  alerta de error/cola detenida llegue a una persona responsable.

Registrar éxito sin ayuda, tiempo hasta completar el pedido, motivos de
abandono, pedidos aceptados/entregados, cancelaciones por motivo, demoras y
compras repetidas. Acordar objetivos antes del piloto y contrastarlos con
observación y entrevistas. Un conteo de cuentas o una puntuación de reseñas
por sí solos no validan la experiencia.

## 9. Evidencias principales en el repositorio

| Hallazgo | Referencia |
|---|---|
| Transferencia interpretada como cero a cobrar | [DomiciliarioController](C:/dev/comercio-app/backend/app/Http/Controllers/Api/DomiciliarioController.php:332), [PanelDomiciliario](C:/dev/comercio-app/frontend/src/components/PanelDomiciliario.tsx:249). |
| Total local y confirmación sin exigir tarifa cargada | [Checkout](C:/dev/comercio-app/frontend/src/screens/CheckoutScreen.tsx:65), [botón](C:/dev/comercio-app/frontend/src/screens/CheckoutScreen.tsx:418). |
| Creación y recálculo, sin clave de intento | [PedidoController](C:/dev/comercio-app/backend/app/Http/Controllers/Api/PedidoController.php:30). |
| Cantidades enteras y selector por unidad | [validación](C:/dev/comercio-app/backend/app/Http/Controllers/Api/PedidoController.php:36), [ProductoScreen](C:/dev/comercio-app/frontend/src/screens/ProductoScreen.tsx:149). |
| Vencimiento de pendientes | [tareas](C:/dev/comercio-app/backend/routes/console.php:57). |
| GPS se detiene en segundo plano | [ubicacion.ts](C:/dev/comercio-app/frontend/src/ubicacion.ts:136). |
| Autoactivación del domiciliario | [AuthController](C:/dev/comercio-app/backend/app/Http/Controllers/AuthController.php:192). |
| Direcciones adicionales: listar y crear | [ClienteDireccionController](C:/dev/comercio-app/backend/app/Http/Controllers/Api/ClienteDireccionController.php:12), [rutas](C:/dev/comercio-app/backend/routes/api.php). |
| Sesión con token en AsyncStorage | [AuthContext](C:/dev/comercio-app/frontend/src/AuthContext.tsx:34). |
| Login demo sin condición de desarrollo | [LoginScreen](C:/dev/comercio-app/frontend/src/screens/LoginScreen.tsx:435). |
| Dominio de ejemplo y DSN vacío | [config.ts](C:/dev/comercio-app/frontend/src/config.ts:14). |
| Alcance de administración y catálogo autenticado | [rutas API](C:/dev/comercio-app/backend/routes/api.php), [AdminController](C:/dev/comercio-app/backend/app/Http/Controllers/Api/AdminController.php:26). |
| Servicios y publicación | [DESPLIEGUE](C:/dev/comercio-app/DESPLIEGUE.md), [preproducción](C:/dev/comercio-app/PREPRODUCCION.md). |
| Mediciones de carga | [PRUEBAS-CARGA](C:/dev/comercio-app/PRUEBAS-CARGA.md). |
