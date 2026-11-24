/**
 * Ficha del producto en modal: ingredientes con Sin / Con (los fijos no se
 * tocan), extras que suben el precio al instante y, al sumar unidades de un
 * plato ya modificado, la pregunta de si la siguiente va igual. Si no, cada
 * versión queda en su pestaña numerada y se agrega o se cancela por separado.
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Producto } from '../src/api';
import FichaProducto from '../src/components/FichaProducto';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  // Las reseñas no son parte de esto: se quedan cargando.
  getResenas: jest.fn(() => new Promise(() => {})),
}));

const mockAgregar = jest.fn((..._args: unknown[]) => true);
jest.mock('../src/CartContext', () => ({ useCart: () => ({ agregar: mockAgregar, negocioNombre: null }) }));

const mockVolar = jest.fn();
jest.mock('../src/components/FlyToCart', () => ({ useFlyToCart: () => ({ volar: mockVolar }) }));

const mockConfirmar = jest.fn();
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));

const hamburguesa = {
  id: 1,
  nombre: 'Hamburguesa',
  descripcion: null,
  precio: 15000,
  disponible: true,
  categoria: null,
  atributos: ['Pan', 'Carne', 'Tomate', 'Cebolla'],
  ingredientes_fijos: ['Pan', 'Carne'],
  extras: [
    { nombre: 'Salsa', precio: 0 },
    { nombre: 'Porción de papas', precio: 3000 },
  ],
  tipo_producto: { id: 1, nombre: 'Comida', slug: 'comida', atributo_label: 'Ingredientes' },
} as Producto;

let raiz: ReactTestRenderer.ReactTestRenderer;
const onCerrar = jest.fn();

function abrir(producto: Producto = hamburguesa, conVersiones = true) {
  act(() => {
    raiz = ReactTestRenderer.create(
      <FichaProducto
        conVersiones={conVersiones}
        producto={producto}
        retirado={false}
        abierto
        negocioId={9}
        negocioNombre="La Parrilla"
        onCerrar={onCerrar}
        onVerResenas={jest.fn()}
      />,
    );
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

const conEtiqueta = (etiqueta: string) =>
  raiz.root.findAll(n => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === etiqueta);

function tocar(etiqueta: string) {
  const [nodo] = conEtiqueta(etiqueta);
  if (!nodo) throw new Error(`No hay nada con la etiqueta "${etiqueta}"`);
  act(() => {
    nodo.props.onPress({ nativeEvent: { pageX: 100, pageY: 500 } });
  });
}

/** Toca el botón que contiene ese texto (Agregar, Sí, No...). */
function tocarTexto(inicio: string) {
  const nodo = raiz.root.find(
    n =>
      typeof n.props.onPress === 'function' &&
      n.findAllByType(Text).some(t => [t.props.children].flat(Infinity).join('').startsWith(inicio)),
  );
  act(() => {
    nodo.props.onPress({ nativeEvent: { pageX: 100, pageY: 500 } });
  });
}

const botonAgregar = () => textos().find(t => t.startsWith('Agregar · '));
const pestanas = () => raiz.root.findAll(n => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function');

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => raiz?.unmount());
  jest.useRealTimers();
});

test('muestra foto, nombre, ingredientes y extras en ese orden, y los fijos sin Sin / Con', () => {
  abrir();

  const t = textos();
  expect(t.indexOf('Hamburguesa')).toBeLessThan(t.indexOf('Ingredientes'));
  expect(t.indexOf('Ingredientes')).toBeLessThan(t.indexOf('Extras'));
  expect(t).toContain('Siempre va');
  expect(conEtiqueta('Carne: Sin')).toHaveLength(0);
  expect(conEtiqueta('Tomate: Sin')).toHaveLength(1);
  expect(t).toContain('+ $3.000');
  expect(t).toContain('Gratis');
});

test('cada porción de un extra sube el precio en el modal', () => {
  abrir();
  expect(botonAgregar()).toBe('Agregar · $15.000');

  tocar('Agregar una porción de Porción de papas');
  tocar('Agregar una porción de Porción de papas');

  expect(textos()).toContain('$21.000');
  expect(textos()).toContain('$15.000 + $6.000 de extras');
  expect(botonAgregar()).toBe('Agregar · $21.000');
});

