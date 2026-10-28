/**
 * El carrito se guarda en el teléfono por cuenta: al volver a abrir la app
 * sigue ahí, y otra cuenta en el mismo aparato no lo ve.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Producto } from '../src/api';
import { CartProvider, useCart } from '../src/CartContext';

let mockUsuario = 7;
jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: mockUsuario } } }),
}));

const pan: Producto = { id: 10, nombre: 'Pan', descripcion: null, precio: 2000, disponible: true, categoria: null };

/** Monta el provider, espera a que lea lo guardado y expone el carrito. */
async function montar() {
  const api: { current: ReturnType<typeof useCart> } = { current: null as any };
  function Sonda() {
    api.current = useCart();
    return null;
  }
  let raiz: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <CartProvider>
        <Sonda />
      </CartProvider>,
    );
  });
  return { cart: api, desmontar: () => act(() => raiz.unmount()) };
}

beforeEach(async () => {
  mockUsuario = 7;
  await AsyncStorage.clear();
});

test('el carrito sigue ahí al volver a abrir la app', async () => {
  const primera = await montar();
  await act(async () => {
    primera.cart.current.agregar(1, 'Tienda A', pan);
  });
  primera.desmontar();

  const segunda = await montar();
  expect(segunda.cart.current.count).toBe(1);
  expect(segunda.cart.current.negocioNombre).toBe('Tienda A');
});

test('otra cuenta en el mismo teléfono no ve ese carrito', async () => {
  const deAna = await montar();
  await act(async () => {
    deAna.cart.current.agregar(1, 'Tienda A', pan);
  });
  deAna.desmontar();

  mockUsuario = 8;
  const deLuis = await montar();
  expect(deLuis.cart.current.count).toBe(0);
});
