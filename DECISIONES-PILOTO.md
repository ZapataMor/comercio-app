# Decisiones para el piloto de Vitrina

Actualizado: 15 de noviembre de 2026. Fuente: decisiones del propietario en la conversación de desarrollo.

Este documento distingue decisiones de producto de funciones implementadas. No es el texto de las políticas públicas ni acredita que todas estas reglas estén aplicadas en el código.

## Alcance e ingresos

- Primero se prueba Android; después iOS.
- Productos y pedidos son la prioridad. Citas y propiedades permanecen visibles, pero su desarrollo y validación se posponen.
- La cobertura se delimitará a la zona urbana de Maicao, sin excluir barrios dentro del perímetro aprobado. Esta precisión sustituye la formulación inicial «todo Maicao».
- Vitrina permitirá operación 24/7 según los horarios de negocios y transportistas. No significa que siempre haya comercios abiertos o repartidores disponibles.
- El propietario atenderá soporte mediante WhatsApp empresarial y una web futura. Pendientes: número, URL, días, horas y procedimiento.
- No hay comisión por pedido ni participación de Vitrina en el domicilio.
- Los negocios pagan por presencia y beneficios: referencia de COP 30.000 mensuales por negocio, con tarifas reducidas o exenciones según el caso.
- Piloto gratuito y dos primeros meses gratuitos para cada nuevo negocio. Planes posteriores mensuales, semestrales y anuales. Pendientes: precios de planes, fecha que inicia la gratuidad y reglas de vencimiento.
- Los anunciantes de propiedades también pagarán; la tarifa queda pendiente.

## Pago, cancelación y liquidación

- Efectivo: el cliente paga productos más domicilio al repartidor. El repartidor conserva el domicilio y entrega al negocio el subtotal de productos.
- Transferencia: el encargado autorizado del negocio verifica la recepción y confirma manualmente. No se puede tratar como pagado por elegir ese método. El flujo del pedido debe esperar la confirmación.
- Si el cliente transfiere el total, el negocio entrega al repartidor el valor del domicilio. Decisión del 20 de noviembre de 2026: se lo entrega **al recoger** el pedido (el repartidor ya lleva mercancía que vale más que el domicilio y, si el cliente no aparece, el domicilio igual es suyo). El comprobante del cliente es opcional; revisar que el dinero llegó es responsabilidad del negocio. Implementado: cuentas de pago del negocio, «Ya pagué», confirmación del negocio y «No cobrar» para el repartidor.
- Registrar por separado pago del cliente, devolución al cliente y liquidación entre negocio y repartidor. No confundir «pedido entregado» con «dinero liquidado».
- Cancelación del cliente: en cualquier momento antes de comenzar la preparación, sin límite de minutos desde la creación. Pendiente representar inequívocamente el inicio de preparación y validar la transición en el servidor para evitar que cancelar e iniciar preparación puedan completarse simultáneamente.
- Si cancela dentro de esas condiciones y ya transfirió, el negocio debe devolver el dinero. Una vez iniciada la preparación no habrá cancelación ordinaria del cliente; las incidencias deben tener resolución independiente.
- Reembolsos: solicitado, en revisión, devuelto o rechazado; registrar importe, responsable, fecha, motivo y evidencia. La solicitud por sí sola no significa que se haya devuelto dinero. Implementado el 21 de noviembre de 2026: solicitado (con la cuenta del cliente; se abre solo si el negocio confirmó el pago) → devuelto (monto, quién, cuándo y comprobante opcional) → recibido o no recibido (lo confirma el cliente); rechazado con motivo solo si el negocio no había confirmado el pago. «En revisión» se cubre con «no recibido», que vuelve al negocio.
- Datos de transferencia: cada negocio registra sus cuentas (Nequi, Daviplata, Bancolombia, otro banco, llave o QR) en «Cuentas de pago».

## Reparto e incidencias

