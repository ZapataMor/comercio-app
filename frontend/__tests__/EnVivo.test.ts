/**
 * Cambios en vivo: a qué servidor de WebSockets se conecta la app y qué
 * avisos le llegan a cada pantalla.
 */
import { alCambiarEnVivo, clasePusher, opcionesEnVivo, servidorEnVivo, simularAvisoEnVivo } from '../src/enVivo';
import { temasDelNegocio } from '../src/usePolling';

test('en desarrollo usa ws en el puerto de Reverb del mismo host', () => {
  expect(servidorEnVivo('http://localhost:8000')).toEqual({ host: 'localhost', puerto: 8080, tls: false });
  expect(servidorEnVivo('http://192.168.1.10:8000')).toEqual({ host: '192.168.1.10', puerto: 8080, tls: false });
});

test('con HTTPS usa wss en el mismo host y puerto (el proxy pasa a Reverb)', () => {
  expect(servidorEnVivo('https://localhost:8443')).toEqual({ host: 'localhost', puerto: 8443, tls: true });
  expect(servidorEnVivo('https://api.vitrina.example')).toEqual({ host: 'api.vitrina.example', puerto: 443, tls: true });
});

test('el filtro por negocio deja pasar solo sus temas y los avisos generales', () => {
  const filtro = temasDelNegocio(['catalogo', 'negocio'], 3) as (a: { tema: string; negocio_id?: number | null }) => boolean;
  expect(filtro({ tema: 'catalogo', negocio_id: 3 })).toBe(true);
  expect(filtro({ tema: 'negocio', negocio_id: null })).toBe(true);
  expect(filtro({ tema: 'catalogo', negocio_id: 4 })).toBe(false);
  expect(filtro({ tema: 'pedidos', negocio_id: 3 })).toBe(false);
});

test('los oyentes reciben los avisos hasta que se quitan', () => {
  const oyente = jest.fn();
  const quitar = alCambiarEnVivo(oyente);
  simularAvisoEnVivo({ tema: 'negocio', negocio_id: 3 });
  quitar();
  simularAvisoEnVivo({ tema: 'negocio', negocio_id: 3 });
  expect(oyente).toHaveBeenCalledTimes(1);
  expect(oyente).toHaveBeenCalledWith({ tema: 'negocio', negocio_id: 3 });
});

test('toma el cliente de pusher-js tal como lo exporta su versión de React Native', () => {
  // El módulo real (sin simular): exporta { Pusher }, no un default. Con
  // `import Pusher from` la app nunca llegó a conectarse en vivo.
  const real = jest.requireActual('pusher-js/react-native');
  expect(typeof real.default).not.toBe('function');
  expect(clasePusher(real)).toBe(real.Pusher);

  const Fn = function () {};
  expect(clasePusher({ default: Fn })).toBe(Fn);
  expect(clasePusher(Fn)).toBe(Fn);
  expect(() => clasePusher({})).toThrow();
});

test('se conecta por WebSocket ("ws"; el cifrado lo pone forceTLS), también contra el VPS con https', () => {
  // Con solo ['wss'] pusher-js 8 no encuentra transporte y queda en 'failed'
  // sin avisar: así estuvo la app contra el VPS hasta el 2026-11-16.
  const vps = opcionesEnVivo('t', 'https://vitrina.example');
  expect(vps.enabledTransports).toContain('ws');
  expect(vps).toMatchObject({ wsHost: 'vitrina.example', wssPort: 443, forceTLS: true });
  expect(vps.channelAuthorization.endpoint).toBe('https://vitrina.example/api/broadcasting/auth');

  const local = opcionesEnVivo('t', 'http://localhost:8000');
  expect(local.enabledTransports).toContain('ws');
  expect(local).toMatchObject({ wsHost: 'localhost', wsPort: 8080, forceTLS: false });
});
