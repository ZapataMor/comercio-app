import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import MiTiendaScreen from '../src/screens/MiTiendaScreen';
import { DropdownMultiple } from '../src/components/Dropdown';
import BarrioSelect from '../src/components/BarrioSelect';
import CamposDireccion from '../src/components/CamposDireccion';
import { PressableScale } from '../src/components/anim';
import { ApiError } from '../src/api';

const mockCrear = jest.fn();
const mockNavigate = jest.fn();
// El aviso «¿Salir sin guardar?» escucha cuando se sale de la pantalla.
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => ({ addListener: () => () => {}, dispatch: jest.fn() }) }));
jest.mock('../src/NegocioContext', () => ({ useNegocio: () => ({ negocio: null, cargando: false, crear: mockCrear }) }));
jest.mock('../src/Toast', () => ({ useToast: () => ({ exito: jest.fn(), error: jest.fn() }) }));
jest.mock('../src/components/SelectorImagen', () => () => null);
jest.mock('../src/components/SelectorUbicacion', () => () => null);
jest.mock('../src/components/BarrioSelect', () => () => null);
jest.mock('../src/components/CamposDireccion', () => () => null);
jest.mock('../src/components/Dropdown', () => ({ DropdownMultiple: () => null }));
jest.mock('../src/components/EditorHorario', () => ({ __esModule: true, default: () => null, errorHorario: () => null, DIAS: [] }));

let pantalla: Renderer.ReactTestRenderer;
const contiene = (texto: string) => pantalla.root.findAllByType(Text).some(t => t.props.children === texto);
async function tocar(texto: string) {
  const boton = [...pantalla.root.findAllByType(PressableScale), ...pantalla.root.findAllByType(TouchableOpacity)]
    .find(b => b.findAllByType(Text).some(t => t.props.children === texto));
  expect(boton).toBeDefined();
  await act(async () => { await boton!.props.onPress(); });
}
async function identidad() {
  await act(async () => {
    pantalla.root.findByProps({ placeholder: 'Ej: Panadería La Espiga' }).props.onChangeText('Mi panadería');
    pantalla.root.findByType(DropdownMultiple).props.onChange(['Panadería']);
  });
}
async function ubicacion() {
  await act(async () => {
    pantalla.root.findByType(CamposDireccion).props.onChangeText('Calle 10 # 5-20');
    pantalla.root.findByType(BarrioSelect).props.onSeleccionar('Centro');
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  mockCrear.mockResolvedValue(undefined);
  await act(async () => {
    pantalla = Renderer.create(<MiTiendaScreen {...({ route: { params: { nuevo: true } }, navigation: { navigate: mockNavigate } } as any)} />);
  });
});
afterEach(async () => { await act(async () => pantalla.unmount()); });

test('impide avanzar sin datos y conserva identidad al regresar', async () => {
  await tocar('Siguiente');
  expect(contiene('Paso 1 de 3')).toBe(true);
  expect(contiene('El campo nombre del negocio es obligatorio.')).toBe(true);
  await identidad();
  await tocar('Siguiente');
  expect(contiene('Paso 2 de 3')).toBe(true);
  await tocar('Anterior');
  expect(pantalla.root.findByProps({ placeholder: 'Ej: Panadería La Espiga' }).props.value).toBe('Mi panadería');
  expect(mockCrear).not.toHaveBeenCalled();
});

test('solo crea al finalizar los tres pasos y conserva los datos de los pasos ocultos', async () => {
  await identidad();
  await tocar('Siguiente');
  await ubicacion();
  await tocar('Siguiente');
  expect(contiene('Paso 3 de 3')).toBe(true);
  expect(mockCrear).not.toHaveBeenCalled();
  await tocar('Crear negocio');
  expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Mi panadería', barrio: 'Centro', categorias: ['Panadería'], tiempo_preparacion: 20 }), undefined);
  expect(mockNavigate).toHaveBeenCalledWith('Home');
});

test('un error del servidor devuelve al paso donde puede corregirse', async () => {
  await identidad();
  await tocar('Siguiente');
  await ubicacion();
  await tocar('Siguiente');
  mockCrear.mockRejectedValueOnce(new ApiError('Revisa los datos', 422, { telefono: ['Teléfono inválido.'] }));
  await tocar('Crear negocio');
  expect(contiene('Paso 2 de 3')).toBe(true);
  expect(contiene('Teléfono inválido.')).toBe(true);
  expect(pantalla.root.findAllByType(TextInput).length).toBeGreaterThan(0);
  expect(mockNavigate).not.toHaveBeenCalled();
});
