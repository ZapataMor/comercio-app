/**
 * Pruebas de las opciones del carrito: cada combinación es su propia línea,
 * se pueden personalizar solo algunas unidades, el + pregunta cómo quiere la
 * unidad nueva si hay algo que elegir, y quitar deja la línea 3 segundos en
 * cuenta regresiva antes de que desaparezca.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Producto } from '../src/api';
import { CartProvider, DURACION_RETIRO, useCart } from '../src/CartContext';
import { detalleOpciones } from '../src/opcionesProducto';
import CarritoScreen from '../src/screens/CarritoScreen';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar(pantalla?: React.ReactNode) {
  const api: { current: ReturnType<typeof useCart> } = { current: null as any };
  function Sonda() {
    api.current = useCart();
    return null;
  }
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <CartProvider>
        <Sonda />
        {pantalla}
      </CartProvider>,
    );
  });
  return api;
}

const lineaDe = (cart: { current: ReturnType<typeof useCart> }, i = 0) => cart.current.lineas[i].linea;

const montarCarrito = () =>
  montar(<CarritoScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);

/** Toca el primer elemento con esa etiqueta o que contenga ese texto. */
function tocar(buscar: { texto?: string; etiqueta?: string }) {
  const nodo = raiz.root.findAll(n => {
    if (typeof n.props.onPress !== 'function') return false;
    if (buscar.etiqueta) return n.props.accessibilityLabel === buscar.etiqueta;
    return n.findAll(h => h.children.includes(buscar.texto as string)).length > 0;
  })[0];
  act(() => {
    nodo.props.onPress();
  });
}

const hojaAbierta = () => raiz.root.findAll(n => n.children.includes('Agregar')).length > 0;

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
});

afterEach(() => {
  act(() => raiz?.unmount());
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

test('sumar una unidad con las mismas opciones cae en su línea', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });
  act(() => {
    cart.current.sumarUnidad(lineaDe(cart), { talla: 'M', color: 'Negro' });
  });

  expect(cart.current.items).toHaveLength(1);
  expect(cart.current.items[0].cantidad).toBe(2);
});

test('sumar una unidad con otras opciones crea su línea y no toca la anterior', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });
  act(() => {
    cart.current.sumarUnidad(lineaDe(cart), { talla: 'S', color: 'Blanco' });
  });

  expect(cart.current.items.map(i => i.cantidad)).toEqual([1, 1]);
  expect(cart.current.items[1].opciones).toEqual({ talla: 'S', color: 'Blanco' });
  expect(cart.current.items[1].tallas).toEqual(['S', 'M']);
  expect(cart.current.count).toBe(2);
  expect(cart.current.total).toBe(80000);
});

test('sumar una unidad igual a otra línea se junta con ella', async () => {
  const cart = await montar();
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'S', color: 'Negro' });
  });
  act(() => {
    cart.current.sumarUnidad(lineaDe(cart), { talla: 'S', color: 'Negro' });
  });

  expect(cart.current.items.map(i => i.cantidad)).toEqual([1, 2]);
});

test('el + de una línea con talla o color pregunta antes de sumar', async () => {
  const cart = await montarCarrito();
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });

  tocar({ etiqueta: 'Agregar una unidad' });
  expect(hojaAbierta()).toBe(true);
  expect(cart.current.count).toBe(1);

  tocar({ texto: 'S' });
  tocar({ texto: 'Agregar' });

  expect(hojaAbierta()).toBe(false);
  expect(cart.current.items.map(i => i.opciones?.talla)).toEqual(['M', 'S']);
  expect(cart.current.count).toBe(2);
});

test('cancelar la pregunta del + no suma nada', async () => {
  const cart = await montarCarrito();
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });

  tocar({ etiqueta: 'Agregar una unidad' });
  tocar({ texto: 'Cancelar' });

  expect(hojaAbierta()).toBe(false);
  expect(cart.current.count).toBe(1);
});

test('el + de la comida también pregunta y parte de lo que trae la línea', async () => {
  const cart = await montarCarrito();
  act(() => {
    cart.current.agregar(1, 'Tienda', hamburguesa, { sin: ['Tomate'] });
  });

  tocar({ etiqueta: 'Agregar una unidad' });
  tocar({ texto: 'Agregar' });

  expect(cart.current.items).toHaveLength(1);
  expect(cart.current.items[0].cantidad).toBe(2);
  expect(cart.current.items[0].opciones).toEqual({ sin: ['Tomate'] });
});

test('sin nada que elegir el + suma directo', async () => {
  const unica: Producto = { ...camisa, id: 3, atributos: ['Única'], colores: ['Negro'] };
  const cart = await montarCarrito();
  act(() => {
    cart.current.agregar(1, 'Tienda', unica, { talla: 'Única', color: 'Negro' });
  });

  tocar({ etiqueta: 'Agregar una unidad' });

  expect(hojaAbierta()).toBe(false);
  expect(cart.current.items).toHaveLength(1);
  expect(cart.current.items[0].cantidad).toBe(2);
});

test('tocar + para conservar una línea que sale no pregunta', async () => {
  const cart = await montarCarrito();
  act(() => {
    cart.current.agregar(1, 'Tienda', camisa, { talla: 'M', color: 'Negro' });
  });
  act(() => {
    cart.current.cambiar(lineaDe(cart), -1);
  });

  tocar({ etiqueta: 'Agregar una unidad' });

  expect(hojaAbierta()).toBe(false);
  expect(cart.current.items).toHaveLength(1);
  expect(cart.current.items[0].cantidad).toBe(1);
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

test('un carrito antiguo sin fecha de vencimiento se descarta', async () => {
  await AsyncStorage.setItem(
    'carrito:7',
    JSON.stringify({
      negocioId: 1,
      negocioNombre: 'Tienda',
      items: [{ producto_id: 5, nombre: 'Pan', precio: 2000, cantidad: 2 }],
    }),
  );
  const cart = await montar();

  expect(cart.current.count).toBe(0);
});
