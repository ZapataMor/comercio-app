import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError, guardarProduccion } from '../src/api';
import ProduccionEtapaScreen, { leer } from '../src/screens/ProduccionEtapaScreen';
import { numero } from '../src/screens/ProduccionScreen';

const mockToast = { exito: jest.fn(), error: jest.fn() };
const mockConfirmar = jest.fn();
const mockGoBack = jest.fn();
const material = (id: number, nombre: string, hay: number) => ({ id, nombre, rasgos: '', hay, unidad_uno: 'unidad', unidad_varios: 'unidades' });
// Una reja: 6 varillas y 1 galón de pintura por unidad.
const mockProduccion = {
  id: 9, nombre: 'Reja de ventana', cantidad: 1, texto: '1 × Reja de ventana', estado: 'por_hacer', estado_texto: 'Por hacer',
  origen: 'manual', quien: 'Andrés', nota: null, anulada: false, falto: false, fecha: '2026-11-27T10:00:00-05:00',
  modelo: { id: 2, nombre: 'Reja de ventana' },
  materiales: [
    { ...material(1, 'Varilla 3/8', 8), cantidad: 6, normal: 6, por_unidad: 6 },
    { ...material(2, 'Pintura anticorrosiva', 3), unidad_uno: 'galón', unidad_varios: 'galones', cantidad: 1, normal: 1, por_unidad: 1 },
  ],
};
const mockMateriales = [material(1, 'Varilla 3/8', 8), material(2, 'Pintura anticorrosiva', 3), material(3, 'Soldadura 6013', 5)];

jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 'token', user: { id: 1 } } }) }));
jest.mock('../src/NegocioContext', () => ({ useNegocio: () => ({ negocio: { id: 3, nombre: 'Grumar', rol: 'propietario' } }) }));
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn(), addListener: () => () => {} }),
  useRoute: () => ({ params: { produccion: mockProduccion, materiales: mockMateriales } }),
}));
jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), guardarProduccion: jest.fn(), cancelarProduccion: jest.fn() }));

let raiz: ReactTestRenderer.ReactTestRenderer;
beforeEach(() => jest.clearAllMocks());
afterEach(() => { if (raiz) act(() => raiz.unmount()); });

async function montar() {
  await act(async () => { raiz = ReactTestRenderer.create(<ProduccionEtapaScreen />); });
}
const textos = () => raiz.root.findAllByType(Text).map(t => [].concat(t.props.children).join(''));
const porEtiqueta = (etiqueta: string) => raiz.root.findAll(n => n.props.accessibilityLabel === etiqueta && typeof n.props.onPress === 'function')[0];
async function pulsar(etiqueta: string) {
  await act(async () => { await porEtiqueta(etiqueta).props.onPress(); });
}
async function pulsarTexto(texto: string) {
  const boton = raiz.root.findAll(n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => [].concat(t.props.children).join('') === texto))[0];
  await act(async () => { await boton.props.onPress(); });
}
const campo = (etiqueta: string) => raiz.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === etiqueta)!;

test('los materiales del modelo salen puestos y se ajustan con − y +', async () => {
  await montar();
  expect(campo('Cuánto Varilla 3/8 se usa').props.value).toBe('6');
  await pulsar('Usar más Varilla 3/8');
  await pulsar('Usar más Varilla 3/8');
  await pulsar('Usar menos Pintura anticorrosiva');
  expect(campo('Cuánto Varilla 3/8 se usa').props.value).toBe('8');
  expect(campo('Cuánto Pintura anticorrosiva se usa').props.value).toBe('0');
  expect(textos().some(t => t.includes('Lo normal: 6 unidades · 2 de más'))).toBe(true);
  expect(textos().some(t => t.includes('Lo normal: 1 galón · 1 de menos'))).toBe(true);
});

test('al cambiar cuántas se hacen, se recalcula lo normal y se conserva el ajuste', async () => {
  await montar();
  await pulsar('Usar más Varilla 3/8'); // 7 (1 de más)
  await act(async () => { campo('Cuántas se hacen').props.onChangeText('2'); });
  expect(campo('Cuánto Varilla 3/8 se usa').props.value).toBe('13');
  expect(campo('Cuánto Pintura anticorrosiva se usa').props.value).toBe('2');
  // 13 varillas y solo hay 8: avisa.
  expect(textos().some(t => t.startsWith('No alcanza lo que está en rojo'))).toBe(true);
});

test('se añade un material aparte y se termina con todo', async () => {
  (guardarProduccion as jest.Mock).mockResolvedValue({ message: 'Quedó terminada.' });
  await montar();
  await pulsarTexto('Añadir material');
  await pulsar('Añadir Soldadura 6013');
  expect(textos()).toContain('Añadido aparte');
  await act(async () => { campo('Cuánto Soldadura 6013 se usa').props.onChangeText('0,5'); });
  await pulsarTexto('Terminada: descontar materiales');
  expect(guardarProduccion).toHaveBeenCalledWith('token', 3, 9, {
    cantidad: 1, nota: '', terminar: true, aunqueFalte: false,
    materiales: [{ articulo_id: 1, cantidad: 6 }, { articulo_id: 2, cantidad: 1 }, { articulo_id: 3, cantidad: 0.5 }],
  });
  expect(mockToast.exito).toHaveBeenCalled();
  expect(mockGoBack).toHaveBeenCalled();
});

test('si falta material pregunta antes de descontar lo que haya', async () => {
  (guardarProduccion as jest.Mock)
    .mockRejectedValueOnce(new ApiError('No alcanza el material.', 422, undefined, { faltantes: [{ nombre: 'Varilla 3/8', falta: '4 unidades' }] }))
    .mockResolvedValueOnce({ message: 'Quedó terminada.' });
  await montar();
  await pulsarTexto('Terminada: descontar materiales');
  expect(mockConfirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'No alcanza el material', textoBoton: 'Descontar lo que haya' }));
  await act(async () => { await mockConfirmar.mock.calls[0][0].accion(); });
  expect(guardarProduccion).toHaveBeenLastCalledWith('token', 3, 9, expect.objectContaining({ terminar: true, aunqueFalte: true }));
  expect(mockGoBack).toHaveBeenCalled();
});

test('guardar sin terminar no descuenta', async () => {
  (guardarProduccion as jest.Mock).mockResolvedValue({ message: 'Se guardaron los materiales.' });
  await montar();
  await pulsarTexto('Guardar y seguir después');
  expect(guardarProduccion).toHaveBeenCalledWith('token', 3, 9, expect.objectContaining({ terminar: false }));
});

test('los números se leen y escriben como en Colombia', () => {
  expect(numero(2.5)).toBe('2,5');
  expect(numero(1200)).toBe('1.200');
  expect(leer('0,5')).toBe(0.5);
  expect(leer('1.250,5')).toBe(1250.5);
  expect(leer('')).toBe(0);
});
