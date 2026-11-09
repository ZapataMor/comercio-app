/**
 * La pantalla con la que arranca cada quien, de punta a punta con el navegador
 * real: al abrir la app con la sesión guardada y al iniciar sesión.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { Usuario } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { navigationRef } from '../src/RootNavigation';

let mockSesion: ReturnType<typeof useAuth>;

// Las pantallas no importan aquí: solo dejan a mano la sesión.
function mockPantalla() {
  mockSesion = require('../src/AuthContext').useAuth();
  return null;
}
jest.mock('../src/screens/LoginScreen', () => mockPantalla);
jest.mock('../src/screens/ExplorarScreen', () => mockPantalla);
jest.mock('../src/screens/HomeScreen', () => mockPantalla);
jest.mock('../src/screens/EntregasScreen', () => mockPantalla);

// Sin dispositivo no llegan las medidas de la pantalla y la app no se pintaría.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getMisNegocios: jest.fn(() => new Promise(() => {})),
  registrarDeviceToken: jest.fn().mockResolvedValue(undefined),
  eliminarDeviceToken: jest.fn().mockResolvedValue(undefined),
}));

const NEGOCIO = { id: 3, nombre: 'Zapatería', rol: 'propietario' as const };

function persona(id: number, roles: string[], negocios: Usuario['negocios'] = []): Usuario {
  return { id, name: 'Ana', email: 'ana@demo.co', roles, negocios };
}

const cliente = persona(1, ['usuario']);
const comerciante = persona(2, ['usuario'], [NEGOCIO]);
const domiciliario = persona(3, ['usuario', 'domiciliario']);
const ambos = persona(4, ['usuario', 'domiciliario'], [NEGOCIO]);

const rutaActual = () => navigationRef.getCurrentRoute()?.name;

let app: ReactTestRenderer.ReactTestRenderer | undefined;

/** Hace algo y espera a que el navegador termine de montarse. */
async function yEsperar(accion: () => void) {
  await act(async () => {
    accion();
    await new Promise<void>(listo => setTimeout(listo, 10));
  });
}

const abrirApp = () =>
  yEsperar(() => {
    app = ReactTestRenderer.create(<App />);
  });
const entrar = (user: Usuario) => yEsperar(() => mockSesion.entrar('t', user));
const salir = () => yEsperar(() => mockSesion.salir());

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(async () => {
  await act(async () => app?.unmount());
});

test.each([
  ['el cliente', cliente, 'Explorar'],
  ['el comerciante', comerciante, 'Home'],
  ['el domiciliario', domiciliario, 'Entregas'],
  ['el domiciliario que también es comerciante', ambos, 'Entregas'],
])('%s, al iniciar sesión', async (_quien, user, esperada) => {
  await abrirApp();
  expect(rutaActual()).toBe('Login');

  await entrar(user);
  expect(rutaActual()).toBe(esperada);
});

test.each([
  ['el cliente', cliente, 'Explorar'],
  ['el comerciante', comerciante, 'Home'],
  ['el domiciliario', domiciliario, 'Entregas'],
  ['el domiciliario que también es comerciante', ambos, 'Entregas'],
])('%s, al abrir la app con la sesión guardada', async (_quien, user, esperada) => {
  await AsyncStorage.setItem('sesion', JSON.stringify({ token: 't', user }));

  await abrirApp();
  expect(rutaActual()).toBe(esperada);
});

test('quien entra después de otro no hereda la pantalla de la cuenta anterior', async () => {
  await AsyncStorage.setItem('sesion', JSON.stringify({ token: 't', user: comerciante }));
  await abrirApp();
  expect(rutaActual()).toBe('Home');

  await salir();
  expect(rutaActual()).toBe('Login');

  await entrar(cliente);
  expect(rutaActual()).toBe('Explorar');
});
