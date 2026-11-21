/**
 * Devolución de una transferencia: el cliente la pide con su cuenta y
 * confirma si llegó; el negocio la marca devuelta con el monto sugerido.
 * @format
 */

import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ReembolsoPedido } from '../src/api';
import { ConfirmacionProvider } from '../src/components/Confirmacion';
import { DevolucionCliente, DevolucionNegocio } from '../src/components/Devolucion';

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  solicitarReembolso: jest.fn(async () => 'Devolución solicitada.'),
  responderReembolso: jest.fn(async () => 'Listo.'),
  responderReembolsoNegocio: jest.fn(async () => 'Listo.'),
}));
jest.mock('../src/portapapeles', () => ({ copiarTexto: jest.fn(async () => true) }));

const api = jest.requireMock('../src/api');

const base: ReembolsoPedido = {
  estado: null, cuenta: null, monto_sugerido: 14000, regla_mitad: false, monto: null, comprobante: null, motivo: null,
  solicitado_at: null, devuelto_at: null, rechazado_at: null, respondido_at: null,
  puede_rechazar: false, puede_solicitar: true, puede_cambiar_cuenta: false,
};

let raiz: ReactTestRenderer.ReactTestRenderer;
const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join('')).join(' ');

async function tocar(texto: string) {
  const nodo = raiz.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAll(h => h.children.includes(texto)).length > 0,
  ).pop();
  if (!nodo) throw new Error(`No hay botón «${texto}»`);
  await act(async () => {
    nodo.props.onPress();
  });
}

async function montar(el: React.ReactElement) {
  await act(async () => {
    raiz = ReactTestRenderer.create(<ConfirmacionProvider>{el}</ConfirmacionProvider>);
  });
}

afterEach(() => {
  act(() => raiz.unmount());
  jest.clearAllMocks();
});

test('el cliente que pagó pide la devolución indicando a dónde', async () => {
  const onCambio = jest.fn();
  await montar(<DevolucionCliente token="t" pedidoId={9} negocio="Tienda" pagoEstado="informado" reembolso={base} onCambio={onCambio} />);
  expect(textos()).toContain('Pide que te devuelvan $14.000');

  await act(async () => {
    raiz.root.findByType(TextInput).props.onChangeText('Nequi 3005556677');
  });
  await tocar('Solicitar devolución');
  expect(api.solicitarReembolso).toHaveBeenCalledWith('t', 9, 'Nequi 3005556677');
  expect(onCambio).toHaveBeenCalled();
});

test('si no alcanzó a pagar, no se le cobra nada pero puede pedirla si sí transfirió', async () => {
  await montar(<DevolucionCliente token="t" pedidoId={9} negocio="Tienda" pagoEstado="por_pagar" reembolso={base} onCambio={jest.fn()} />);
  expect(textos()).toContain('no se te cobra nada');
  expect(raiz.root.findAllByType(TextInput)).toHaveLength(0);
  await tocar('¿Sí transferiste? Pide la devolución');
  expect(raiz.root.findAllByType(TextInput)).toHaveLength(1);
});

test('devuelta: el cliente dice si le llegó', async () => {
  const r: ReembolsoPedido = { ...base, estado: 'devuelto', monto: 14000, cuenta: 'Nequi 3005556677', devuelto_at: '2026-11-21T10:00:00Z', puede_solicitar: false };
  await montar(<DevolucionCliente token="t" pedidoId={9} negocio="Tienda" pagoEstado="confirmado" reembolso={r} onCambio={jest.fn()} />);
  expect(textos()).toContain('Tienda dice que te devolvió $14.000');
  await tocar('No me ha llegado');
  expect(api.responderReembolso).toHaveBeenCalledWith('t', 9, false);
});

test('el negocio ve a dónde devolver y lo marca devuelto con el monto sugerido', async () => {
  const r: ReembolsoPedido = { ...base, estado: 'solicitado', cuenta: 'Nequi 3005556677', regla_mitad: true, monto_sugerido: 5000, puede_solicitar: false, puede_cambiar_cuenta: true };
  await montar(<DevolucionNegocio token="t" negocioId={4} pedidoId={9} reembolso={r} onCambio={jest.fn()} />);
  const todo = textos();
  expect(todo).toContain('Debes devolverle el dinero al cliente');
  expect(todo).toContain('la mitad de los productos, $5.000');
  expect(todo).toContain('Nequi 3005556677');
  // Confirmó el pago: no puede decir que no le llegó.
  expect(todo).not.toContain('No recibí ese pago');

  await tocar('Marcar como devuelto');
  await tocar('Sí, ya lo devolví');
  expect(api.responderReembolsoNegocio).toHaveBeenCalledWith('t', 4, 9, { estado: 'devuelto', monto: 5000, comprobanteUri: null });
});
