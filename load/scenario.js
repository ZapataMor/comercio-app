import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import execution from 'k6/execution';

const users = new SharedArray('tokens', () => JSON.parse(open('/results/fixtures.json')).tokens);
const stores = new SharedArray('stores', () => JSON.parse(open('/results/fixtures.json')).stores);
const vus = Number(__ENV.USERS || 10);
const profile = __ENV.PROFILE || 'mixed';
const businessErrors = new Rate('business_errors');
const apiDuration = new Trend('api_duration', true);
const ordersCreated = new Counter('orders_created');
const status429 = new Counter('responses_429');
const status5xx = new Counter('responses_5xx');
const durations = {
  catalog: new Trend('catalog_duration', true),
  search: new Trend('search_duration', true),
  detail: new Trend('detail_duration', true),
  history: new Trend('history_duration', true),
  checkout: new Trend('checkout_duration', true),
  polling: new Trend('polling_duration', true),
  login: new Trend('login_duration', true),
};

export const options = {
  hosts: { localhost: __ENV.TARGET_IP },
  discardResponseBodies: true,
  scenarios: {
    activity: profile === 'polling-open' ? {
      executor: 'ramping-arrival-rate', startRate: 0, timeUnit: '1s',
      preAllocatedVUs: vus, maxVUs: vus,
      stages: [
        { duration: __ENV.RAMP || '15s', target: Math.ceil(vus / 5) },
        { duration: __ENV.HOLD || '60s', target: Math.ceil(vus / 5) },
        { duration: '10s', target: 0 },
      ],
      gracefulStop: '10s',
    } : {
      executor: 'ramping-vus', startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '15s', target: vus },
        { duration: __ENV.HOLD || '60s', target: vus },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s', gracefulStop: '10s',
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    ...(profile === 'polling-open' ? { dropped_iterations: ['count<1'] } : {}),
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '40s' }],
    business_errors: ['rate<0.01'],
    api_duration: [{ threshold: 'p(95)<1000', abortOnFail: false }],
  },
};

function request(method, path, token, body, expected = 200, readBody = false) {
  const response = http.request(method, `https://localhost${path}`, body ? JSON.stringify(body) : null, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    tags: { name: `${method} ${path.replace(/\/[0-9]+/g, '/:id')}` },
    timeout: '15s', responseType: readBody ? 'text' : 'none',
  });
  apiDuration.add(response.timings.duration);
  const category = path === '/api/login' ? 'login' : method === 'POST' ? 'checkout' : path.includes('/estado') ? 'polling'
    : path.includes('/productos?') ? 'search' : path === '/api/negocios' ? 'catalog'
    : path === '/api/pedidos' ? 'history' : 'detail';
  durations[category].add(response.timings.duration);
  businessErrors.add(response.status !== expected);
  if (response.status === 429) status429.add(1);
  if (response.status >= 500) status5xx.add(1);
  check(response, { 'respuesta esperada': r => r.status === expected });
  return response;
}

export default function () {
  const identity = profile === 'polling-open' ? execution.scenario.iterationInTest : __VU - 1;
  const token = users[identity % users.length];
  const store = stores[(identity + __ITER) % stores.length];
  // balanced distribuye usuarios entre pantallas desde el primer segundo;
  // mixed recorre el catalogo antes de llegar al pedido.
  const step = profile === 'balanced' ? (__ITER + __VU) % 10 : __ITER % 10;
  if (profile === 'login') {
    request('POST', '/api/login', token, {
      email: `usuario-${(__VU - 1) % users.length}@carga.invalid`, password: 'Carga-local-2026',
    });
    sleep(15);
    return;
  }
  if (profile === 'polling' || profile === 'polling-open') {
    request('GET', `/api/negocios/${store.id}/estado`, token);
    if (profile === 'polling') sleep(5);
    return;
  }
  if (step < 4) request('GET', '/api/negocios', token);
  else if (step < 6) request('GET', '/api/productos?buscar=arroz', token);
  else if (step < 8) request('GET', `/api/negocios/${store.id}`, token);
  else if (step === 8) request('GET', '/api/pedidos', token);
  else {
    const created = request('POST', '/api/pedidos', token, {
      negocio_id: store.id, items: [{ producto_id: store.product, cantidad: 1 }],
      metodo_pago: 'efectivo', direccion_entrega: 'Calle de carga 1', telefono_contacto: '3000000000',
    }, 201, true);
    if (created.status === 201) {
      ordersCreated.add(1);
      const id = created.json('id');
      request('GET', `/api/pedidos/${id}`, token);
      // La cancelacion evita acumular pedidos pendientes durante el ensayo.
      request('POST', `/api/pedidos/${id}/cancelar`, token, {});
    }
  }
  sleep(Number(__ENV.PAUSE || 3));
}

export function handleSummary(data) {
  const output = {};
  output['/results/' + __ENV.RUN_NAME + '.json'] = JSON.stringify(data, null, 2);
  return output;
}
