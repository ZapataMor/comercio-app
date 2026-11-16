/**
 * Formulario de un plato para el comerciante: ingredientes que se pueden quitar
 * o van fijos, y extras con su precio por porción.
 * @format
 */

import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import EditorComida, { DatosComida } from '../src/components/EditorComida';

let raiz: ReactTestRenderer.ReactTestRenderer;
let ultimo: DatosComida | null = null;

function montar(props: Partial<React.ComponentProps<typeof EditorComida>> = {}) {
  act(() => {
    raiz = ReactTestRenderer.create(<EditorComida onChange={d => (ultimo = d)} {...props} />);
  });
}

const tocar = (etiqueta: string) => {
  const nodo = raiz.root.find(n => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === etiqueta);
  act(() => nodo.props.onPress());
};

/** Texto completo de un nodo (los hijos de un <Text> pueden venir partidos). */
const texto = (n: ReactTestRenderer.ReactTestInstance) => [n.props.children].flat(Infinity).join('');

const tocarTexto = (buscado: string) => {
  const nodo = raiz.root.find(
    n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => texto(t) === buscado),
  );
  act(() => nodo.props.onPress());
};

beforeEach(() => {
  ultimo = null;
});

afterEach(() => act(() => raiz?.unmount()));

test('al editar conserva lo guardado: fijos, quitables y extras con precio', () => {
  montar({
    ingredientes: ['Pan', 'Carne', 'Tomate'],
    fijos: ['Pan', 'Carne'],
    extras: [{ nombre: 'Queso', precio: 2500 }],
  });

  tocar('Tomate: se puede quitar');

  expect(ultimo).toEqual({
    ingredientes: ['Pan', 'Carne', 'Tomate'],
    fijos: ['Pan', 'Carne', 'Tomate'],
    extras: [{ nombre: 'Queso', precio: 2500 }],
  });
});

test('un ingrediente nuevo se puede quitar, y una sugerencia agrega un extra que pide su precio', () => {
  montar();

  tocarTexto('+ Añadir ingrediente');
  act(() => raiz.root.findAllByType(TextInput)[0].props.onChangeText('Cebolla'));
  tocarTexto('+ Porción de papas');

  expect(ultimo).toEqual({
    ingredientes: ['Cebolla'],
    fijos: [],
    // Sin precio escrito todavía: el formulario no deja guardar así.
    extras: [{ nombre: 'Porción de papas', precio: null }],
  });

  const precio = raiz.root.findAllByType(TextInput).find(t => t.props.accessibilityLabel === 'Precio de Porción de papas')!;
  act(() => precio.props.onChangeText('3.000'));

  expect(ultimo!.extras).toEqual([{ nombre: 'Porción de papas', precio: 3000 }]);
  // La sugerencia ya usada no se ofrece otra vez.
  expect(raiz.root.findAllByType(Text).filter(t => texto(t) === '+ Porción de papas')).toHaveLength(0);
});
