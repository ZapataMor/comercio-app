/**
 * El comerciante (propietario de algún negocio) arranca en la administración
 * de su negocio, y si tiene varios, en el primero que creó. Quien solo
 * trabaja en negocios ajenos sigue en el último que gestionó.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Negocio, Usuario } from '../src/api';
import { NegocioProvider, useNegocio } from '../src/NegocioContext';
import { rutaInicio } from '../src/RootNavigation';

const mockActualizarUsuario = jest.fn();
let mockAuth: { token: string; user: Usuario };
jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: mockAuth, actualizarUsuario: mockActualizarUsuario }),
}));

let mockLista: Negocio[] = [];
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getMisNegocios: jest.fn(() => Promise.resolve({ negocios: mockLista, codigoPublico: 'U1' })),
}));

function negocio(id: number, nombre: string, rol: 'propietario' | 'trabajador'): Negocio {
  return {
    id,
    nombre,
    rol,
    descripcion: null,
    categoria: null,
    categorias: [],
    direccion: null,
    telefono: null,
    activo: true,
  };
}

function usuario(negocios: Usuario['negocios']): Usuario {
  return { id: 1, name: 'Ana', email: 'ana@demo.co', roles: ['usuario'], negocios };
}

/** Monta el provider (como al abrir la app) y espera a que cargue la lista. */
async function abrirApp() {
  const api: { current: ReturnType<typeof useNegocio> } = { current: null as any };
  function Sonda() {
    api.current = useNegocio();
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(
      <NegocioProvider>
        <Sonda />
      </NegocioProvider>,
    );
  });
  return api;
}

beforeEach(async () => {
  mockActualizarUsuario.mockClear();
  await AsyncStorage.clear();
});

test('con varios negocios arranca en el primero que creó, aunque gestionara otro', async () => {
  // Ordenados por nombre, como los manda el servidor: el primero creado (id 3) no va primero.
  mockLista = [negocio(9, 'Arepas Ana', 'propietario'), negocio(1, 'Ferretería', 'trabajador'), negocio(3, 'Zapatería', 'propietario')];
  mockAuth = { token: 't', user: usuario([]) };
  await AsyncStorage.setItem('negocio_activo', '9');

  const ctx = await abrirApp();
  expect(ctx.current.negocio?.id).toBe(3);
});

test('quien solo trabaja en negocios ajenos sigue en el último que gestionó', async () => {
  mockLista = [negocio(1, 'Ferretería', 'trabajador'), negocio(5, 'Panadería', 'trabajador')];
  mockAuth = { token: 't', user: usuario([]) };
  await AsyncStorage.setItem('negocio_activo', '5');

  const ctx = await abrirApp();
  expect(ctx.current.negocio?.id).toBe(5);
});

test('la sesión recuerda los negocios para decidir la pantalla de inicio', async () => {
  // Creó su negocio después de iniciar sesión: la sesión guardada aún no lo tiene.
  mockLista = [negocio(3, 'Zapatería', 'propietario')];
  mockAuth = { token: 't', user: usuario([]) };
  expect(rutaInicio(mockAuth.user)).toBe('Explorar');

  await abrirApp();
  expect(mockActualizarUsuario).toHaveBeenCalledTimes(1);
  const guardado: Usuario = mockActualizarUsuario.mock.calls[0][0];
  expect(guardado.negocios).toEqual([{ id: 3, nombre: 'Zapatería', rol: 'propietario' }]);
  expect(rutaInicio(guardado)).toBe('Home');
});

test('si la sesión ya los recuerda, no la vuelve a guardar', async () => {
  mockLista = [negocio(3, 'Zapatería', 'propietario')];
  mockAuth = { token: 't', user: usuario([{ id: 3, nombre: 'Zapatería', rol: 'propietario' }]) };

  await abrirApp();
  expect(mockActualizarUsuario).not.toHaveBeenCalled();
});

test('el trabajador sin negocios propios arranca como cliente', () => {
  expect(rutaInicio(usuario([{ id: 1, nombre: 'Ferretería', rol: 'trabajador' }]))).toBe('Explorar');
});

test('el domiciliario arranca en sus entregas, aunque también sea comerciante', () => {
  const domiciliario = { ...usuario([]), roles: ['usuario', 'domiciliario'] };
  expect(rutaInicio(domiciliario)).toBe('Entregas');
  expect(rutaInicio({ ...domiciliario, negocios: [{ id: 3, nombre: 'Zapatería', rol: 'propietario' }] })).toBe('Entregas');
});
