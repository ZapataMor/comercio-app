"""Genera el informe a partir de los JSON de k6 y Docker, sin leer tokens."""
import csv
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'carga'


def memory_mb(value):
    match = re.match(r'([\d.]+)\s*([KMGT]?i?B)', value)
    if not match:
        return 0
    number, unit = match.groups()
    return float(number) * {'B': 1 / 1048576, 'KiB': 1 / 1024, 'MiB': 1, 'GiB': 1024}.get(unit, 1)


rows = []
details = []
for index in OUT.glob('*-runs.json'):
    if index.name.startswith(('calibracion-', 'validacion-')):
        continue
    runs = json.loads(index.read_text(encoding='utf-8-sig'))
    if isinstance(runs, dict):
        runs = [runs]
    for run in runs:
        summary_path = OUT / (run['run'] + '.json')
        if not summary_path.exists():
            continue
        data = json.loads(summary_path.read_text(encoding='utf-8-sig'))
        metrics = data['metrics']

        def metric(name, field, default=0):
            return metrics.get(name, {}).get('values', {}).get(field, default)

        resources = json.loads((OUT / (run['run'] + '-resources.json')).read_text(encoding='utf-8-sig'))

        def resource(name, field, convert):
            return max((convert(sample[field]) for sample in resources if sample['Name'] == name), default=0)

        row = {
            'prueba': run['run'], 'usuarios_objetivo': run['users'],
            'usuarios_maximos': metric('vus', 'max'),
            'solicitudes': metric('http_reqs', 'count'), 'rps': round(metric('http_reqs', 'rate'), 2),
            'p95_ms': round(metric('api_duration', 'p(95)'), 2),
            'p99_ms': round(metric('api_duration', 'p(99)'), 2),
            'errores_pct': round(metric('business_errors', 'rate') * 100, 3),
            'http_5xx': metric('responses_5xx', 'count'), 'http_429': metric('responses_429', 'count'),
            'iteraciones_no_iniciadas': metric('dropped_iterations', 'count'),
            'pedidos_creados': metric('orders_created', 'count'),
            'php_cpu_max_pct': round(resource('vitrina-carga-app-1', 'CPUPerc', lambda s: float(s.rstrip('%'))), 1),
            'mysql_cpu_max_pct': round(resource('vitrina-carga-db-1', 'CPUPerc', lambda s: float(s.rstrip('%'))), 1),
            'php_mem_max_mb': round(resource('vitrina-carga-app-1', 'MemUsage', memory_mb), 1),
            'mysql_mem_max_mb': round(resource('vitrina-carga-db-1', 'MemUsage', memory_mb), 1),
            'generador_cpu_max_pct': round(resource('vitrina-load-' + run['run'], 'CPUPerc', lambda s: float(s.rstrip('%'))), 1),
            'generador_mem_max_mb': round(resource('vitrina-load-' + run['run'], 'MemUsage', memory_mb), 1),
            'resultado': 'APROBADO' if run['exitCode'] == 0 else 'NO APROBADO',
            'codigo_salida': run['exitCode'], 'generador_oom': run['generatorOOM'],
            'duracion_s': round(data.get('state', {}).get('testRunDurationMs', 0) / 1000, 1),
        }
        rows.append(row)
        endpoint_data = []
        for name in ('catalog', 'search', 'detail', 'history', 'checkout', 'polling', 'login'):
            if name + '_duration' in metrics:
                endpoint_data.append(f"{name}: p95 {metric(name + '_duration', 'p(95)'):.1f} ms")
        details.append(f"- **{run['run']}**: " + '; '.join(endpoint_data) + '.')

rows.sort(key=lambda r: (r['prueba'].split('-')[0], r['usuarios_objetivo']))
if not rows:
    raise SystemExit('Todavia no hay pruebas completas.')
with (OUT / 'resultados.csv').open('w', newline='', encoding='utf-8-sig') as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

