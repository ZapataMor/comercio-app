import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError, registrarHecho } from '../src/api';
import { numero } from '../src/screens/ProduccionScreen';
import RegistrarHechoScreen from '../src/screens/RegistrarHechoScreen';

const mockToast = { exito: jest.fn(), error: jest.fn() };
const mockConfirmar = jest.fn();
const mockGoBack = jest.fn();
const mockProducto = {
  id: 7, nombre: 'Portón corredizo', imagen: null, precio: 3600000, existencias: null, modo: 'fabricar', alcanza: 2,
  materiales: [
    { id: 1, nombre: 'Tubo cuadrado 1"', rasgos: 'Calibre 18', por_unidad: 12, hay: 30, unidad_uno: 'unidad', unidad_varios: 'unidades' },
    { id: 2, nombre: 'Rueda para portón', rasgos: '', por_unidad: 2, hay: 5, unidad_uno: 'unidad', unidad_varios: 'unidades' },
  ],
};

jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 'token', user: { id: 1 } } }) }));
jest.mock('../src/NegocioContext', () => ({ useNegocio: () => ({ negocio: { id: 3, nombre: 'Grumar', rol: 'propietario' } }) }));
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn(), addListener: () => () => {} }),
  useRoute: () => ({ params: { producto: mockProducto } }),
}));
jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), registrarHecho: jest.fn() }));

let raiz: ReactTestRenderer.ReactTestRenderer;
beforeEach(() => jest.clearAllMocks());
afterEach(() => { if (raiz) act(() => raiz.unmount()); });

async function montar() {
  await act(async () => { raiz = ReactTestRenderer.create(<RegistrarHechoScreen />); });
}
const textos = () => raiz.root.findAllByType(Text).map(t => [].concat(t.props.children).join(''));
async function pulsar(texto: string) {
  const boton = raiz.root.findAll(n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => [].concat(t.props.children).join('') === texto))[0];
  await act(async () => { await boton.props.onPress(); });
}
const cantidad = () => raiz.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === 'Cantidad hecha')!;

test('muestra lo que se descuenta y avisa cuando no alcanza', async () => {
  await montar();
  expect(textos()).toContain('12 unidades');
  expect(textos()).toContain('2 unidades');
  await act(async () => { cantidad().props.onChangeText('3'); });
  expect(textos()).toContain('36 unidades');
  expect(textos().some(t => t.startsWith('No alcanza lo que hay en rojo'))).toBe(true);
});

test('registra con el destino elegido y vuelve', async () => {
  (registrarHecho as jest.Mock).mockResolvedValue({ message: 'Se registró: 2 × Portón corredizo.' });
  await montar();
  await act(async () => { cantidad().props.onChangeText('2'); });
  await pulsar('Dejar en espera');
  await pulsar('Registrar como hecho');
  expect(registrarHecho).toHaveBeenCalledWith('token', 3, 7, { cantidad: '2', nota: '', destino: 'espera', aunqueFalte: false });
  expect(mockToast.exito).toHaveBeenCalled();
  expect(mockGoBack).toHaveBeenCalled();
});

test('si falta material pregunta antes de descontar lo que haya', async () => {
  (registrarHecho as jest.Mock)
    .mockRejectedValueOnce(new ApiError('No alcanza el material.', 422, undefined, { faltantes: [{ nombre: 'Rueda para portón', falta: '1 unidad' }] }))
    .mockResolvedValueOnce({ message: 'Se registró.' });
  await montar();
  await act(async () => { cantidad().props.onChangeText('3'); });
  await pulsar('Registrar como hecho');
  expect(mockConfirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'No alcanza el material', textoBoton: 'Descontar lo que haya' }));
  await act(async () => { await mockConfirmar.mock.calls[0][0].accion(); });
  expect(registrarHecho).toHaveBeenLastCalledWith('token', 3, 7, expect.objectContaining({ cantidad: '3', aunqueFalte: true }));
  expect(mockGoBack).toHaveBeenCalled();
});

test('los números se escriben como en Colombia', () => {
  expect(numero(2.5)).toBe('2,5');
  expect(numero(1200)).toBe('1.200');
  expect(numero(1234567.25)).toBe('1.234.567,25');
});