test('con las versiones apagadas (así viene la app), + suma otra igual sin preguntar ni abrir pestañas', () => {
  abrir(hamburguesa, false);
  tocar('Cebolla: Sin');
  tocar('Agregar una unidad');

  expect(textos()).not.toContain('¿La siguiente igual?');
  expect(pestanas()).toHaveLength(0);
  expect(botonAgregar()).toBe('Agregar · $30.000');
  tocarTexto('Agregar · ');
  expect(mockAgregar).toHaveBeenLastCalledWith(
    9,
    'La Parrilla',
    hamburguesa,
    { talla: undefined, color: undefined, sin: ['Cebolla'], extras: [] },
    2,
  );
});

test('sin cambios, + suma una unidad sin preguntar', () => {
  abrir();
  tocar('Agregar una unidad');

  expect(textos()).not.toContain('¿La siguiente igual?');
  expect(botonAgregar()).toBe('Agregar · $30.000');
});

test('con cambios, + pregunta si la siguiente va igual; sí suma una unidad más', () => {
  abrir();
  tocar('Cebolla: Sin');
  tocar('Agregar una unidad');

  expect(textos()).toContain('¿La siguiente igual?');
  expect(textos()).toContain('Sin cebolla');

  tocarTexto('Sí, con los mismos cambios');

  expect(textos()).not.toContain('¿La siguiente igual?');
  expect(botonAgregar()).toBe('Agregar · $30.000');
  expect(pestanas()).toHaveLength(0);
});

test('si la siguiente va distinta, cada versión queda en su pestaña con su cantidad', () => {
  abrir();
  tocar('Cebolla: Sin');
  tocar('Agregar una unidad');
  tocarTexto('Sí, con los mismos cambios');
  tocar('Agregar una unidad');
  tocarTexto('No, la armo distinta');

  // La 2 empieza como viene el plato.
  expect(pestanas()).toHaveLength(2);
  expect(textos()).toContain('Versión 2 · Como viene');
  expect(botonAgregar()).toBe('Agregar · $15.000');

  tocar('Agregar una porción de Porción de papas');
  tocar('Versión 1: 2 Sin cebolla');

  // La 1 conserva sus cambios y sus dos unidades.
  expect(textos()).toContain('Versión 1 · Sin cebolla');
  expect(botonAgregar()).toBe('Agregar · $30.000');
  expect(conEtiqueta('Versión 2: 1 Extras: porción de papas')).toHaveLength(1);
});

test('agregar una versión la manda al carrito y quita su pestaña; con la última se cierra', () => {
  abrir();
  tocar('Cebolla: Sin');
  tocar('Agregar una unidad');
  tocarTexto('No, la armo distinta');
  tocar('Agregar una porción de Porción de papas');

  tocarTexto('Agregar · ');

  expect(mockAgregar).toHaveBeenLastCalledWith(
    9,
    'La Parrilla',
    hamburguesa,
    { talla: undefined, color: undefined, sin: [], extras: [{ nombre: 'Porción de papas', cantidad: 1, precio: 3000 }] },
    1,
  );
  expect(mockVolar).toHaveBeenCalledWith({ x: 100, y: 500 });
  expect(pestanas()).toHaveLength(1);
  expect(textos()).toContain('Versión 1 · Sin cebolla');

  tocarTexto('Agregar · ');
  expect(mockAgregar).toHaveBeenLastCalledWith(
    9,
    'La Parrilla',
    hamburguesa,
    { talla: undefined, color: undefined, sin: ['Cebolla'], extras: [] },
    1,
  );
  act(() => jest.runAllTimers());
  expect(onCerrar).toHaveBeenCalled();
});

test('cancelar una versión la descarta sin agregarla', () => {
  abrir();
  tocar('Tomate: Sin');
  tocar('Agregar una unidad');
  tocarTexto('No, la armo distinta');

  tocar('Cancelar la versión 2');

  expect(mockAgregar).not.toHaveBeenCalled();
  expect(pestanas()).toHaveLength(1);
  expect(textos()).toContain('Versión 1 · Sin tomate');
});

test('salir con versiones sin agregar pregunta antes de descartarlas', () => {
  abrir();
  tocar('Tomate: Sin');
  tocar('Agregar una unidad');
  tocarTexto('No, la armo distinta');

  tocar('Cerrar');

  expect(mockConfirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: '¿Salir sin agregarlas?' }));
  expect(onCerrar).not.toHaveBeenCalled();
});
