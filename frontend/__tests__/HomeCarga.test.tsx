/**
 * Al entrar, el comerciante no ve el Inicio de quien no tiene negocios mientras
 * llega su lista: espera con un indicador hasta que aparecen sus accesos.
 * @format
 */

import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Usuario } from '../src/api';
import HomeScreen from '../src/screens/HomeScreen';

const NEGOCIO = { id: 3, nombre: 'Asadero', rol: 'propietario' as const };

let mockUsuario: Usuario;
const mockContexto: { negocio: unknown; negocios: unknown[]; recargar: jest.Mock } = {
  negocio: null,
  negocios: [],
  recargar: jest.fn(),
};
let refrescar: () => void;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: () => {},
}));
jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: mockUsuario } }),
}));
jest.mock('../src/NegocioContext', () => ({ useNegocio: () => mockContexto }));
jest.mock('../src/Toast', () => ({ useToast: () => ({ exito: jest.fn(), error: jest.fn(), info: jest.fn() }) }));
jest.mock('../src/usePolling', () => ({
  usePolling: (cargar: () => void) => {
    refrescar = cargar;
  },
}));
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getPedidosComercio: jest.fn(async () => []),
}));

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar(negocios: Usuario['negocios']) {
  mockUsuario = { id: 1, name: 'Asadero', email: 'a@demo.co', roles: ['usuario'], negocios };
  const props = { navigation: { setOptions: jest.fn(), navigate: jest.fn() } };
  await act(async () => {
    raiz = ReactTestRenderer.create(<HomeScreen {...(props as any)} />);
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
const cargando = () => raiz.root.findAll(n => n.type === ActivityIndicator).length > 0;

beforeEach(() => {
  jest.clearAllMocks();
  mockContexto.negocio = null;
  mockContexto.negocios = [];
});

afterEach(() => {
  act(() => raiz.unmount());
});

test('mientras llega la lista, el comerciante espera y no ve el acceso de cliente', async () => {
  await montar([NEGOCIO]);

  expect(cargando()).toBe(true);
  expect(textos()).not.toContain('Explorar negocios');
});

test('si la lista no llegó, el refresco la pide de nuevo', async () => {
  await montar([NEGOCIO]);

  await act(async () => {
    refrescar();
  });

  expect(mockContexto.recargar).toHaveBeenCalledTimes(1);
});

test('con la lista cargada se ven sus accesos, sin indicador', async () => {
  mockContexto.negocio = NEGOCIO;
  mockContexto.negocios = [NEGOCIO];
  await montar([NEGOCIO]);

  expect(cargando()).toBe(false);
  expect(textos()).toEqual(expect.arrayContaining(['Mi negocio', 'Productos', 'Pedidos y ventas', 'Equipo']));
});

test('quien no tiene negocios sigue viendo Explorar, sin esperar nada', async () => {
  await montar([]);

  expect(cargando()).toBe(false);
  expect(textos()).toContain('Explorar negocios');
});
