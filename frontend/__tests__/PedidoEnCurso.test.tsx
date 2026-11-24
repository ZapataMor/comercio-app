/**
 * Al abrir la app, el cliente ve arriba el pedido que aún no le llega y vuelve
 * a él de un toque; y el domiciliario sabe a qué barrio va y cuánto cambio
 * llevar antes de tomar un pedido.
 * @format
 */
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { textoCobro, textoEntrega } from '../src/ofertaTextos';

const mockNavigate = jest.fn();
const mockPedidos = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (f: () => void) => require('react').useEffect(() => f(), [f]),
}));
jest.mock('../src/usePolling', () => ({ usePolling: () => {} }));
jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 't' } }) }));
jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), getMisPedidos: (...a: unknown[]) => mockPedidos(...a) }));

import AvisoPedidoEnCurso from '../src/components/AvisoPedidoEnCurso';

const pedido = (id: number, estado: string) => ({ id, codigo: `P${id}`, estado, estado_label: estado, total: 1000, negocio: 'La Fonda', fecha: '' });

async function montar() {
  let raiz!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(<AvisoPedidoEnCurso />);
  });
  return raiz;
}
const textos = (r: ReactTestRenderer.ReactTestRenderer) => r.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

beforeEach(() => jest.clearAllMocks());

test('con un pedido en camino lo muestra y abre su seguimiento', async () => {
  mockPedidos.mockResolvedValue({ items: [pedido(7, 'en_camino'), pedido(3, 'entregado')], pagina: 1, ultima_pagina: 1 });
  const raiz = await montar();

  expect(textos(raiz)).toEqual(expect.arrayContaining(['Tu pedido de La Fonda', 'Va en camino a tu casa']));
  await act(async () => raiz.root.findByProps({ accessibilityRole: 'button' }).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('PedidoDetalle', { id: 7 });
});

test('con varios en curso lleva a Mis pedidos', async () => {
  mockPedidos.mockResolvedValue({ items: [pedido(8, 'pendiente'), pedido(7, 'recogido')], pagina: 1, ultima_pagina: 1 });
  const raiz = await montar();

  expect(textos(raiz)).toContain('Tienes 2 pedidos en curso');
  await act(async () => raiz.root.findByProps({ accessibilityRole: 'button' }).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('MisPedidos');
});

test('sin pedidos en curso no muestra nada', async () => {
  mockPedidos.mockResolvedValue({ items: [pedido(3, 'entregado'), pedido(2, 'cancelado')], pagina: 1, ultima_pagina: 1 });
  const raiz = await montar();
  expect(raiz.toJSON()).toBeNull();
});

test('el pedido disponible dice el barrio y el cambio que hay que llevar', () => {
  expect(textoEntrega({ direccion_entrega: '', barrio_entrega: 'Santa Isabel' })).toBe('Entregar en el barrio Santa Isabel');
  expect(textoEntrega({ direccion_entrega: 'Calle 20 #19-41 - Barrio Santa Isabel', barrio_entrega: 'Santa Isabel' })).toBe(
    'Entregar: Calle 20 #19-41 - Barrio Santa Isabel',
  );
  expect(textoCobro({ cobrar: 43000, paga_con: 50000 })).toBe('Cobrar $43.000 en efectivo. Paga con $50.000: lleva $7.000 de cambio.');
  expect(textoCobro({ cobrar: 43000, paga_con: null })).toBe('Cobrar $43.000 en efectivo (paga con el valor exacto).');
});
