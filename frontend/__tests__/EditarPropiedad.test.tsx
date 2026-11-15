/**
 * Publicar propiedad: un «atrás» con el formulario a medio llenar pregunta
 * antes de perder las fotos y los datos.
 * @format
 */
import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import EditarPropiedadScreen from '../src/screens/EditarPropiedadScreen';

const mockSesion = { auth: { token: 't', user: { id: 7, name: 'Ana', apellidos: 'Pérez', telefono: '3001234567', roles: ['usuario'] } } };
jest.mock('../src/AuthContext', () => ({ useAuth: () => mockSesion }));
const mockConfirmar = jest.fn();
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));
const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/components/SelectorUbicacion', () => () => null);
jest.mock('../src/components/BarrioSelect', () => () => null);
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getOpcionesPropiedad: jest.fn(async () => ({ caracteristicas: { venta: [], alquiler: [], eventos: [] }, max_fotos: 10 })),
}));

function navegacion() {
  const oyentes: Record<string, (e: any) => void> = {};
  return {
    oyentes,
    setOptions: jest.fn(),
    dispatch: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn((evento: string, f: (e: any) => void) => {
      oyentes[evento] = f;
      return () => delete oyentes[evento];
    }),
  };
}

async function montar() {
  const navigation = navegacion();
  let raiz: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <EditarPropiedadScreen navigation={navigation as any} route={{ key: 'e', name: 'EditarPropiedad', params: undefined } as any} />,
    );
  });
  return { navigation, raiz: raiz! };
}

const salir = (navigation: ReturnType<typeof navegacion>) => {
  const evento = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
  act(() => navigation.oyentes.beforeRemove(evento));
  return evento;
};

beforeEach(() => jest.clearAllMocks());

test('sin cambios sale sin preguntar', async () => {
  const { navigation, raiz } = await montar();
  const evento = salir(navigation);
  expect(evento.preventDefault).not.toHaveBeenCalled();
  expect(mockConfirmar).not.toHaveBeenCalled();
  act(() => raiz.unmount());
});

test('con el formulario a medio llenar pregunta, y solo sale si lo confirma', async () => {
  const { navigation, raiz } = await montar();
  const titulo = raiz.root.findAllByType(TextInput)[0];
  await act(async () => titulo.props.onChangeText('Casa esquinera'));

  const evento = salir(navigation);
  expect(evento.preventDefault).toHaveBeenCalled();
  expect(mockConfirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: '¿Salir sin publicar?', peligro: true }));
  expect(navigation.dispatch).not.toHaveBeenCalled();

  act(() => mockConfirmar.mock.calls[0][0].accion());
  expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  act(() => raiz.unmount());
});
