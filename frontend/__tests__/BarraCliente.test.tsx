/**
 * Carrito y Mis pedidos son del modo cliente: no salen en el Inicio del
 * comerciante ni en "Mis entregas", aunque la cuenta también sea de cliente.
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import BarraCliente from '../src/components/BarraCliente';

let mockRoles = ['usuario'];

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { roles: mockRoles } } }),
}));
jest.mock('../src/CartContext', () => ({ useCart: () => ({ count: 0 }) }));
jest.mock('../src/components/FlyToCart', () => ({
  useFlyToCart: () => ({ registrarDestino: () => {}, registrarAterrizaje: () => {} }),
}));

async function textos(ruta: string) {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(<BarraCliente ruta={ruta} />);
  });
  const vistos = app.root.findAllByType(Text).map(t => t.props.children);
  await act(async () => app.unmount());
  return vistos;
}

beforeEach(() => {
  mockRoles = ['usuario'];
});

test.each(['Home', 'Entregas', 'Mapa'])('en %s no aparece, aunque la cuenta sea de cliente', async ruta => {
  mockRoles = ['usuario', 'domiciliario'];
  expect(await textos(ruta)).toEqual([]);
});

test.each(['Explorar', 'Negocio', 'PedidoDetalle'])('en %s aparece', async ruta => {
  expect(await textos(ruta)).toEqual(expect.arrayContaining(['Carrito', 'Mis pedidos']));
});

test('sin el rol de cliente no aparece', async () => {
  mockRoles = ['administrador'];
  expect(await textos('Explorar')).toEqual([]);
});
