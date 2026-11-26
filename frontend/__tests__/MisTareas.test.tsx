/**
 * «Mis tareas» del Inicio: muestra lo que me asignaron, el check marca la
 * tarea hecha (y la desmarca), y si falla vuelve como estaba.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import MisTareas, { textoFecha } from '../src/components/MisTareas';
import { cambiarEstadoTarea, getMisTareas, TareaAsignada } from '../src/api';

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/usePolling', () => ({
  ...jest.requireActual('../src/usePolling'),
  usePolling: jest.fn(),
}));
jest.mock('../src/RootNavigation', () => ({ navigationRef: { navigate: jest.fn() } }));
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getMisTareas: jest.fn(),
  cambiarEstadoTarea: jest.fn(),
}));

const hoy = new Date();
const dos = (n: number) => String(n).padStart(2, '0');
const HOY = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;

function tarea(extra: Partial<TareaAsignada> = {}): TareaAsignada {
  return {
    id: 1, titulo: 'Soldar la reja', descripcion: 'Color negro', fecha: HOY, urgente: true, estado: 'pendiente',
    atrasada: false, hecha_at: null, asignada_por: 'Ismael', pedido: null, ...extra,
  };
}

let raiz: ReactTestRenderer.ReactTestRenderer;
const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
const check = () => raiz.root.find(n => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function');

async function montar(siempre = true) {
  await act(async () => {
    raiz = ReactTestRenderer.create(<MisTareas token="t" negocioId={7} siempre={siempre} />);
  });
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => act(() => raiz.unmount()));

test('muestra las tareas con urgente y la fecha', async () => {
  (getMisTareas as jest.Mock).mockResolvedValue([tarea(), tarea({ id: 2, titulo: 'Atender el pedido AB12', urgente: false, fecha: null, pedido: { id: 9, codigo: 'AB12', estado: 'aceptado' } })]);
  await montar();
  expect(getMisTareas).toHaveBeenCalledWith('t', 7);
  expect(textos()).toEqual(expect.arrayContaining(['Mis tareas (2)', 'Soldar la reja', 'Urgente', 'Hoy', 'Pedido #AB12 ›']));
});

test('el check la marca hecha y, si falla, vuelve como estaba', async () => {
  (getMisTareas as jest.Mock).mockResolvedValue([tarea()]);
  (cambiarEstadoTarea as jest.Mock).mockResolvedValue(tarea({ estado: 'hecha' }));
  await montar();
  await act(async () => { check().props.onPress(); });
  expect(cambiarEstadoTarea).toHaveBeenCalledWith('t', 7, 1, 'hecha');
  expect(textos()).toContain('Hecha');
  expect(textos()).toContain('Mis tareas');
  expect(check().props.accessibilityState.checked).toBe(true);

  (cambiarEstadoTarea as jest.Mock).mockRejectedValue(new Error('Sin conexión'));
  await act(async () => { check().props.onPress(); });
  expect(cambiarEstadoTarea).toHaveBeenLastCalledWith('t', 7, 1, 'pendiente');
  expect(check().props.accessibilityState.checked).toBe(true);
  expect(mockToast.error).toHaveBeenCalled();
});

test('al dueño sin tareas no se le muestra la sección; al trabajador sí', async () => {
  (getMisTareas as jest.Mock).mockResolvedValue([]);
  await montar(false);
  expect(textos()).toEqual([]);
  act(() => raiz.unmount());
  await montar(true);
  expect(textos()).toContain('No tienes tareas por hacer. Cuando te asignen una te llega un aviso.');
});

test('las fechas se dicen como se habla', () => {
  const base = new Date(2026, 10, 26);
  expect(textoFecha('2026-11-26', base)).toBe('Hoy');
  expect(textoFecha('2026-11-27', base)).toBe('Mañana');
  expect(textoFecha('2026-11-25', base)).toBe('Ayer');
  expect(textoFecha('2026-12-03', base)).toBe('3 dic');
});
