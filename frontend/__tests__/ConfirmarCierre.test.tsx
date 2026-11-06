/**
 * La pregunta al dueño antes del cierre automático: "sí" deja todo igual y "no"
 * pide la hora de ese día en el mismo modal.
 * @format
 */

import React from 'react';
import { AppState, Modal, Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { confirmarCierre, getCierresPorConfirmar } from '../src/api';
import ConfirmarCierre from '../src/components/ConfirmarCierre';

jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }) }));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  confirmarCierre: jest.fn(),
  getCierresPorConfirmar: jest.fn(),
}));

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));

const mockLista = getCierresPorConfirmar as jest.Mock;
const mockConfirmar = confirmarCierre as jest.Mock;

const cierre = { id: 3, nombre: 'Arepas Ana', cierra_texto: '8:00 p. m.', segundos: 1100 };

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar() {
  await act(async () => {
    raiz = ReactTestRenderer.create(<ConfirmarCierre />);
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
const visible = () => raiz.root.findByType(Modal).props.visible;

async function tocar(texto: string) {
  const nodo = raiz.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAll(h => h.children.includes(texto)).length > 0,
  )[0];
  await act(async () => {
    nodo.props.onPress();
  });
}

async function escribirHora(valor: string) {
  await act(async () => {
    raiz.root.findByType(TextInput).props.onChangeText(valor);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = 'active';
  mockConfirmar.mockResolvedValue(undefined);
  mockLista.mockResolvedValue([cierre]);
});

afterEach(() => {
  act(() => raiz.unmount());
});

test('sin cierres por confirmar no se ve nada', async () => {
  mockLista.mockResolvedValue([]);
  await montar();
  expect(visible()).toBe(false);
});

test('pregunta por la hora del horario y el botón atrás no lo cierra', async () => {
  await montar();

  expect(textos()).toContain('¿Cierras a las 8:00 p. m.?');
  act(() => raiz.root.findByType(Modal).props.onRequestClose());
  expect(visible()).toBe(true);
});

test('"sí" confirma sin hora y cierra el modal', async () => {
  await montar();

  await tocar('Sí, cierro a esa hora');

  expect(mockConfirmar).toHaveBeenCalledWith('t', 3, null);
  expect(visible()).toBe(false);
});

test('"no" pide la hora en el mismo modal y la guarda solo para hoy', async () => {
  await montar();

  await tocar('No, cerraré a otra hora');
  expect(visible()).toBe(true);
  expect(mockConfirmar).not.toHaveBeenCalled();

  await escribirHora('2130');
  expect(textos().join(' ')).toContain('Hoy cierra a las 9:30 p. m.');
  expect(textos().join(' ')).toContain('tu horario automático no cambia');

  await tocar('Guardar hora');

  expect(mockConfirmar).toHaveBeenCalledWith('t', 3, '21:30');
  expect(visible()).toBe(false);
});

test('no deja guardar una hora mal escrita', async () => {
  await montar();
  await tocar('No, cerraré a otra hora');

  await escribirHora('25');

  const boton = raiz.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAll(h => h.children.includes('Guardar hora')).length > 0,
  )[0];
  expect(boton.props.disabled).toBe(true);
});

test('si el servidor rechaza la hora sigue abierto y dice por qué', async () => {
  mockConfirmar.mockRejectedValue(new Error('Esa hora ya pasó.'));
  await montar();
  await tocar('No, cerraré a otra hora');
  await escribirHora('2130');

  await tocar('Guardar hora');

  expect(visible()).toBe(true);
  expect(textos()).toContain('Esa hora ya pasó.');
});

test('volver regresa a la pregunta', async () => {
  await montar();
  await tocar('No, cerraré a otra hora');

  await tocar('Volver');

  expect(textos()).toContain('Sí, cierro a esa hora');
});
