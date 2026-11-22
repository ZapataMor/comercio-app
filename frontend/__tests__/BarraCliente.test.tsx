/**
 * Carrito y Mis pedidos son del modo cliente: no salen en el Inicio del
 * comerciante ni en "Mis entregas", aunque la cuenta también sea de cliente.
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import BarraCliente from '../src/components/BarraCliente';

let mockRoles = ['usuario'];
let mockCount = 0;

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { roles: mockRoles } } }),
}));
jest.mock('../src/CartContext', () => ({ useCart: () => ({ count: mockCount }) }));
// Los botones son círculos con solo el ícono: se reconocen por su nombre accesible.
jest.mock('../src/components/FlyToCart', () => ({
  useFlyToCart: () => ({ registrarDestino: () => {}, registrarAterrizaje: () => {} }),
}));

async function textos(ruta: string, seccion?: 'productos' | 'servicios') {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(<BarraCliente ruta={ruta} seccion={seccion} />);
  });
  const vistos = app.root
    .findAll(n => typeof n.type !== 'string' && n.props.accessibilityRole === 'button')
    .map(n => String(n.props.accessibilityLabel).split(',')[0]);
  await act(async () => app.unmount());
  return vistos;
}

beforeEach(() => {
  mockRoles = ['usuario'];
  mockCount = 0;
});

test.each(['Home', 'Entregas', 'Mapa'])('en %s no aparece, aunque la cuenta sea de cliente', async ruta => {
  mockRoles = ['usuario', 'domiciliario'];
  expect(await textos(ruta)).toEqual([]);
});

test.each(['Explorar', 'Negocio'])('en %s aparece', async ruta => {
  expect([...new Set(await textos(ruta))]).toEqual(['Carrito', 'Mis pedidos']);
});

test.each(['Explorar', 'Negocio'])('viendo servicios en %s no aparece', async ruta => {
  expect(await textos(ruta, 'servicios')).toEqual([]);
});

test('en el Seguimiento no va "Mis pedidos", y el Carrito solo si tiene productos', async () => {
  expect(await textos('PedidoDetalle')).toEqual([]);
  mockCount = 2;
  const vistos = await textos('PedidoDetalle');
  expect(vistos).toContain('Carrito');
  expect(vistos).not.toContain('Mis pedidos');
});

test('sin el rol de cliente no aparece', async () => {
  mockRoles = ['administrador'];
  expect(await textos('Explorar')).toEqual([]);
});