date = datetime.now(timezone(timedelta(hours=-5))).strftime('%Y-%m-%d %H:%M America/Bogota')
lines = [
    '# Prueba de capacidad local de Vitrina', '', f'Informe generado: {date}.', '',
    '## Condiciones', '',
    '- Entorno separado `vitrina-carga`; PHP 8.4-FPM, Nginx, Caddy y MySQL 8.4.',
    '- PHP: 2 CPU, 512 MiB, 5 procesos FPM. MySQL: 2 CPU, 1 GiB.',
    '- Generador k6 2.3.0: 2 CPU, 2 GiB. Docker/WSL dispone de 12 CPU y unos 15 GiB.',
    '- 1000 cuentas, 100 negocios, 2000 productos y 20000 pedidos historicos sinteticos.',
    '- HTTPS con validacion del certificado; usuarios autenticados con tokens individuales.',
    '- Criterios propuestos: menos de 1% de errores y p95 inferior a 1000 ms.',
    '- Las pruebas se interrumpen si superan 1% de errores despues de 40 s.', '',
    '## Resultados', '',
    '| Prueba | Usuarios objetivo / maximo observado | Solicitudes/s | p95 ms | p99 ms | Errores % | Pedidos creados | Resultado |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
]
for r in rows:
    lines.append(f"| {r['prueba']} | {r['usuarios_objetivo']} / {r['usuarios_maximos']} | {r['rps']} | {r['p95_ms']} | {r['p99_ms']} | {r['errores_pct']} | {r['pedidos_creados']} | {r['resultado']} |")
lines += ['', '## Tiempos por operacion', '', *details, '', '## Recursos (maximos muestreados)', '',
          '| Prueba | CPU PHP % | CPU MySQL % | RAM PHP MiB | RAM MySQL MiB | CPU k6 % | RAM k6 MiB |',
          '|---|---:|---:|---:|---:|---:|---:|']
for r in rows:
    lines.append(f"| {r['prueba']} | {r['php_cpu_max_pct']} | {r['mysql_cpu_max_pct']} | {r['php_mem_max_mb']} | {r['mysql_mem_max_mb']} | {r['generador_cpu_max_pct']} | {r['generador_mem_max_mb']} |")
lines += ['', '## Interpretacion y limites', '',
    '- 200% de CPU en Docker equivale a dos nucleos. Se muestrea aproximadamente cada cinco segundos; no es el pico exacto.',
    '- Mixed: 40% de ciclos lista negocios, 20% busqueda, 20% detalle, 10% historial y 10% creacion/consulta/cancelacion de pedido; pausa de 3 s. La mezcla efectiva puede variar durante rampas o saturacion.',
    '- Balanced distribuye esas mismas operaciones entre los usuarios desde el comienzo para incluir pedidos aun cuando la navegacion sea muy lenta.',
    '- Polling: consulta seguida de una pausa de 5 s. Polling-open: llegadas independientes de la respuesta, 200 solicitudes/s para representar 1000 pantallas con refresco cada 5 s. En ese perfil los VU son capacidad de ejecucion preasignada, no personas observadas.',
    '- Login: ingreso con bcrypt y pausa de 15 s. Las solicitudes que el generador no pudo iniciar se registran como iteraciones_no_iniciadas en el CSV.',
    '- Los percentiles incluyen rampa, meseta y descenso; las solicitudes/s son el promedio del ensayo completo.',
    '- Los VU son un modelo cerrado: si el servidor se ralentiza, el generador envia menos solicitudes. Deben leerse juntos usuarios, latencia, errores y solicitudes/s.',
    '- El generador comparte equipo con el servidor y otras aplicaciones. Estos resultados no certifican capacidad de un hosting ni incluyen latencia de internet.',
    '- No se mide fluidez del telefono, descarga de imagenes, GPS, correo externo ni Firebase bajo carga. Los datos sinteticos no cubren todas las combinaciones reales.',
    '- Las pruebas cortas exploran capacidad inmediata; solo la prueba sostenida ensaya varios minutos. No equivalen a una prueba de resistencia de varias horas.',
    '- Al finalizar se corta el trabajo que supera la gracia del generador. El corte de los ensayos saturados dejo 86 pedidos sinteticos pendientes de cancelacion; quedaron exclusivamente en la BD de carga, detenida al terminar. Esto no demuestra perdida ni duplicacion de pedidos del servidor.',
    '- JSON originales, muestras Docker y registros quedan junto a este informe. `fixtures.json` contiene tokens locales y no debe compartirse.',
]
(OUT / 'informe.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(json.dumps(rows, ensure_ascii=False, indent=2))
