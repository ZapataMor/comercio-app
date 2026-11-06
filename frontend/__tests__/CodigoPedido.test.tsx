/**
 * El campo del código, normal y en su versión compacta para las tarjetas.
 * @format
 */

import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PedirCodigo } from '../src/components/CodigoPedido';

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar(onConfirmar: (codigo: string) => Promise<void>, compacto = true) {
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <PedirCodigo compacto={compacto} titulo="Código" ayuda={compacto ? undefined : 'Ayuda'} textoBoton="Confirmar" onConfirmar={onConfirmar} />,
    );
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

async function escribir(v: string) {
  await act(async () => {
    raiz.root.findByType(TextInput).props.onChangeText(v);
  });
}

async function confirmar() {
  const nodo = raiz.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAll(h => h.children.includes('Confirmar')).length > 0,
  )[0];
  await act(async () => {
    nodo.props.onPress();
  });
}

afterEach(() => {
  act(() => raiz.unmount());
});

test('compacto no lleva ayuda, deja solo dígitos y envía el código', async () => {
  const onConfirmar = jest.fn(async () => {});
  await montar(onConfirmar);
  expect(textos()).not.toContain('Ayuda');

  await escribir('48a21');
  await confirmar();

  expect(onConfirmar).toHaveBeenCalledWith('4821');
});

test('compacto pide los 4 dígitos sin llamar al servidor', async () => {
  const onConfirmar = jest.fn(async () => {});
  await montar(onConfirmar);

  await escribir('48');
  await confirmar();

  expect(onConfirmar).not.toHaveBeenCalled();
  expect(textos()).toContain('Escribe los 4 dígitos del código.');
});

test('un código incorrecto se muestra en el mismo campo', async () => {
  await montar(async () => {
    throw new Error('Ese no es el código del domiciliario.');
  });

  await escribir('4821');
  await confirmar();

  expect(textos()).toContain('Ese no es el código del domiciliario.');
});

test('el normal sigue mostrando su ayuda', async () => {
  await montar(jest.fn(async () => {}), false);
  expect(textos()).toContain('Ayuda');
});
