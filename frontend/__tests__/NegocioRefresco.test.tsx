/**
 * La tienda abierta se refresca sola: se recupera si la primera carga falló y,
 * ya cargada, solo pregunta su estado en vez de pedir todo el catálogo.
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { getCatalogo, getEstadoNegocio, getRecetasPreferidas, Negocio, Producto } from '../src/api';
import NegocioScreen from '../src/screens/NegocioScreen';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }),
}));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getCatalogo: jest.fn(),
  getEstadoNegocio: jest.fn(),
  getRecetasPreferidas: jest.fn(async () => []),
}));

jest.mock('../src/Toast', () => ({ useToast: () => ({ exito: jest.fn(), error: jest.fn(), info: jest.fn() }) }));
jest.mock('../src/useAgregarAlCarrito', () => ({ useAgregarAlCarrito: () => jest.fn() }));
jest.mock('../src/components/FlyToCart', () => ({ useFlyToCart: () => ({ volar: jest.fn() }) }));

let refrescar: () => void;
jest.mock('../src/usePolling', () => ({
  REFRESCO_NEGOCIOS: 5000,
  usePolling: (cargar: () => void) => {
    refrescar = cargar;
  },
}));

const mockCatalogo = getCatalogo as jest.Mock;
const mockEstado = getEstadoNegocio as jest.Mock;
const mockRecetas = getRecetasPreferidas as jest.Mock;

const negocio = { id: 3, nombre: 'Asadero', categorias: [], activo: true, horario_hoy: null } as unknown as Negocio;
const productos = [{ id: 1, nombre: 'Pollo asado', precio: 20000, categoria: null }] as unknown as Producto[];

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar() {
  const props = { navigation: { navigate: jest.fn() }, route: { params: { id: 3, nombre: 'Asadero' } } };
  await act(async () => {
    raiz = ReactTestRenderer.create(<NegocioScreen {...(props as any)} />);
  });
}

async function tick() {
  await act(async () => {
    refrescar();
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

beforeEach(() => jest.clearAllMocks());

afterEach(() => {
  act(() => raiz.unmount());
});

test('si la primera carga falla, el refresco la reintenta y la pantalla se recupera', async () => {
  mockCatalogo.mockRejectedValueOnce(new Error('No se pudo conectar con el servidor.'));
  await montar();
  expect(textos()).toContain('No se pudo conectar con el servidor.');

  mockCatalogo.mockRejectedValueOnce(new Error('No se pudo conectar con el servidor.'));
  await tick();
  expect(textos()).toContain('No se pudo conectar con el servidor.');
  expect(mockEstado).not.toHaveBeenCalled();

  mockCatalogo.mockResolvedValueOnce({ negocio, productos });
  await tick();

  expect(textos()).not.toContain('No se pudo conectar con el servidor.');
  expect(textos()).toContain('Pollo asado');
  // Las recomendaciones también se habían perdido con la primera carga.
  expect(mockRecetas).toHaveBeenCalledTimes(2);
});

test('ya cargada, solo pregunta el estado y conserva los productos', async () => {
  mockCatalogo.mockResolvedValue({ negocio, productos });
  await montar();
  expect(mockCatalogo).toHaveBeenCalledTimes(1);

  mockEstado.mockResolvedValueOnce({ activo: false, horario_hoy: 'Hoy no abre' });
  await tick();

  expect(mockCatalogo).toHaveBeenCalledTimes(1);
  expect(mockEstado).toHaveBeenCalledWith('t', 3);
  expect(textos()).toContain('Cerrado');
  expect(textos()).toContain('Hoy no abre');
  expect(textos()).toContain('Pollo asado');
});

test('si el estado falla, lo que se ve no cambia', async () => {
  mockCatalogo.mockResolvedValue({ negocio, productos });
  await montar();

  mockEstado.mockRejectedValueOnce(new Error('x'));
  await tick();

  expect(textos()).toContain('Abierto');
  expect(textos()).toContain('Pollo asado');
});
