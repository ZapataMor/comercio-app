# Panel administrativo web

Acceso local: http://localhost:8000/admin (cuenta con rol administrador).

## Funciones

- Resumen: pedidos en curso, demoras de 30 minutos, reportes, reseñas, entregas,
  cancelaciones y ventas de pedidos entregados. Los indicadores abren su lista.
- Pedidos: filtros por código, estado, fechas de creación o resultado, negocio y
  demora; detalle con contactos, artículos e incidencias; cierre con motivo.
- Exportación CSV compatible con Excel: respeta los filtros, incluye BOM UTF-8 y
  neutraliza fórmulas en texto. Las ventas incluyen domicilio; no son utilidad.
- Usuarios: búsqueda, paginación, ficha, roles con motivo, suspensión y reactivación.
- Negocios: búsqueda, filtro de abiertos, propietario, contacto, horario, equipo,
  catálogo de productos paginado y acceso a todos sus pedidos.
- Domiciliarios: mapa y tabla de posiciones recientes (vigencia de cinco minutos).
  Se actualiza manualmente. Los marcadores se retiran al vencer su vigencia.
  El mapa necesita acceso a Leaflet/Unpkg y las teselas de OpenStreetMap; la tabla
  continúa disponible si el mapa no carga.
- Configuración: tarifa para pedidos nuevos y aprobación/rechazo de barrios.
- Reportes, reseñas y reputación: resolución, moderación, historial, vetos y anulación
  de eventos, conservando las reglas existentes de la API.
- Registro de acciones: administrador, ruta/recurso, fecha y campos permitidos de
  la operación. No almacena contraseñas. Cubre cambios desde la web a partir de la
  instalación; no reconstruye acciones históricas ni registra cambios desde la app.

## Instalación en otro entorno

Ejecutar desde backend:

```powershell
php artisan migrate --force
php artisan view:clear
```

La migración nueva añade únicamente `admin_acciones`. Ya se aplicó en la base local.
Las cuentas suspendidas pierden también el acceso a sesiones web existentes.
Los cambios web notifican los canales de actualización de la app.

## Verificación

137 pruebas y 796 aserciones aprobadas en los módulos afectados:
AdminWebOperacionTest, ExampleTest, EnVivoTest, P2OperacionTest,
ModeracionResenasTest, ReputacionTest y CasosLimiteTest.

Se comprobó en navegador el acceso, tablero, listado y detalle de pedidos; también
se inspeccionó la adaptación a pantalla pequeña. Captura: artifacts/panel-administrativo.jpg.
La ejecución de toda la batería se interrumpió en FotoOptimizadaTest por un error
`stream_filter_remove` y terminación prematura de PHP; no se declara aprobada.
