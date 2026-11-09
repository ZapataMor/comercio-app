import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import HeaderCatalogo from '../src/components/HeaderCatalogo';

jest.mock('../src/components/HeaderPerfil', () => () => null);

test('junto al perfil ofrece cambiar al catálogo opuesto', async () => {
  const cambiar = jest.fn();
  let raiz: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { raiz = ReactTestRenderer.create(<HeaderCatalogo seccion="productos" onCambiar={cambiar} />); });
  expect(raiz!.root.findByType(Text).props.children).toBe('Servicios');
  await act(async () => { raiz!.root.findAllByProps({ accessibilityLabel: 'Ver servicios' })[0].props.onPress(); });
  expect(cambiar).toHaveBeenCalledTimes(1);
  await act(async () => { raiz!.update(<HeaderCatalogo seccion="servicios" onCambiar={cambiar} />); });
  expect(raiz!.root.findByType(Text).props.children).toBe('Productos');
  act(() => raiz!.unmount());
});
