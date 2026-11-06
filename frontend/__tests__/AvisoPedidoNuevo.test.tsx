/**
 * El aviso de pedido nuevo: solo sale al aceptar o rechazar (o si ya no hay nada
 * que decidir), y al aceptar lleva a la información del pedido.
 * @format
 */

import React from 'react';
import { Modal, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { detenerAlarma, PedidoEnEspera } from '../src/alarmaPedidos';
import { aceptarPedido, cancelarPedidoNegocio, getPedidoNegocio } from '../src/api';
import AvisoPedidoNuevo from '../src/components/AvisoPedidoNuevo';
import { navigationRef } from '../src/RootNavigation';

jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }) }));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  aceptarPedido: jest.fn(),
  cancelarPedidoNegocio: jest.fn(),
  getPedidoNegocio: jest.fn(),
}));

jest.mock('../src/alarmaPedidos', () => ({ detenerAlarma: jest.fn(async () => {}) }));

jest.mock('../src/RootNavigation', () => ({
  navigationRef: { isReady: () => true, dispatch: jest.fn() },
}));

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));

const mockAceptar = aceptarPedido as jest.Mock;
const mockRechazar = cancelarPedidoNegocio as jest.Mock;
const mockPedido = getPedidoNegocio as jest.Mock;
const irA = navigationRef.dispatch as jest.Mock;

const pedido = (id: number, segundos = 272): PedidoEnEspera => ({
  id,
  codigo: `K7M2X9${id}`,
  negocio_id: 3,
  negocio: 'Arepas Ana',
  total: 25000,
  segundos,
  vence: Date.now() + segundos * 1000,
});

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar(pedidos: PedidoEnEspera[]) {
  await act(async () => {
    raiz = ReactTestRenderer.create(<AvisoPedidoNuevo pedidos={pedidos} />);
  });
}

async function actualizar(pedidos: PedidoEnEspera[]) {
  await act(async () => {
    raiz.update(<AvisoPedidoNuevo pedidos={pedidos} />);
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
const avisoVisible = () => raiz.root.findAllByType(Modal)[0].props.visible;

async function tocar(texto: string) {
  const nodo = raiz.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAll(h => h.children.includes(texto)).length > 0,
  )[0];
  await act(async () => {
    nodo.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAceptar.mockResolvedValue(undefined);
  mockRechazar.mockResolvedValue(undefined);
  mockPedido.mockResolvedValue({ motivos_cancelacion: ['Sin producto'] });
});

afterEach(() => {
  act(() => raiz.unmount());
});

test('sin pedidos no se ve nada', async () => {
  await montar([]);
  expect(avisoVisible()).toBe(false);
});

test('muestra el pedido, su negocio, el total y lo que le queda', async () => {
  await montar([pedido(12)]);

  expect(avisoVisible()).toBe(true);
  expect(textos()).toEqual(
    expect.arrayContaining(['¡Nuevo pedido!', 'Pedido #K7M2X912 · Arepas Ana', '$25.000', 'Vence en 4:32']),
  );
});

test('el botón atrás de Android no lo cierra', async () => {
  await montar([pedido(12)]);

  act(() => raiz.root.findAllByType(Modal)[0].props.onRequestClose());

  expect(avisoVisible()).toBe(true);
});

test('al aceptar sale, calla la alarma y abre la información del pedido', async () => {
  await montar([pedido(12)]);

  await tocar('Aceptar pedido');

  expect(mockAceptar).toHaveBeenCalledWith('t', 3, 12);
  expect(detenerAlarma).toHaveBeenCalledWith(12);
  expect(avisoVisible()).toBe(false);
  expect(irA).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'PUSH',
      payload: { name: 'ComercioPedidoDetalle', params: { pedidoId: 12, negocioId: 3 } },
    }),
  );
});

test('si no se pudo aceptar sigue en pantalla, dice por qué y no navega', async () => {
  mockAceptar.mockRejectedValue(new Error('Ese pedido ya no está en espera.'));
  await montar([pedido(12)]);

  await tocar('Aceptar pedido');

  expect(avisoVisible()).toBe(true);
  expect(textos()).toContain('Ese pedido ya no está en espera.');
  expect(irA).not.toHaveBeenCalled();
});

test('al rechazar pide el motivo y entonces sale, sin navegar', async () => {
  await montar([pedido(12)]);

  await tocar('Rechazar');
  expect(avisoVisible()).toBe(true);
  expect(mockRechazar).not.toHaveBeenCalled();

  await tocar('Sin producto');
  await tocar('Rechazar pedido');

  expect(mockRechazar).toHaveBeenCalledWith('t', 3, 12, 'Sin producto');
  expect(detenerAlarma).toHaveBeenCalledWith(12);
  expect(avisoVisible()).toBe(false);
  expect(irA).not.toHaveBeenCalled();
});

test('volver desde el motivo deja el aviso abierto', async () => {
  await montar([pedido(12)]);

  await tocar('Rechazar');
  await tocar('Volver');

  expect(avisoVisible()).toBe(true);
  expect(mockRechazar).not.toHaveBeenCalled();
});

test('al atender uno aparece el siguiente, y dice cuántos esperan', async () => {
  await montar([pedido(12), pedido(13)]);
  expect(textos()).toContain('Hay 1 pedido más esperando');

  await tocar('Aceptar pedido');

  expect(avisoVisible()).toBe(true);
  expect(textos()).toContain('Pedido #K7M2X913 · Arepas Ana');
  expect(textos()).not.toContain('Hay 1 pedido más esperando');
});

test('una consulta que llega tarde no devuelve lo que ya se atendió', async () => {
  const p = pedido(12);
  await montar([p]);
  await tocar('Aceptar pedido');

  await actualizar([p]);

  expect(avisoVisible()).toBe(false);
});

test('sale solo si el servidor ya no lo trae: otro lo atendió o venció', async () => {
  await montar([pedido(12)]);

  await actualizar([]);

  expect(avisoVisible()).toBe(false);
});

test('al acabarse el tiempo sale sin esperar al servidor', async () => {
  jest.useFakeTimers();
  try {
    await montar([pedido(12, 2)]);
    expect(avisoVisible()).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(avisoVisible()).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});
