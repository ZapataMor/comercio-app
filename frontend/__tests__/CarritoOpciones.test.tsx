/**
 * Pruebas de las opciones del carrito: cada combinación es su propia línea,
 * se pueden personalizar solo algunas unidades, y quitar deja la línea 3
 * segundos en cuenta regresiva antes de que desaparezca.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Producto } from '../src/api';
import { CartProvider, DURACION_RETIRO, useCart } from '../src/CartContext';
import { detalleOpciones } from '../src/opcionesProducto';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }),
}));

const hamburguesa: Producto = {
  id: 1,
  nombre: 'Hamburguesa',
  descripcion: null,
  precio: 15000,
  disponible: true,
  categoria: null,
  atributos: ['Pan', 'Lechuga', 'Tomate', 'Queso'],
  tipo_producto: { id: 1, nombre: 'Comida', slug: 'comida', atributo_label: 'Ingredientes' },
};

const camisa: Producto = {
  id: 2,
  nombre: 'Camisa',
  descripcion: null,
  precio: 40000,
  disponible: true,
  categoria: null,
  atributos: ['S', 'M'],
  colores: ['Negro', 'Blanco'],
  tipo_producto: { id: 4, nombre: 'Ropa y calzado', slug: 'ropa-y-calzado', atributo_label: 'Tallas disponibles' },
};

async function montar() {
  const api: { current: ReturnType<typeof useCart> } = { current: null as any };
  function Sonda() {
    api.current = useCart();
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(
      <CartProvider>
        <Sonda />
      </CartProvider>,
    );
  });
  return api;
}

const lineaDe = (cart: { current: ReturnType<typeof useCart> }, i = 0) => cart.current.lineas[i].linea;

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

test('la línea guarda lo que se puede elegir de ese producto', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });

  expect(cart.current.items[0].ingredientes).toEqual(hamburguesa.atributos);
  expect(cart.current.items[0].tallas).toEqual([]);
  expect(cart.current.items[1].tallas).toEqual(['S', 'M']);
  expect(cart.current.items[1].colores).toEqual(['Negro', 'Blanco']);
  expect(cart.current.items[1].ingredientes).toEqual([]);
});

test('el mismo producto con otra talla es otra línea; con la misma, suma', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'S', color: 'Negro' });
  });
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' }, 2);
  });

  expect(cart.current.items.map(i => i.cantidad)).toEqual([3, 1]);
  expect(cart.current.count).toBe(4);
});

test('personalizar toda la línea la deja en su sitio', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });
  act(() => {
    cart.current.personalizar(lineaDe(cart), { sin: ['Tomate'], extra: ['Queso'] });
  });

  expect(cart.current.items[0].producto_id).toBe(1);
  expect(detalleOpciones(cart.current.items[0].opciones)).toBe('Sin tomate · Extra queso');
});

test('personalizar solo algunas unidades las separa en otra línea', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa, undefined, 3);
  });
  act(() => {
    cart.current.personalizar(lineaDe(cart), { sin: ['Lechuga'] }, 1);
  });

  expect(cart.current.items.map(i => i.cantidad)).toEqual([2, 1]);
  expect(cart.current.items[0].opciones).toBeUndefined();
  expect(cart.current.items[1].opciones).toEqual({ sin: ['Lechuga'] });
  expect(cart.current.total).toBe(45000);
});

test('al quedar igual a otra línea, se juntan', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa, { sin: ['Tomate'] });
  });
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });
  act(() => {
    cart.current.personalizar(lineaDe(cart, 1), { sin: ['Tomate'] });
  });

  expect(cart.current.items).toHaveLength(1);
  expect(cart.current.items[0].cantidad).toBe(2);
});

test('bajar de 1 no borra la línea: sale cuando acaba la cuenta regresiva', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });

  act(() => {
    cart.current.cambiar(lineaDe(cart), -1);
  });

  // Sigue en pantalla, pero ya no cuenta ni se pediría.
  expect(cart.current.lineas).toHaveLength(1);
  expect(cart.current.lineas[0].saleEn).toBeDefined();
  expect(cart.current.items).toHaveLength(0);
  expect(cart.current.count).toBe(0);
  expect(cart.current.total).toBe(0);

  act(() => {
    jest.advanceTimersByTime(DURACION_RETIRO - 1);
  });
  expect(cart.current.lineas).toHaveLength(1);

  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(cart.current.lineas).toHaveLength(0);
});

test('la cuenta regresiva dura 3 segundos', () => {
  expect(DURACION_RETIRO).toBe(3000);
});

test('tocar + durante la cuenta regresiva conserva la línea', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });
  act(() => {
    cart.current.cambiar(lineaDe(cart), -1);
  });
  act(() => {
    jest.advanceTimersByTime(2000);
  });

  act(() => {
    cart.current.cambiar(lineaDe(cart), 1);
  });
  expect(cart.current.items).toHaveLength(1);
  expect(cart.current.items[0].cantidad).toBe(1);

  // El temporizador viejo ya no la toca.
  act(() => {
    jest.advanceTimersByTime(DURACION_RETIRO);
  });
  expect(cart.current.items).toHaveLength(1);
});

test('una línea salvada que se vuelve a quitar espera sus 3 segundos completos', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });
  act(() => {
    cart.current.cambiar(lineaDe(cart), -1);
  });
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  act(() => {
    cart.current.cambiar(lineaDe(cart), 1);
  });
  act(() => {
    cart.current.cambiar(lineaDe(cart), -1);
  });

  // A los 3 s del primer intento sigue ahí: cuenta el segundo.
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(cart.current.lineas).toHaveLength(1);

  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(cart.current.lineas).toHaveLength(0);
});

test('agregar desde el catálogo una línea que está saliendo la recupera', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });
  act(() => {
    cart.current.cambiar(lineaDe(cart), -1);
  });
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });

  expect(cart.current.items).toHaveLength(1);
  expect(cart.current.items[0].cantidad).toBe(1);
});

test('una línea que sale de otra tienda no estorba para pedir en una nueva', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda A', hamburguesa);
  });
  act(() => {
    cart.current.cambiar(lineaDe(cart), -1);
  });

  act(() => {
    expect(cart.current.agregar(2, 'Tienda B', camisa, { talla: 'M', color: 'Negro' })).toBe(true);
  });

  expect(cart.current.lineas).toHaveLength(1);
  expect(cart.current.lineas[0].producto_id).toBe(2);
  expect(cart.current.negocioId).toBe(2);
});

test('lo que está saliendo no se guarda en el teléfono', async () => {
  const cart = await montar();
  await act(async () => {
    cart.current.agregar(1, 'Tienda', hamburguesa);
  });
  await act(async () => {
    cart.current.cambiar(lineaDe(cart), -1);
  });

  const guardado = JSON.parse((await AsyncStorage.getItem('carrito:7')) as string);
  expect(guardado.items).toEqual([]);
});

test('un carrito guardado antes de las opciones sigue funcionando', async () => {
  await AsyncStorage.setItem(
    'carrito:7',
    JSON.stringify({
      negocioId: 1,
      negocioNombre: 'Tienda',
      items: [{ producto_id: 5, nombre: 'Pan', precio: 2000, cantidad: 2 }],
    }),
  );
  const cart = await montar();

  expect(cart.current.count).toBe(2);
  act(() => {
    cart.current.cambiar(lineaDe(cart), 1);
  });
  expect(cart.current.count).toBe(3);
});
