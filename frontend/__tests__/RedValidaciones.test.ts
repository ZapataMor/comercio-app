import NetInfo from '@react-native-community/netinfo';
import { direccionValida, separarDireccion, telefonoValido, unirDireccion } from '../src/direccion';
import { alReintentarRed, reintentarRed, iniciarMonitorRed, solicitar, TIEMPO_PETICION_MS, TIEMPO_SUBIDA_MS } from '../src/red';

const fetchOriginal = globalThis.fetch;

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { globalThis.fetch = fetchOriginal; jest.useRealTimers(); jest.restoreAllMocks(); });

test('campos de direccion se conservan al escribir y exigen via y casa', () => {
  for (const partes of [{ calle: '12', carrera: '', casa: '30' }, { calle: '', carrera: '8', casa: '30-15' }, { calle: '12', carrera: '8', casa: '30' }]) {
    expect(separarDireccion(unirDireccion(partes))).toEqual(partes);
    expect(direccionValida(unirDireccion(partes))).toBe(true);
  }
  expect(direccionValida(' #30')).toBe(false);
  expect(direccionValida('Calle 12 #')).toBe(false);
  expect(separarDireccion(' #3').casa).toBe('3');
  expect(telefonoValido('3001234567')).toBe(true);
  for (const telefono of ['300123456', '30012345678', '2001234567', '3abcdefghi']) expect(telefonoValido(telefono)).toBe(false);
});

test('la solicitud termina aunque fetch no responda al aborto', async () => {
  globalThis.fetch = jest.fn(() => new Promise(() => {}));
  const respuesta = expect(solicitar('/api/test')).rejects.toThrow('tardó demasiado');
  await jest.advanceTimersByTimeAsync(TIEMPO_PETICION_MS);
  await respuesta;
  expect(jest.getTimerCount()).toBe(0);
});

test('el plazo cubre tambien la descarga del cuerpo', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) });
  const respuesta = expect(solicitar('/api/test')).rejects.toThrow('tardó demasiado');
  await jest.advanceTimersByTimeAsync(TIEMPO_PETICION_MS);
  await respuesta;
});

test('perder internet interrumpe una solicitud y recuperar conexion permite otra', async () => {
  let cambiar: any;
  jest.spyOn(NetInfo, 'addEventListener').mockImplementation(listener => { cambiar = listener; return jest.fn(); });
  const stop = iniciarMonitorRed();
  globalThis.fetch = jest.fn(() => new Promise(() => {}));
  const respuesta = expect(solicitar('/api/test')).rejects.toThrow('sin internet');
  cambiar({ isConnected: false, isInternetReachable: false });
  await respuesta;
  cambiar({ isConnected: true, isInternetReachable: true });
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ listo: true }) });
  expect(await (await solicitar('/api/test')).json()).toEqual({ listo: true });
  stop();
});

test('una respuesta HTML de limite devuelve un mensaje comprensible', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => { throw new SyntaxError('HTML'); } });
  const response = await solicitar('/api/test');
  expect(response.status).toBe(429);
  expect((await response.json()).message).toContain('demasiadas solicitudes');
});

test('reintentar comprueba la conexión y refresca lecturas sin repetir escrituras', async () => {
  const leer = jest.fn();
  const quitar = alReintentarRed(leer);
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
  await expect(solicitar('/api/pedidos', { method: 'POST' })).rejects.toThrow();
  jest.spyOn(NetInfo, 'refresh').mockResolvedValueOnce({ isConnected: false, isInternetReachable: false } as any);
  await reintentarRed();
  expect(leer).not.toHaveBeenCalled();
  jest.spyOn(NetInfo, 'refresh').mockResolvedValueOnce({ isConnected: true, isInternetReachable: true } as any);
  await reintentarRed();
  expect(leer).toHaveBeenCalledTimes(1);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  quitar();
});

test('una subida de fotos tiene más plazo que una petición normal', async () => {
  globalThis.fetch = jest.fn(() => new Promise(() => {}));
  let terminada = false;
  const subida = solicitar('/api/propiedades', {}, TIEMPO_SUBIDA_MS).catch(e => { terminada = true; return e; });
  await jest.advanceTimersByTimeAsync(TIEMPO_PETICION_MS + 1000);
  expect(terminada).toBe(false);
  await jest.advanceTimersByTimeAsync(TIEMPO_SUBIDA_MS);
  expect((await subida).message).toContain('tardó demasiado');
});
