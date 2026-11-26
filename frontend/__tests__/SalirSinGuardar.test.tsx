/**
 * El comerciante no pierde lo que llenó por tocar atrás sin querer, y marca un
 * producto agotado de un toque desde la lista.
 * @format
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockConfirmar = jest.fn();
const mockListeners: ((e: unknown) => void)[] = [];
const mockDispatch = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: (_ev: string, f: (e: unknown) => void) => {
      mockListeners.push(f);
      return () => mockListeners.splice(mockListeners.indexOf(f), 1);
    },
    dispatch: mockDispatch,
  }),
}));
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));

const mockCambiar = jest.fn();
const mockToast = { exito: jest.fn(), error: jest.fn() };
jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 't' } }) }));
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/NegocioContext', () => ({
  useNegocio: () => ({ negocio: { id: 5, rol: 'propietario', categorias: [] }, cargando: false }),
}));
jest.mock('../src/usePolling', () => ({ useEnVivo: () => {}, temasDelNegocio: () => [] }));
jest.mock('../src/useLectura', () => ({ useLectura: (f: () => void) => require('react').useEffect(() => f(), []) }));
jest.mock('../src/tutorial/Objetivo', () => ({ Objetivo: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../src/components/SelectorImagen', () => () => null);
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getProductos: () =>
    Promise.resolve([{ id: 9, nombre: 'Arepa', precio: 12000, disponible: true, imagen: null, tipo_producto: null }]),
  getTiposProducto: () => Promise.resolve([]),
  getCategoriasCatalogo: () => Promise.resolve([]),
  cambiarDisponibleProducto: (...a: unknown[]) => mockCambiar(...a),
}));

import { useHayCambios, useSalirSinGuardar } from '../src/useSalirSinGuardar';
import MisProductosScreen from '../src/screens/MisProductosScreen';

const montados: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => montados.splice(0).forEach(m => m.unmount()));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.length = 0;
});

let api!: { preguntar: (f: () => void) => void; hay: boolean };
function Formulario({ valor, abierto }: { valor: string; abierto: boolean }) {
  const hay = useHayCambios(valor, abierto);
  const { preguntar } = useSalirSinGuardar(hay);
  api = { preguntar, hay };
  return null;
}

test('sin cambios sale directo; con cambios pregunta antes, también al salir de la pantalla', async () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<Formulario valor="a" abierto />);
    montados.push(r);
  });
  const salir = jest.fn();
  api.preguntar(salir);
  expect(salir).toHaveBeenCalledTimes(1);
  expect(mockConfirmar).not.toHaveBeenCalled();

  await act(async () => r.update(<Formulario valor="ab" abierto />));
  expect(api.hay).toBe(true);
  api.preguntar(salir);
  expect(salir).toHaveBeenCalledTimes(1);
  expect(mockConfirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: '¿Salir sin guardar?' }));

  // Atrás del teléfono: se frena y solo sale si confirma.
  const e = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
  mockListeners[mockListeners.length - 1](e);
  expect(e.preventDefault).toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
  mockConfirmar.mock.calls[1][0].accion();
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });

  // Al cerrar y volver a abrir, se cuenta desde lo que tenga entonces.
  await act(async () => r.update(<Formulario valor="ab" abierto={false} />));
  await act(async () => r.update(<Formulario valor="ab" abierto />));
  expect(api.hay).toBe(false);
});

test('el producto se marca agotado de un toque y se puede volver a activar', async () => {
  mockCambiar.mockResolvedValue({});
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<MisProductosScreen {...({ navigation: { navigate: jest.fn() } } as any)} />);
    montados.push(r);
  });
  const estado = () => r.root.findByProps({ accessibilityRole: 'switch' });
  const textos = () => estado().findAllByType(Text).map(t => t.props.children);

  expect(textos()).toEqual(['Disponible', 'Toca si se acabó']);
  await act(async () => estado().props.onPress());
  expect(mockCambiar).toHaveBeenCalledWith('t', 5, 9, false);
  expect(textos()).toEqual(['Agotado', 'Toca si ya hay']);
  expect(mockToast.exito).toHaveBeenCalledWith('Marcado como agotado', expect.any(String));

  await act(async () => estado().props.onPress());
  expect(mockCambiar).toHaveBeenLastCalledWith('t', 5, 9, true);
  expect(textos()[0]).toBe('Disponible');
  expect(r.root.findAllByType(TouchableOpacity).length).toBeGreaterThan(0);
});

test('si falla, el producto vuelve como estaba', async () => {
  mockCambiar.mockRejectedValue(new Error('Sin conexión'));
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<MisProductosScreen {...({ navigation: { navigate: jest.fn() } } as any)} />);
    montados.push(r);
  });
  const estado = () => r.root.findByProps({ accessibilityRole: 'switch' });
  await act(async () => estado().props.onPress());
  expect(estado().findAllByType(Text)[0].props.children).toBe('Disponible');
  expect(mockToast.error).toHaveBeenCalledWith('No se pudo cambiar', 'Sin conexión');
});
