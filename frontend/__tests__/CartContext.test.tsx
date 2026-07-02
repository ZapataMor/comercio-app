/**
 * Pruebas del carrito: una sola tienda por carrito, y "reemplazar" que
 * vacía y agrega en un solo paso (cambio de tienda desde la alerta).
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Producto } from '../src/api';
import { CartProvider, useCart } from '../src/CartContext';

function producto(id: number, nombre: string, precio: number): Producto {
  return { id, nombre, descripcion: null, precio, disponible: true, categoria: null };
}

/** Renderiza el provider y expone la API del carrito para el test. */
function montarCarrito() {
  const api: { current: ReturnType<typeof useCart> } = { current: null as any };
  function Sonda() {
    api.current = useCart();
    return null;
  }
  act(() => {
    ReactTestRenderer.create(
      <CartProvider>
        <Sonda />
      </CartProvider>,
    );
  });
  return api;
}

test('agregar suma unidades y calcula count y total', () => {
  const cart = montarCarrito();

  act(() => {
    expect(cart.current.agregar(1, 'Tienda A', producto(10, 'Pan', 2000))).toBe(true);
  });
  act(() => {
    expect(cart.current.agregar(1, 'Tienda A', producto(10, 'Pan', 2000))).toBe(true);
  });
  act(() => {
    expect(cart.current.agregar(1, 'Tienda A', producto(11, 'Leche', 4500))).toBe(true);
  });

  expect(cart.current.count).toBe(3);
  expect(cart.current.total).toBe(2000 * 2 + 4500);
  expect(cart.current.negocioNombre).toBe('Tienda A');
});

test('rechaza productos de otra tienda (carrito = 1 negocio)', () => {
  const cart = montarCarrito();

  act(() => {
    cart.current.agregar(1, 'Tienda A', producto(10, 'Pan', 2000));
  });
  act(() => {
    expect(cart.current.agregar(2, 'Tienda B', producto(20, 'Queso', 8000))).toBe(false);
  });

  expect(cart.current.count).toBe(1);
  expect(cart.current.negocioId).toBe(1);
});

test('reemplazar vacía el carrito y lo deja con el producto nuevo', () => {
  const cart = montarCarrito();

  act(() => {
    cart.current.agregar(1, 'Tienda A', producto(10, 'Pan', 2000));
  });
  act(() => {
    cart.current.reemplazar(2, 'Tienda B', producto(20, 'Queso', 8000));
  });

  expect(cart.current.negocioId).toBe(2);
  expect(cart.current.negocioNombre).toBe('Tienda B');
  expect(cart.current.items).toEqual([
    { producto_id: 20, nombre: 'Queso', precio: 8000, cantidad: 1 },
  ]);
  expect(cart.current.count).toBe(1);
  expect(cart.current.total).toBe(8000);
});
