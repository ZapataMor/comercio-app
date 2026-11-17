/**
 * «Cómo llegar» dentro de la app: pide la ruta desde donde está la persona,
 * muestra la próxima indicación y cuánto falta, recalcula al salirse del
 * camino, deja elegir a pie y cae en Google Maps si la ruta no carga.
 * @format
 */

import Geolocation from '@react-native-community/geolocation';
import React from 'react';
import { Linking, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError, calcularRuta, Ruta } from '../src/api';
import { comoLlegar } from '../src/comoLlegar';
import type { DestinoRuta } from '../src/navTypes';
import { navigationRef } from '../src/RootNavigation';
import { metrosEntre } from '../src/ruta';
import RutaScreen from '../src/screens/RutaScreen';
import { miUbicacion, pedirPermisoUbicacion } from '../src/ubicacion';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }) }));
jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), calcularRuta: jest.fn() }));
jest.mock('../src/ubicacion', () => ({
  ...jest.requireActual('../src/ubicacion'),
  pedirPermisoUbicacion: jest.fn(),
  miUbicacion: jest.fn(),
}));
jest.mock('../src/RootNavigation', () => ({
  ...jest.requireActual('../src/RootNavigation'),
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

const mockRuta = calcularRuta as jest.Mock;
const mockPermiso = pedirPermisoUbicacion as jest.Mock;
const mockMiUbicacion = miUbicacion as jest.Mock;
const watch = Geolocation.watchPosition as jest.Mock;
const clearWatch = Geolocation.clearWatch as jest.Mock;

// Ruta en L por Maicao: ~300 m al norte y luego ~300 m al este hasta el negocio.
const A = { lat: 11.38, lng: -72.24 };
const B = { lat: 11.3827, lng: -72.24 };
const C = { lat: 11.3827, lng: -72.23725 };
const AB = metrosEntre(A, B);
const BC = metrosEntre(B, C);
const RUTA: Ruta = {
  modo: 'moto',
  distancia_m: Math.round(AB + BC),
  duracion_s: 150,
  linea: [
    [A.lng, A.lat],
    [B.lng, B.lat],
    [C.lng, C.lat],
  ],
  pasos: [
    { texto: 'Arranca por la Carrera 15', icono: 'salida', calle: 'Carrera 15', en_m: 0, punto: A },
    { texto: 'Gira a la derecha por la Calle 16', icono: 'derecha', calle: 'Calle 16', en_m: Math.round(AB), punto: B },
    { texto: 'Llegas: el destino queda a la derecha', icono: 'llegada', calle: null, en_m: Math.round(AB + BC), punto: C },
  ],
};
const DESTINO: DestinoRuta = { punto: C, nombre: 'Jugos María', tipo: 'negocio', detalle: 'Calle 16 #10-20' };

const INICIO = new Date('2026-11-16T15:00:00-05:00').getTime();
const goBack = jest.fn();
let raiz: ReactTestRenderer.ReactTestRenderer;

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
const boton = (texto: string) =>
  raiz.root.findAll(n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => [t.props.children].flat().join('') === texto))[0];

async function abrir(params: { modo?: 'moto' | 'pie'; elegirModo?: boolean } = {}) {
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <RutaScreen
        route={{ key: 'r', name: 'Ruta', params: { destino: DESTINO, ...params } } as any}
        navigation={{ goBack } as any}
      />,
    );
  });
  await act(async () => {});
}

/** El GPS lee `punto` `enMs` después de abrir. */
async function leerGps(punto: { lat: number; lng: number }, enMs: number) {
  jest.setSystemTime(INICIO + enMs);
  const alLeer = watch.mock.calls[watch.mock.calls.length - 1][0];
  await act(async () => {
    alLeer({ coords: { latitude: punto.lat, longitude: punto.lng } });
  });
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: INICIO });
  mockPermiso.mockResolvedValue(true);
  mockMiUbicacion.mockResolvedValue(A);
  mockRuta.mockResolvedValue(RUTA);
});

afterEach(() => {
  act(() => raiz?.unmount());
  jest.useRealTimers();
});

test('pide la ruta desde donde estoy y muestra la próxima indicación y cuánto falta', async () => {
  await abrir();

  expect(mockRuta).toHaveBeenCalledWith('t', A, C, 'moto');
  expect(textos()).toEqual(expect.arrayContaining(['En 300 m', 'Gira a la derecha por la Calle 16', '3 min', '· 600 m', 'Jugos María']));
});

