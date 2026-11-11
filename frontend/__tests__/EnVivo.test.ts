/**
 * Cambios en vivo: a qué servidor de WebSockets se conecta la app y qué
 * avisos le llegan a cada pantalla.
 */
import { alCambiarEnVivo, servidorEnVivo, simularAvisoEnVivo } from '../src/enVivo';
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
