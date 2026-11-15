import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import { getMisPedidos, getPedido } from '../src/api';
import MisPedidosScreen from '../src/screens/MisPedidosScreen';
import PedidoDetalleScreen from '../src/screens/PedidoDetalleScreen';
import ErrorCarga from '../src/components/ErrorCarga';
import { reintentarRed } from '../src/red';

const mockAuth = { token: 'token', user: { id: 7 } };
jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../src/usePolling', () => ({ usePolling: jest.fn() }));
jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), getMisPedidos: jest.fn(), getPedido: jest.fn() }));
let root: ReactTestRenderer.ReactTestRenderer;
afterEach(() => { if (root) act(() => root.unmount()); jest.clearAllMocks(); });

test('Mis pedidos distingue una carga fallida de una lista vacía y permite recuperarla', async () => {
  (getMisPedidos as jest.Mock).mockRejectedValueOnce(new Error('Sin internet'))
    .mockResolvedValue({ items: [], pagina: 1, ultima_pagina: 1 });
  await act(async () => { root = ReactTestRenderer.create(<MisPedidosScreen navigation={{} as any} route={{} as any} />); });
  expect(root.root.findByType(ErrorCarga).props.mensaje).toBe('Sin internet');
  expect(root.root.findAllByType(Text).map(t => t.props.children)).not.toContain('Aún no has hecho pedidos.');
  jest.spyOn(NetInfo, 'refresh').mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
  await act(async () => {
    await root.root.findByType(ErrorCarga).findByType(TouchableOpacity).props.onPress();
  });
  expect(getMisPedidos).toHaveBeenCalledTimes(2);
  expect(root.root.findAllByType(ErrorCarga)).toHaveLength(0);
  expect(root.root.findAllByType(Text).map(t => t.props.children)).toContain('Aún no has hecho pedidos.');
});

test('Seguimiento no presenta un fallo de conexión como un pedido inexistente', async () => {
  (getPedido as jest.Mock).mockRejectedValue(new Error('Sin internet'));
  await act(async () => { root = ReactTestRenderer.create(<PedidoDetalleScreen navigation={{} as any} route={{ params: { id: 5 } } as any} />); });
  expect(root.root.findByType(ErrorCarga).props.mensaje).toBe('Sin internet');
  expect(root.root.findAllByType(Text).map(t => t.props.children)).not.toContain('No se encontró el pedido.');
  await act(async () => { await reintentarRed(); });
  expect(getPedido).toHaveBeenCalledTimes(2);
});
