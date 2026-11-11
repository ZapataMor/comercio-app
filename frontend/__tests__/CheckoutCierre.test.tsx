/**
 * Si la tienda está a punto de cerrar, se advierte antes de crear el pedido.
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { crearPedido, getCatalogo, getTarifaDomicilio } from '../src/api';
import { ConfirmacionProvider } from '../src/components/Confirmacion';
import CheckoutScreen from '../src/screens/CheckoutScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PedidoPendienteProvider } from '../src/PedidoPendienteContext';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7, telefono: '3001234567' } }, actualizarUsuario: jest.fn() }),
}));

jest.mock('../src/CartContext', () => ({
  useCart: () => ({
    negocioId: 3,
    negocioNombre: 'Arepas Ana',
    total: 10000,
    items: [{ linea: '1', producto_id: 1, nombre: 'Arepa', precio: 10000, cantidad: 1 }],
    vaciar: jest.fn(),
  }),
}));

const mockDireccion = { id: 1, direccion: 'Calle 1 #2-3', barrio: 'Centro', lat: 11.379, lng: -72.24, fotos: { frente: '/api/frente', izquierda: '/api/izquierda', derecha: '/api/derecha' }, es_principal: true };
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  crearPedido: jest.fn(),
  getCatalogo: jest.fn(),
  getClienteDirecciones: jest.fn(async () => [mockDireccion]),
  getTarifaDomicilio: jest.fn(async () => 4000),
  getPedido: jest.fn(async () => ({ estado: 'pendiente' })),
}));

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));

const mockCrear = crearPedido as jest.Mock;
const mockCatalogo = getCatalogo as jest.Mock;

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar() {
  const navigation = { dispatch: jest.fn() };
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <ConfirmacionProvider>
        <PedidoPendienteProvider>
        <CheckoutScreen navigation={navigation as any} route={{} as any} />
        </PedidoPendienteProvider>
      </ConfirmacionProvider>,
    );
  });
  return navigation;
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

async function tocar(inicio: string) {
  const nodo = raiz.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n.findAll(h => h.children.some(x => typeof x === 'string' && x.startsWith(inicio))).length > 0,
  )[0];
  await act(async () => {
    await nodo.props.onPress();
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockCrear.mockResolvedValue(55);
});

afterEach(() => {
  act(() => raiz.unmount());
});

test('a punto de cerrar advierte y no crea el pedido hasta que el cliente acepte', async () => {
  mockCatalogo.mockResolvedValue({ negocio: { nombre: 'Arepas Ana', minutos_para_cerrar: 8 }, productos: [] });
  const navigation = await montar();

  await tocar('Confirmar pedido');

  expect(mockCrear).not.toHaveBeenCalled();
  expect(textos()).toEqual(
    expect.arrayContaining([
      'La tienda cierra pronto',
      'Arepas Ana cierra en 8 min. Es posible que tu pedido se cancele automáticamente porque la tienda cerrará pronto.',
    ]),
  );

  await tocar('Pedir de todos modos');

  expect(mockCrear).toHaveBeenCalledTimes(1);
  expect(navigation.dispatch).toHaveBeenCalled();
});

test('volver no crea el pedido', async () => {
  mockCatalogo.mockResolvedValue({ negocio: { nombre: 'Arepas Ana', minutos_para_cerrar: 3 }, productos: [] });
  await montar();

  await tocar('Confirmar pedido');
  await tocar('Volver');

  expect(mockCrear).not.toHaveBeenCalled();
});

test('sin cierre cercano no pregunta nada', async () => {
  mockCatalogo.mockResolvedValue({ negocio: { nombre: 'Arepas Ana', minutos_para_cerrar: null }, productos: [] });
  await montar();

  await tocar('Confirmar pedido');

  expect(mockCrear).toHaveBeenCalledTimes(1);
  expect(textos()).not.toContain('La tienda cierra pronto');
});

test('si no se puede consultar la tienda, el pedido sigue', async () => {
  mockCatalogo.mockRejectedValue(new Error('Sin conexión'));
  await montar();

  await tocar('Confirmar pedido');

  expect(mockCrear).toHaveBeenCalledTimes(1);
});

test('si no carga la tarifa, no muestra un total incompleto ni permite confirmar', async () => {
  (getTarifaDomicilio as jest.Mock).mockRejectedValueOnce(new Error('Sin conexión'));
  await montar();
  expect(textos()).toContain('Pendiente de tarifa');
  const botones = raiz.root.findAll(n => n.props.onPress && n.props.disabled === true);
  expect(botones.length).toBeGreaterThan(0);
  await tocar('Confirmar pedido');
  expect(mockCrear).not.toHaveBeenCalled();
});

test('si se pierde la red al confirmar, el formulario desaparece mientras se reintenta el mismo envío', async () => {
  mockCatalogo.mockResolvedValue({ negocio: { nombre: 'Arepas Ana' }, productos: [] });
  mockCrear.mockRejectedValue(new Error('Sin conexión'));
  await montar();
  await tocar('Confirmar pedido');
  expect(textos()).toContain('Enviando tu pedido');
  expect(textos().some(t => t.startsWith('Confirmar pedido'))).toBe(false);
  expect(mockCrear).toHaveBeenCalledTimes(1);
});


test('una dirección antigua sin punto en el mapa obliga a completarla antes de confirmar', async () => {
  const { getClienteDirecciones } = require('../src/api');
  getClienteDirecciones.mockResolvedValueOnce([{ ...mockDireccion, fotos: {}, lat: null }]);
  await montar();
  await tocar('Confirmar pedido');
  expect(mockCrear).not.toHaveBeenCalled();
  expect(textos()).toContain('Completa la dirección y el mapa antes de pedir.');
});

test('por ahora una dirección sin fotos permite confirmar el pedido', async () => {
  const { getClienteDirecciones } = require('../src/api');
  getClienteDirecciones.mockResolvedValueOnce([{ ...mockDireccion, fotos: {} }]);
  mockCrear.mockResolvedValue({ id: 1 });
  await montar();
  await tocar('Confirmar pedido');
  expect(mockCrear).toHaveBeenCalledTimes(1);
});
