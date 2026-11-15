import React from 'react';
import { Text, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import HeaderCatalogo from '../src/components/HeaderCatalogo';
import { OpcionMenu } from '../src/components/MenuDesplegable';

jest.mock('../src/components/HeaderPerfil', () => () => null);
// El menú abierto se pinta en la capa de la app: aquí, sus renglones a la vista
// y elegir corre la acción en el acto (sin la animación de recogerse).
jest.mock('../src/components/MenuDesplegable', () => {
  const actual = jest.requireActual('../src/components/MenuDesplegable');
  const { Text: T, View: V } = jest.requireActual('react-native');
  return {
    ...actual,
    __esModule: true,
    default: (props: any) => (
      <V>
        <T testID="boton">{props.texto}</T>
        {props.renglones((accion: () => void) => accion())}
      </V>
    ),
  };
});

async function montar(seccion: 'productos' | 'servicios' | 'propiedades', cambiar = jest.fn()) {
  let raiz: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(<HeaderCatalogo seccion={seccion} onCambiar={cambiar} />);
  });
  return raiz!;
}

const opciones = (raiz: ReactTestRenderer.ReactTestRenderer) => raiz.root.findAllByType(OpcionMenu);

test('el botón dice el catálogo actual y despliega Productos, Servicios y Propiedades', async () => {
  const raiz = await montar('productos');
  expect(raiz.root.findByProps({ testID: 'boton' }).props.children).toBe('Productos');
  expect(opciones(raiz).map(o => o.props.titulo)).toEqual(['Productos', 'Servicios', 'Propiedades']);
  expect(opciones(raiz).find(o => o.props.activa)!.props.titulo).toBe('Productos');
  act(() => raiz.unmount());
});

test('elegir otra opción cambia el catálogo; la misma no hace nada', async () => {
  const cambiar = jest.fn();
  const raiz = await montar('servicios', cambiar);
  expect(raiz.root.findByProps({ testID: 'boton' }).props.children).toBe('Servicios');

  await act(async () => opciones(raiz).find(o => o.props.titulo === 'Propiedades')!.props.onPress());
  expect(cambiar).toHaveBeenLastCalledWith('propiedades');
  await act(async () => opciones(raiz).find(o => o.props.titulo === 'Productos')!.props.onPress());
  expect(cambiar).toHaveBeenLastCalledWith('productos');
  await act(async () => opciones(raiz).find(o => o.props.titulo === 'Servicios')!.props.onPress());
  expect(cambiar).toHaveBeenCalledTimes(2);
  act(() => raiz.unmount());
});

test('en Propiedades el botón lo muestra', async () => {
  const raiz = await montar('propiedades');
  expect(raiz.root.findByProps({ testID: 'boton' }).props.children).toBe('Propiedades');
  expect(raiz.root.findAllByType(View).length).toBeGreaterThan(0);
  expect(raiz.root.findAllByType(Text).some(t => t.props.children === 'Casas en venta, alquiler y patios')).toBe(true);
  act(() => raiz.unmount());
});
