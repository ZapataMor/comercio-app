/**
 * La barra inferior de Explorar: los tres catálogos, la activa marcada y
 * tocar otra cambia el catálogo.
 * @format
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import BarraCatalogo from '../src/components/BarraCatalogo';

const mockAbrir = jest.fn();
const mockOpciones = () => [];
jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { user: { name: 'Ana' } } }) }));
jest.mock('../src/components/HeaderPerfil', () => ({ useOpcionesPerfil: () => mockOpciones }));
// El menú (y su capa) tiene su propia prueba: aquí solo el botón que lo abre.
let mockMenu: any;
jest.mock('../src/components/MenuDesplegable', () => (props: any) => {
  mockMenu = props;
  return props.boton(false, mockAbrir);
});

async function montar(seccion: 'productos' | 'servicios' | 'propiedades', cambiar = jest.fn()) {
  let raiz!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(<BarraCatalogo seccion={seccion} onCambiar={cambiar} abajo={10} />);
  });
  return raiz;
}

const pestanas = (raiz: ReactTestRenderer.ReactTestRenderer) =>
  raiz.root.findAll(n => typeof n.type !== 'string' && n.props.accessibilityRole === 'tab' && !!n.props.onPress);

test('muestra Productos, Servicios y Propiedades con la actual seleccionada', async () => {
  const raiz = await montar('servicios');
  expect(pestanas(raiz).map(p => p.props.accessibilityLabel)).toEqual(['Productos', 'Servicios', 'Propiedades']);
  expect(pestanas(raiz).filter(p => p.props.accessibilityState.selected).map(p => p.props.accessibilityLabel)).toEqual([
    'Servicios',
  ]);
  act(() => raiz.unmount());
});

test('tocar otra pestaña cambia el catálogo; la activa no hace nada', async () => {
  const cambiar = jest.fn();
  const raiz = await montar('productos', cambiar);
  const tocar = (titulo: string) =>
    act(() => pestanas(raiz).find(p => p.props.accessibilityLabel === titulo)!.props.onPress());

  tocar('Propiedades');
  expect(cambiar).toHaveBeenLastCalledWith('propiedades');
  tocar('Servicios');
  expect(cambiar).toHaveBeenLastCalledWith('servicios');
  tocar('Productos');
  expect(cambiar).toHaveBeenCalledTimes(2);
  act(() => raiz.unmount());
});

test('al final va "Mi perfil" con la inicial, y despliega sus opciones hacia arriba', async () => {
  const raiz = await montar('productos');
  const perfil = raiz.root.find(n => typeof n.type !== 'string' && n.props.accessibilityLabel === 'Mi perfil' && !!n.props.onPress);
  expect(raiz.root.findAll(n => n.props.children === 'A').length).toBeGreaterThan(0);
  act(() => perfil.props.onPress());
  expect(mockAbrir).toHaveBeenCalled();
  expect(mockMenu.renglones).toBe(mockOpciones);
  expect(mockMenu.haciaArriba).toBe(true);
  act(() => raiz.unmount());
});
