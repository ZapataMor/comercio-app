# Pruebas de carga de Vitrina

Los scripts prueban una copia independiente del servidor, con el mismo codigo
e imagenes de preproduccion. No usan datos ni tokens de desarrollo o de la app
instalada. El proyecto Docker es `vitrina-carga`, la BD `vitrina_load` y los
volumenes son exclusivos de ese proyecto. Firebase queda deshabilitado.

## Resultado del 6 de noviembre de 2026

Con PHP limitado a 2 CPU/512 MiB (5 procesos FPM) y MySQL a 2 CPU/1 GiB:

| Usuarios simulados, perfil mixed | p95 | Errores HTTP | Criterio de velocidad |
|---:|---:|---:|---|
| 10 | 54 ms | 0% | Aprobado |
| 50 | 52 ms | 0% | Aprobado |
| 100 | 56 ms | 0% | Aprobado |
| 200, meseta de 3 minutos | 265 ms | 0% | Aprobado |
| 300 | 1,60 s | 0% | No aprobado |
| 500 | 3,45 s | 0% | No aprobado |
| 1000 | 10,19 s | 0% | No aprobado |

El criterio propuesto fue p95 < 1 s y errores < 1%. PHP llego a su cuota de CPU
y al maximo de 5 procesos FPM; no hubo reinicios ni agotamiento de memoria.
No se modifico el codigo del backend para mejorar artificialmente el resultado.

Se ensayaron tambien 1000 usuarios repartidos entre pantallas: crearon 595
pedidos, con p95 de 10,21 s y sin errores HTTP. El ensayo sostenido de 200
usuarios completo 14881 solicitudes y creo/cancelo 1178 pedidos en unos 208 s
totales, con una meseta de 180 s.

Con 1000 usuarios en el perfil polling (pausa de 5 s despues de responder),
el p95 fue 2,30 s. En el perfil abierto, con objetivo de 200 solicitudes/s
durante la meseta, el p95 fue 8,23 s y 2512 iteraciones no pudieron iniciarse
al alcanzarse el limite de 1000 VU mientras el servidor demoraba en responder.
Esas omisiones no son respuestas HTTP exitosas ni errores HTTP del servidor:
significan que no se completo la carga planificada. El generador no agoto CPU
ni memoria. Con 50 usuarios iniciando sesion, p95 de 280 ms y 0% de errores.

Las once mediciones publicadas enviaron 61453 solicitudes y crearon 2734
pedidos. Son resultados locales con datos sinteticos, no una certificacion
de 1000 usuarios reales ni del hosting definitivo. La referencia favorable
es la mezcla ensayada con 200 usuarios; para dimensionar hay que conservar
margen para otros tipos de actividad, picos y crecimiento de datos.
Al cortar los ensayos saturados quedaron 86 pedidos sinteticos pendientes
porque el generador no alcanzo a enviar su cancelacion. Permanecen solamente
en la copia de carga, que se detuvo al terminar; no son pedidos reales.

Prioridades antes de prometer capacidad para mil usuarios activos: revisar
CPU y procesos PHP-FPM, reducir la carga del refresco automatico y repetir
la medicion en el servidor definitivo con el generador en otra maquina.

El [informe detallado](artifacts/carga/informe.md) contiene todas las pruebas,
percentiles, recursos y limitaciones; el [CSV](artifacts/carga/resultados.csv)
permite revisar los valores originales. Los perfiles SQL diagnosticos de
catalogo, busqueda e historial devolvieron 200 con 6, 5 y 6 consultas,
respectivamente; no se observo una explosion de consultas en esas muestras.

## Ejecutar

Con Docker Desktop abierto, desde la raiz en PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\probar-carga.ps1
```

La primera vez crea 1000 cuentas, 100 negocios, 2000 productos y 20000 pedidos
historicos. Genera un token Sanctum individual por cuenta; los ingresos se
prueban por separado para no confundir bcrypt con la actividad ya autenticada.
No ejecuta `migrate:fresh` ni borra datos de otro entorno.

El perfil `mixed` consulta negocios, busca productos, abre un negocio, consulta
el historial y crea/consulta/cancela pedidos, con pausas de tres segundos.
Incluye rampa, meseta y descenso en cada escalon de concurrencia.

```powershell
# Subir gradualmente desde diez hasta mil usuarios
.\probar-carga.ps1 -Users 10,50,100,300,500,1000 -Hold 60s -Ramp 15s

# Consultas periodicas: una cada cinco segundos por usuario
.\probar-carga.ps1 -Users 1000 -Profile polling -Hold 60s -Prefix polling

# Refresco a una tasa fija, incluso si el servidor se vuelve lento (200 req/s)
.\probar-carga.ps1 -Users 1000 -Profile polling-open -Hold 60s -Prefix refresco

# Actividad sostenida durante tres minutos
.\probar-carga.ps1 -Users 100 -Hold 180s -Prefix sostenida

# Ingresos reales, con bcrypt y cuentas diferentes
.\probar-carga.ps1 -Users 50 -Profile login -Hold 60s -Prefix ingresos

# Usuarios repartidos entre pantallas desde el primer segundo
.\probar-carga.ps1 -Users 1000 -Profile balanced -Hold 60s -Prefix distribuida

# Informe legible y CSV (solo biblioteca estandar de Python)
python .\load\report.py
```

Desde `powershell.exe -File` usa los valores por defecto o un solo `-Users`;
para pasar una lista, llama al script desde una sesion PowerShell como arriba.
Cada combinacion Prefix/Profile/Users debe ser unica si quieres conservar
resultados anteriores; los archivos de esa combinacion se reemplazan.

## Recursos y criterios

PHP tiene 2 CPU, 512 MiB y los 5 procesos FPM de la imagen original. MySQL tiene
2 CPU y 1 GiB. k6 tiene 2 CPU y 2 GiB; se muestrea su consumo y el del servidor.
HTTPS valida la CA local, sin desactivar la verificacion TLS.

Los criterios iniciales propuestos son menos de 1% de errores y p95 inferior
a un segundo. Un codigo 99 de k6 significa que incumplio un criterio de
rendimiento: se guarda el resultado y se sigue con el siguiente escalon.
El ensayo se interrumpe si supera 1% de errores despues de los primeros 40 s.

Las mediciones se guardan en `artifacts/carga`: JSON originales, registros,
consumo de recursos, `resultados.csv` e `informe.md`. No compartas
`fixtures.json`: contiene los tokens de estas cuentas locales. Todo ese
directorio queda fuera de Git.

El numero de usuarios es concurrencia simulada, no cuentas registradas. El
generador comparte equipo con el servidor; la latencia de internet, el hosting
definitivo, las imagenes, el GPS y Firebase bajo carga requieren otras pruebas.
Los datos son sinteticos y las pruebas duran minutos, no horas. El informe
explica las limitaciones de los percentiles y del modelo cerrado de k6.
Si la navegacion se ralentiza mucho, el perfil mixed puede no alcanzar el paso
de crear pedidos: consulta la columna de pedidos realmente creados y usa el
perfil balanced para incluir escrituras desde el comienzo.

Metodologia y criterios: [API load testing](https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/)
y [umbrales de k6](https://grafana.com/docs/k6/latest/using-k6/thresholds/).

## Detener solamente el entorno de carga

```powershell
docker compose --env-file .env.preproduccion -f compose.preproduccion.yaml -f compose.carga.yaml -p vitrina-carga stop
```

Esto conserva sus datos y no detiene `vitrina-preproduccion`.
