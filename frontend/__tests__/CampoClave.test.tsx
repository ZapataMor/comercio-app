/**
 * El ojo de los campos de contraseña (registro, recuperar la contraseña y
 * Mi información): muestra y oculta lo escrito sin perder los estilos.
 * @format
 */

import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import CampoClave from '../src/components/CampoClave';

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar(elemento: React.ReactElement) {
  await act(async () => {
    raiz = ReactTestRenderer.create(elemento);
  });
}

const campo = () => raiz.root.findByType(TextInput);
const ojo = (etiqueta: string) =>
  raiz.root.findAll(n => n.props.accessibilityLabel === etiqueta && typeof n.props.onPress === 'function')[0];

afterEach(async () => {
  await act(async () => raiz.unmount());
});

test('el ojo muestra y oculta la contraseña', async () => {
  const onChangeText = jest.fn();
  await montar(<CampoClave value="secreta" onChangeText={onChangeText} placeholder="Contraseña" />);
  expect(campo().props.secureTextEntry).toBe(true);
  expect(campo().props.placeholder).toBe('Contraseña');

  await act(async () => ojo('Mostrar contraseña').props.onPress());
  expect(campo().props.secureTextEntry).toBe(false);

  await act(async () => ojo('Ocultar contraseña').props.onPress());
  expect(campo().props.secureTextEntry).toBe(true);

  campo().props.onChangeText('otra');
  expect(onChangeText).toHaveBeenCalledWith('otra');
});

test('los márgenes del estilo pasan al contenedor y el campo deja lugar al ojo', async () => {
  await montar(<CampoClave style={[{ marginBottom: 16, paddingHorizontal: 14, fontSize: 16 }, { marginTop: 4 }]} />);
  const estiloCampo = StyleSheet.flatten(campo().props.style);
  expect(estiloCampo).toMatchObject({ paddingHorizontal: 14, fontSize: 16, paddingRight: 48 });
  expect(estiloCampo.marginBottom).toBeUndefined();
  expect(estiloCampo.marginTop).toBeUndefined();

  const contenedor = raiz.root.findAllByType(View)[0];
  expect(StyleSheet.flatten(contenedor.props.style)).toMatchObject({ marginBottom: 16, marginTop: 4 });
});
