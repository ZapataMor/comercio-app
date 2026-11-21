/**
 * Pago por transferencia: el cliente elige la cuenta, copia el número y
 * avisa que pagó; el negocio ve que debe revisar su banco antes de confirmar.
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { CuentaPago, PagoCliente, PagoNegocio } from '../src/api';
import { PagarTransferencia, RevisarPago } from '../src/components/PagoTransferencia';

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  informarPago: jest.fn(async () => 'Le avisamos al negocio.'),
  revisarPago: jest.fn(async () => 'Listo.'),
}));
jest.mock('../src/portapapeles', () => ({ copiarTexto: jest.fn(async () => true) }));

const api = jest.requireMock('../src/api');
const { copiarTexto } = jest.requireMock('../src/portapapeles');

const nequi: CuentaPago = { id: 1, tipo: 'nequi', nombre: 'Nequi', banco: null, numero: '300 111 2233', tipo_cuenta: null, titular: 'Tienda SAS', qr: null };
const banco: CuentaPago = { id: 2, tipo: 'bancolombia', nombre: 'Bancolombia', banco: null, numero: '123456789', tipo_cuenta: 'ahorros', titular: 'Tienda SAS', qr: null };

const base = { cuenta: null, comprobante: null, informado_at: null, confirmado_at: null, no_llego_at: null };

let raiz: ReactTestRenderer.ReactTestRenderer;

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

async function tocar(texto: string) {
  const nodo = raiz.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAll(h => h.children.includes(texto)).length > 0,
  ).pop();
  if (!nodo) throw new Error(`No hay botón «${texto}»`);
  await act(async () => {
    nodo.props.onPress();
  });
}

afterEach(() => {
  act(() => raiz.unmount());
  jest.clearAllMocks();
});

async function montarCliente(pago: PagoCliente, estado = 'aceptado') {
  const onEnviado = jest.fn();
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <PagarTransferencia token="t" pedidoId={9} estado={estado} total={13000} negocio="Tienda" pago={pago} onEnviado={onEnviado} />,
    );
  });
  return onEnviado;
}

test('antes de que acepten no muestra cuentas: pide no transferir todavía', async () => {
  await montarCliente({ ...base, estado: 'por_pagar', cuentas: [], puede_informar: false }, 'pendiente');
  expect(textos().join(' ')).toContain('No transfieras antes');
  expect(textos()).not.toContain('Ya pagué');
});

test('elige la cuenta, copia el número sin espacios y avisa que pagó', async () => {
  const onEnviado = await montarCliente({ ...base, estado: 'por_pagar', cuentas: [nequi, banco], puede_informar: true });
  expect(textos()).toContain('A nombre de Tienda SAS');

  // Con dos cuentas no adivina: hay que elegir una.
  await tocar('Ya pagué');
  expect(api.informarPago).not.toHaveBeenCalled();

  await tocar('Bancolombia');
  await tocar('Copiar');
  expect(copiarTexto).toHaveBeenLastCalledWith('123456789');

  await tocar('Ya pagué');
  expect(api.informarPago).toHaveBeenCalledWith('t', 9, 2, null);
  expect(onEnviado).toHaveBeenCalled();
});

test('si el negocio no la encuentra, lo dice y deja volver a avisar', async () => {
  await montarCliente({ ...base, estado: 'no_llego', cuentas: [nequi], puede_informar: true });
  expect(textos().join(' ')).toContain('aún no ve tu transferencia');
  await tocar('Ya pagué');
  expect(api.informarPago).toHaveBeenCalledWith('t', 9, 1, null);
});

test('el negocio ve que revisar su banco es su responsabilidad y puede decir que no llegó', async () => {
  const pago: PagoNegocio = { ...base, estado: 'informado', cuenta: nequi, puede_confirmar: true };
  const onRevisado = jest.fn();
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <RevisarPago token="t" negocioId={4} pedidoId={9} estado="aceptado" total={13000} pago={pago} onRevisado={onRevisado} />,
    );
  });
  const todo = textos().join(' ');
  expect(todo).toContain('El cliente dice que ya pagó');
  expect(todo).toContain('Es tu responsabilidad revisar en tu app del banco');

  await tocar('No me ha llegado');
  expect(api.revisarPago).toHaveBeenCalledWith('t', 4, 9, 'no_llego');
  expect(onRevisado).toHaveBeenCalled();
});