- Sin domiciliarios disponibles se bloquean nuevos pedidos; el catálogo puede seguir consultándose. Debe comprobarse también en el servidor al confirmar, no solo desactivar un botón. Definir disponibilidad con turno, autorización y capacidad de tomar pedidos. No cancelar automáticamente pedidos existentes por quedarse sin disponibilidad después.
- Delimitar cobertura con un polígono y validar el punto de entrega en el servidor. Falta el perímetro aprobado; no usar un rectángulo aproximado como límite definitivo.
- Cliente ausente: el repartidor devuelve el pedido al negocio y debe quedar constancia de intentos de contacto, incidencia y devolución.
- Decisión confirmada del propietario para comida no entregada por ausencia del cliente: si pagó por transferencia, reembolsar el 50 % del subtotal de productos; el domicilio se reconoce completo al repartidor y no se incluye en el reembolso. Ejemplo: productos COP 40.000 + domicilio COP 5.000 = pago COP 45.000; reembolso COP 20.000, domicilio COP 5.000 para el repartidor. Esta regla no se extiende a cancelaciones antes de preparar ni a fallos atribuibles al negocio o al repartidor. Pendientes: implementación del flujo, revisión de la política antes de publicarla y definición del caso de efectivo no cobrado.
- Dirección incorrecta: contacto con el cliente, reporte del domiciliario sobre la dirección del pedido y solicitud de corrección al cliente. Conservar la dirección histórica del pedido; no modificar silenciosamente otras direcciones del usuario.
- Cobro superior al informado: el cliente reporta; administración revisa importe y evidencia. El reporte no implica sanción automática.
- La conciliación ampliada del administrador se desarrollará después.

## Incorporación de repartidores

- Primera modalidad: empresa de transporte responsable de incorporar a sus empleados, mediante un encargado autorizado.
- El encargado administra la aprobación de esos usuarios. Pendiente modelar empresa, pertenencia y permisos; el alta libre actual no equivale a esta aprobación.
- Modalidad futura: registro individual con verificación de identidad. No implementar todavía ni recoger cédula/rostro para un proceso que no está disponible. Los costos mencionados en la conversación no se han verificado.

## Requisitos mínimos propuestos para negocios

Criterios para estar listo para atender productos. Esta lista no añade por sí sola bloqueos al servidor ni exige documentos comerciales nuevos.

1. Una cuenta responsable como propietario y un encargado de pedidos con permisos; puede ser la misma persona.
2. Nombre real o comercial reconocible y al menos una categoría adecuada.
3. Dirección, barrio y punto exacto de recogida en el mapa.
4. Teléfono de contacto atendido durante la operación.
5. Horario definido o compromiso de abrir/cerrar manualmente; tiempo de preparación realista.
6. Al menos un producto disponible con nombre, precio en COP, unidad de venta y descripción/opciones suficientes para pedirlo sin ambigüedad.
7. Una imagen representativa y descripción del negocio son recomendadas para facilitar reconocimiento; no bloquean la creación inicial.
8. Encargado que reciba avisos y pueda aceptar/rechazar pedidos, marcar preparación y verificar transferencias cuando estén habilitadas.
9. Aceptación de las reglas finales de atención, cancelación, devolución y liquidación. Datos de transferencia claros si ofrece ese método.
10. Prueba completa antes de operar: recibir un pedido, prepararlo, entregarlo y comprobar la liquidación.

Se puede crear el perfil antes de completar el catálogo. La comprobación de «listo para operar» y sus bloqueos quedan pendientes de implementación. No imponer aún membresía pagada durante la gratuidad.

## Cambios implementados en esta entrega

- Formulario de creación de negocio guiado en tres pasos: identidad; ubicación/contacto; atención. Incluye sección resaltada, Siguiente, Anterior, conservación de datos y regreso al paso asociado a errores del servidor.
- Al editar un negocio existente se conserva el formulario completo. La guía global de productos, apertura y atención de pedidos aún está pendiente.
- La confirmación de efectivo del negocio pregunta por el subtotal de productos y explica que el repartidor conserva el domicilio.
- Los demás flujos descritos arriba quedan como trabajo pendiente; en particular confirmación de transferencia, polígono, disponibilidad y estados completos de reembolso.
