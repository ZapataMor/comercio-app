import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError, identidadDe } from '../src/api';
import VerificarTelefono, { formatoCelular } from '../src/components/VerificarTelefono';

let pantalla: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  if (pantalla) await act(async () => pantalla.unmount());
});

function textos(): string {
  return pantalla.root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');
}
async function escribir(label: string, valor: string) {
  await act(async () => {
    pantalla.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === label)!.props.onChangeText(valor);
  });
}
async function tocar(texto: string) {
  const boton = pantalla.root
    .findAllByType(TouchableOpacity)
    .find(b => b.findAllByType(Text).some(t => [].concat(t.props.children).join('').includes(texto)));
  await act(async () => {
    await boton!.props.onPress();
  });
}

test('pide el código, muestra el de prueba y confirma con el número limpio', async () => {
  const pedir = jest.fn(async () => ({ message: 'ok', espera: 60, codigo_prueba: '482913' }));
  const verificar = jest.fn(async () => {});
  await act(async () => {
    pantalla = ReactTestRenderer.create(<VerificarTelefono pedir={pedir} verificar={verificar} />);
  });

  await escribir('Número de celular', '300-123 4567');
  await tocar('Enviar código por WhatsApp');
  expect(pedir).toHaveBeenCalledWith('3001234567');
  expect(textos()).toContain('300 123 4567');
  expect(textos()).toContain('482913');
  expect(textos()).toContain('Reenviar en 60 s');

  await escribir('Código de 6 números', '48a2913');
  await tocar('Confirmar');
  expect(verificar).toHaveBeenCalledWith('3001234567', '482913');
});

test('no envía con un número inválido y muestra el error del código', async () => {
  const pedir = jest.fn(async () => ({ message: 'ok' }));
  const verificar = jest.fn(async () => {
    throw new ApiError('El código no es correcto.', 422, { codigo: ['El código no es correcto.'] });
  });
  await act(async () => {
    pantalla = ReactTestRenderer.create(<VerificarTelefono pedir={pedir} verificar={verificar} />);
  });

  await escribir('Número de celular', '6051234567');
  await tocar('Enviar código por WhatsApp');
  expect(pedir).not.toHaveBeenCalled();
  expect(textos()).toContain('empezar por 3');

  await escribir('Número de celular', '3001234567');
  await tocar('Enviar código por WhatsApp');
  await escribir('Código de 6 números', '111111');
  await tocar('Confirmar');
  expect(textos()).toContain('El código no es correcto.');
});

test('al recuperar la contraseña distingue celular de correo', () => {
  expect(identidadDe('3001234567')).toEqual({ telefono: '3001234567' });
  expect(identidadDe('+57 300 123 4567')).toEqual({ telefono: '3001234567' });
  expect(identidadDe(' ana@correo.com ')).toEqual({ email: 'ana@correo.com' });
  expect(formatoCelular('3001234567')).toBe('300 123 4567');
});
