# Servicios, citas y descanso de almuerzo

Un negocio de servicios muestra lo que sabe hacer: diseños de uñas, cortes, peinados y otros trabajos. El catálogo incluye descripción, hasta ocho fotografías, duración y precio opcional. Cada servicio puede habilitar o deshabilitar las citas.

## Primera versión implementada

- El cliente elige un servicio, un profesional del equipo activo, una fecha en los próximos 90 días y una de las horas disponibles. Todas las horas corresponden a Colombia.
- La duración ocupa el intervalo completo. Se permiten citas simultáneas con profesionales distintos; una misma persona no puede tener citas superpuestas, incluso si trabaja en varios negocios.
- La solicitud queda pendiente. El equipo recibe el aviso y comprueba su agenda presencial antes de confirmar o rechazar con un motivo.
- La solicitud aparta provisionalmente el intervalo durante un máximo de 60 minutos. Si la cita empieza antes, el plazo termina a su hora de inicio. Sin respuesta, vence y libera el horario.
- Las citas presenciales o pactadas por teléfono se registran desde «Agenda de citas → Registrar cita presencial». Quedan confirmadas y ocupan la misma agenda. Las anotaciones que continúen únicamente en papel requieren la revisión del administrador.
- El cliente consulta la respuesta en «Mi perfil → Mis citas» y puede cancelar antes del inicio. El negocio puede cancelar con motivo y marcar una cita atendida al terminar.
- La agenda muestra primero las solicitudes pendientes y las citas confirmadas próximas; permite cargar más registros. El Inicio del negocio muestra solicitudes por confirmar y el aviso push abre su agenda.

## Reglas de la agenda (2026-11-11)

- **Cuartos de hora.** Las citas solo empiezan en :00, :15, :30 o :45. El servidor rechaza otras horas (antes aceptaba, por ejemplo, 07:07), tanto en solicitudes como en citas presenciales. Si el negocio abre a una hora rara (07:07), la primera hora ofrecida es el siguiente cuarto (07:15). Nunca se puede apartar una hora fuera del horario automático ni durante el almuerzo.
- **Máximo 3 citas por día y negocio.** Cuenta las citas del cliente cuyo inicio cae en ese día, en ese negocio: pendientes vigentes, confirmadas, atendidas y «No asistió». Las canceladas, rechazadas y vencidas liberan el cupo. Otro negocio u otro día tienen su propio cupo. Las presenciales que registra el equipo no cuentan.
- **A nombre de otra persona.** Al solicitar, el cliente elige «Para mí» o «Para otra persona» y escribe su nombre (solo letras). La cita sigue siendo de quien la pide: a esa persona le llegan la confirmación y los recordatorios, y solo ella puede cancelar o reprogramar. El negocio ve «A nombre de …» y «Solicitó: …».
- **Recordatorios.** Al cliente le llega una notificación 1 día, 5 horas, 1 hora y 15 minutos antes de una cita confirmada. Son solo notificaciones push: no suenan como alarma ni abren nada en vivo. Los recordatorios que ya no tenían tiempo cuando el negocio confirmó no se envían (una cita confirmada 3 horas antes solo recibe los de 1 hora y 15 minutos). No se envían si la cita se cancela o si ya registraron la llegada. Los envía `citas:recordar`, que el programador corre cada minuto.
- **Reprogramar.** En «Mis citas», el cliente puede mover una cita pendiente o confirmada (sin llegada registrada) a otra fecha, hora o profesional. Se aplican las mismas reglas: cuartos de hora, horario automático, profesional libre y máximo de 3 por día; la propia cita no cuenta dos veces. El horario anterior se libera, la cita vuelve a «Pendiente» con una hora para confirmar y el equipo recibe el aviso «Cita reprogramada».

## Almuerzo para cualquier negocio

En «Mi Tienda → Horario automático» cada día, incluidos los festivos, puede tener un descanso opcional con inicio y fin. El descanso debe quedar dentro de la jornada; admite horarios que cruzan medianoche. Se copia junto con el horario del lunes a los demás días.

El negocio deja de atender durante el descanso y reabre automáticamente al terminar. La etiqueta muestra «Almorzando» y el horario público indica el descanso. Esas horas tampoco se pueden reservar. Los cambios manuales de abierto/cerrado conservan el comportamiento existente hasta el siguiente cambio del horario.

## Operación y actualización local

La migración `2026_11_09_000000_create_citas_table` añade la agenda y amplía los servicios; `2026_11_11_140000_add_a_nombre_de_y_recordatorios_to_citas` añade «a nombre de» y el control de recordatorios. El programador de Laravel ejecuta `citas:vencer` cada minuto; las consultas privadas también actualizan las solicitudes vencidas y la disponibilidad siempre las excluye aunque el programador se retrase. Las notificaciones requieren el worker de cola y la configuración de Firebase existentes.

Desde PowerShell en la raíz del proyecto, `powershell -ExecutionPolicy Bypass -File .\actualizar-citas.ps1` reconstruye el backend local, aplica las migraciones mediante el servicio existente y compila e instala la app de pruebas. Requiere Docker Desktop y un emulador o dispositivo conectado. No vuelve a sembrar los datos de demostración. Puede indicarse `-Device` si hay más de un dispositivo.

Los profesionales seleccionables son los miembros activos del equipo. Para recibir citas, el negocio debe configurar su horario automático y publicar al menos un servicio con citas habilitadas.
