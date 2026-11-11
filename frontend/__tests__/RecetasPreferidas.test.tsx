/**
 * Recetas preferidas: la tienda le recomienda al cliente lo que ya pidió varias
 * veces con los mismos ajustes, y un toque lo agrega tal cual al carrito.
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { getCatalogo, getRecetasPreferidas, Negocio, Producto, RecetaPreferida } from '../src/api';
import NegocioScreen from '../src/screens/NegocioScreen';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }),
}));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getCatalogo: jest.fn(),
  getRecetasPreferidas: jest.fn(),
}));

const mockAgregar = jest.fn((..._args: unknown[]) => true);
jest.mock('../src/CartContext', () => ({ useCart: () => ({ agregar: mockAgregar }) }));

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));

const mockVolar = jest.fn();
jest.mock('../src/components/FlyToCart', () => ({ useFlyToCart: () => ({ volar: mockVolar }) }));
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => jest.fn() }));
jest.mock('../src/usePolling', () => ({
  ...jest.requireActual('../src/usePolling'),
  REFRESCO_NEGOCIOS: 1000,
  useEnVivo: jest.fn(),
  usePolling: jest.fn(),
}));

const mockCatalogo = getCatalogo as jest.Mock;
const mockRecetas = getRecetasPreferidas as jest.Mock;

const hamburguesa = {
  id: 1,
  nombre: 'Hamburguesa',
  precio: 15000,
  atributos: ['Pan', 'Tomate', 'Queso'],
  tipo_producto: { id: 1, nombre: 'Comida', slug: 'comida', atributo_label: 'Ingredientes' },
} as Producto;

const receta: RecetaPreferida = {
  producto: hamburguesa,
  opciones: { sin: ['Tomate'], extra: ['Queso'] },
  veces: 3,
};

let raiz: ReactTestRenderer.ReactTestRenderer;

async function abrirTienda({ activo = true, recetas = [receta] } = {}) {
  mockCatalogo.mockResolvedValue({
    negocio: { id: 9, nombre: 'La Parrilla', activo } as Negocio,
    productos: [hamburguesa],
  });
  mockRecetas.mockResolvedValue(recetas);
  const props = { navigation: { navigate: jest.fn() }, route: { params: { id: 9, nombre: 'La Parrilla' } } };
  await act(async () => {
    raiz = ReactTestRenderer.create(<NegocioScreen {...(props as any)} />);
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

const tocarReceta = () =>
  act(async () => {
    raiz.root
      .find(h => typeof h.props.onPress === 'function' && h.props.accessibilityLabel === 'Agregar Hamburguesa: Sin tomate · Extra queso')
      .props.onPress({ nativeEvent: { pageX: 10, pageY: 20 } });
  });

beforeEach(() => jest.clearAllMocks());

test('muestra la receta con sus ajustes y cuántas veces la ha pedido', async () => {
  await abrirTienda();

  expect(mockRecetas).toHaveBeenCalledWith('t', 9);
  expect(textos()).toContain('Tus recetas preferidas');
  expect(textos()).toContain('Sin tomate · Extra queso');
  expect(textos().join(' ')).toContain('Pedida 3 veces');
});

test('sin recetas la sección no aparece', async () => {
  await abrirTienda({ recetas: [] });

  expect(textos()).not.toContain('Tus recetas preferidas');
});

test('si las recetas no cargan, el catálogo se ve igual', async () => {
  mockCatalogo.mockResolvedValue({ negocio: { id: 9, nombre: 'La Parrilla', activo: true }, productos: [hamburguesa] });
  mockRecetas.mockRejectedValue(new Error('sin red'));
  const props = { navigation: { navigate: jest.fn() }, route: { params: { id: 9, nombre: 'La Parrilla' } } };
  await act(async () => {
    raiz = ReactTestRenderer.create(<NegocioScreen {...(props as any)} />);
  });

  expect(textos()).toContain('Hamburguesa');
  expect(textos()).not.toContain('Tus recetas preferidas');
});

test('un toque la agrega al carrito con los mismos ajustes', async () => {
  await abrirTienda();
  await tocarReceta();

  expect(mockAgregar).toHaveBeenCalledWith(9, 'La Parrilla', hamburguesa, receta.opciones, 1);
  expect(mockVolar).toHaveBeenCalledWith({ x: 10, y: 20 });
});

test('con la tienda cerrada avisa y no agrega', async () => {
  await abrirTienda({ activo: false });
  await tocarReceta();

  expect(mockAgregar).not.toHaveBeenCalled();
  expect(mockToast.info).toHaveBeenCalledWith('Negocio cerrado', expect.any(String));
});
