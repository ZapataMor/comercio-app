/**
 * Reseñas públicas: lo que escribe el cliente en su pedido y lo que se ve en
 * el catálogo.
 * @format
 */

import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { getResenas, resenarPedido, SeguimientoPedido } from '../src/api';
import ResenarPedido from '../src/components/ResenarPedido';
import { PuntajeResenas, ResenasDeProducto } from '../src/components/Resenas';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }),
}));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getResenas: jest.fn(),
  resenarPedido: jest.fn(async () => '¡Gracias!'),
}));

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));

const mockResenar = resenarPedido as jest.Mock;
const mockGetResenas = getResenas as jest.Mock;

let raiz: ReactTestRenderer.ReactTestRenderer;

function pedido(cambios: Partial<SeguimientoPedido> = {}) {
  return {
    id: 5,
    negocio: 'La Espiga',
    puede_resenar: true,
    resenas: {
      tienda: null,
      productos: [
        { producto_id: 1, nombre: 'Pan', imagen: null, estrellas: null, comentario: null },
        { producto_id: 2, nombre: 'Café', imagen: null, estrellas: null, comentario: null },
      ],
      hasta: '06/12/2026',
    },
    ...cambios,
  } as SeguimientoPedido;
}

async function montar(el: React.ReactElement) {
  await act(async () => {
    raiz = ReactTestRenderer.create(el);
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

/** Toca la nota `n` en el selector de `etiqueta`. */
async function estrellas(etiqueta: string, n: number) {
  const nodo = raiz.root.findAll(
    h => typeof h.props.onPress === 'function' && String(h.props.accessibilityLabel ?? '').startsWith(`${etiqueta}: ${n} de 5`),
  )[0];
  await act(async () => {
    nodo.props.onPress();
  });
}

function boton(texto: string) {
  return raiz.root.findAll(
    h => typeof h.props.onPress === 'function' && h.findAll(x => x.children.includes(texto)).length > 0,
  )[0];
}

async function tocar(texto: string) {
  await act(async () => {
    boton(texto).props.onPress();
  });
}

beforeEach(() => jest.clearAllMocks());

afterEach(() => {
  act(() => raiz.unmount());
});

test('no publica sin estrellas y deja por fuera lo que aún no se probó', async () => {
  await montar(<ResenarPedido pedido={pedido()} onGuardado={jest.fn()} />);
  expect(boton('Publicar reseña').props.disabled).toBe(true);

  await estrellas('Pan', 4);
  await act(async () => {
    raiz.root.findByType(TextInput).props.onChangeText('  Muy rico  ');
  });
  await tocar('Publicar reseña');

  expect(mockResenar).toHaveBeenCalledWith('t', 5, {
    tienda: undefined,
    productos: [{ producto_id: 1, estrellas: 4, comentario: 'Muy rico' }],
  });
});

test('el comentario solo se pide después de elegir estrellas', async () => {
  await montar(<ResenarPedido pedido={pedido()} onGuardado={jest.fn()} />);
  expect(raiz.root.findAllByType(TextInput)).toHaveLength(0);

  await estrellas('La tienda · La Espiga', 5);

  expect(raiz.root.findAllByType(TextInput)).toHaveLength(1);
  expect(textos()).toContain('Excelente');
});

test('lo publicado se resume y se puede completar', async () => {
  const conResena = pedido();
  conResena.resenas!.productos[0].estrellas = 5;
  conResena.resenas!.productos[0].comentario = 'Delicioso';

  await montar(<ResenarPedido pedido={conResena} onGuardado={jest.fn()} />);
  expect(textos()).toContain('Tu reseña');
  expect(textos()).toContain('Delicioso');

  await tocar('Completar o corregir');
  expect(textos()).toContain('Cuéntale a otros clientes');

  // Corregir reenvía también lo que ya estaba escrito.
  await estrellas('Café', 3);
  await tocar('Publicar reseña');
  expect(mockResenar.mock.calls[0][2].productos).toEqual([
    { producto_id: 1, estrellas: 5, comentario: 'Delicioso' },
    { producto_id: 2, estrellas: 3, comentario: null },
  ]);
});

test('vencido el plazo se ve lo publicado, sin poder corregirlo', async () => {
  const vencido = pedido({ puede_resenar: false });
  vencido.resenas!.tienda = { estrellas: 4, comentario: null };

  await montar(<ResenarPedido pedido={vencido} onGuardado={jest.fn()} />);

  expect(textos()).toContain('Tu reseña');
  expect(textos().join(' ')).not.toContain('corregir');
});

test('un pedido sin reseñas que mostrar no pinta nada', async () => {
  await montar(<ResenarPedido pedido={pedido({ puede_resenar: false, resenas: null })} onGuardado={jest.fn()} />);
  expect(raiz.toJSON()).toBeNull();
});

test('si no se puede publicar, avisa y deja intentarlo de nuevo', async () => {
  mockResenar.mockRejectedValueOnce(new Error('Sin conexión'));
  const onGuardado = jest.fn();
  await montar(<ResenarPedido pedido={pedido()} onGuardado={onGuardado} />);

  await estrellas('Pan', 2);
  await tocar('Publicar reseña');

  expect(mockToast.error).toHaveBeenCalledWith('No se pudo publicar', 'Sin conexión');
  expect(onGuardado).not.toHaveBeenCalled();
  expect(boton('Publicar reseña').props.disabled).toBe(false);
});

test('el puntaje usa coma decimal y se oculta sin reseñas', async () => {
  await montar(<PuntajeResenas resenas={{ promedio: 4.5, total: 12 }} />);
  expect(textos()).toEqual(['4,5', '(12)']);
  act(() => raiz.unmount());

  await montar(<PuntajeResenas resenas={{ promedio: null, total: 0 }} />);
  expect(raiz.toJSON()).toBeNull();
  act(() => raiz.unmount());

  await montar(<PuntajeResenas resenas={{ promedio: null, total: 0 }} conVacio />);
  expect(textos()).toEqual(['Sin reseñas todavía']);
});

test('el detalle del producto muestra tres reseñas y lleva a las demás', async () => {
  const items = [1, 2, 3, 4].map(id => ({ id, autor: `Cliente ${id}`, estrellas: 5, comentario: null, fecha: '01/11/2026' }));
  mockGetResenas.mockResolvedValueOnce({
    resumen: { promedio: 5, total: 4 }, items, pagina: 1, ultima_pagina: 1,
  });
  const onVerTodas = jest.fn();

  await montar(<ResenasDeProducto negocioId={3} productoId={9} onVerTodas={onVerTodas} />);

  expect(mockGetResenas).toHaveBeenCalledWith('t', 3, { productoId: 9 });
  expect(textos().filter(t => t.startsWith('Cliente'))).toHaveLength(3);
  await tocar('Ver las 4 reseñas');
  expect(onVerTodas).toHaveBeenCalled();
});

test('si las reseñas del producto fallan no estorban', async () => {
  mockGetResenas.mockRejectedValueOnce(new Error('x'));
  await montar(<ResenasDeProducto negocioId={3} productoId={9} onVerTodas={jest.fn()} />);
  expect(raiz.toJSON()).toBeNull();
});