test('avanzando, la indicación y el resumen se ponen al día sin pedir otra ruta', async () => {
  await abrir();
  // Pasando la esquina, ya por la Calle 16.
  await leerGps({ lat: B.lat, lng: B.lng + 0.001 }, 4000);

  expect(textos()).toEqual(expect.arrayContaining(['Llegas: el destino queda a la derecha', '· 190 m']));
  expect(mockRuta).toHaveBeenCalledTimes(1);
});

test('si me salgo del camino recalcula desde donde voy, pero no a cada lectura', async () => {
  await abrir();
  const fuera = { lat: 11.381, lng: -72.2412 }; // ~130 m al oeste de la Carrera 15

  await leerGps(fuera, 5000);
  expect(mockRuta).toHaveBeenCalledTimes(1);

  await leerGps(fuera, 13000);
  expect(mockRuta).toHaveBeenCalledTimes(2);
  expect(mockRuta).toHaveBeenLastCalledWith('t', fuera, C, 'moto');
});

test('al llegar lo dice y «Listo» vuelve atrás', async () => {
  await abrir();
  await leerGps({ lat: C.lat, lng: C.lng - 0.0001 }, 60000);

  expect(textos()).toEqual(expect.arrayContaining(['Llegaste']));
  act(() => boton('Listo').props.onPress());
  expect(goBack).toHaveBeenCalled();
});

test('el cliente puede cambiar a pie: pide la ruta caminando', async () => {
  await abrir({ elegirModo: true });
  mockRuta.mockResolvedValueOnce({ ...RUTA, modo: 'pie', duracion_s: 480 });

  await act(async () => boton('A pie').props.onPress());
  await act(async () => {});

  expect(mockRuta).toHaveBeenLastCalledWith('t', A, C, 'pie');
  expect(textos()).toEqual(expect.arrayContaining(['8 min']));
});

test('el domiciliario no ve la opción de ir a pie', async () => {
  await abrir({ modo: 'moto' });

  expect(textos()).not.toContain('A pie');
});

test('si la ruta no carga, lo explica, deja reintentar y abrir Google Maps', async () => {
  const abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mockRuta.mockRejectedValueOnce(new ApiError('No pudimos trazar la ruta en este momento.', 503));
  await abrir();

  expect(textos()).toEqual(expect.arrayContaining(['Sin ruta', 'No pudimos trazar la ruta en este momento.']));
  // No insiste solo con cada lectura del GPS.
  await leerGps(A, 3000);
  expect(mockRuta).toHaveBeenCalledTimes(1);

  await act(async () => boton('Reintentar').props.onPress());
  await act(async () => {});
  expect(mockRuta).toHaveBeenCalledTimes(2);
  expect(textos()).toContain('Gira a la derecha por la Calle 16');

  act(() => boton('Abrir en Google Maps').props.onPress());
  expect(abrirUrl).toHaveBeenCalledWith(
    `https://www.google.com/maps/dir/?api=1&destination=${C.lat},${C.lng}&travelmode=driving`,
  );
});

test('sin permiso de ubicación lo pide sin buscar la ruta', async () => {
  mockPermiso.mockResolvedValue(false);
  await abrir();

  expect(textos()).toEqual(expect.arrayContaining(['Activa tu ubicación', 'Dar permiso']));
  expect(mockRuta).not.toHaveBeenCalled();
  expect(watch).not.toHaveBeenCalled();
});

test('al salir deja de leer el GPS', async () => {
  await abrir();
  act(() => raiz.unmount());

  expect(clearWatch).toHaveBeenCalledWith(1);
});

test('comoLlegar abre la ruta en la app; solo con la dirección en texto, Google Maps', () => {
  const abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

  comoLlegar(DESTINO, { elegirModo: true });
  expect(navigationRef.navigate).toHaveBeenCalledWith('Ruta', { destino: DESTINO, elegirModo: true });

  comoLlegar('Calle 16 #10-20, Maicao, La Guajira', { modo: 'moto' });
  expect(abrirUrl).toHaveBeenCalledWith(
    'https://www.google.com/maps/dir/?api=1&destination=Calle%2016%20%2310-20%2C%20Maicao%2C%20La%20Guajira&travelmode=driving',
  );
});
