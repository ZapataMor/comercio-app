import React from 'react';
import { Switch, Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { actualizarPermisosMiembro, getEquipo, invitarTrabajador, resolverCodigo } from '../src/api';
import EquipoScreen from '../src/screens/EquipoScreen';

const sinPermisos = { modificar_inventario: false, gestionar_pedidos: false, cambiar_estado: false, administrador: false };
const mockToast = { exito: jest.fn(), error: jest.fn() };
const mockRecargar = jest.fn(async () => {});
let mockNegocio = { id: 1, nombre: 'Tienda', rol: 'propietario', permisos: { ...sinPermisos } };

jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 'token', user: { id: 1 } } }) }));
jest.mock('../src/NegocioContext', () => ({ useNegocio: () => ({ negocio: mockNegocio, esPropietario: mockNegocio.rol === 'propietario', recargar: mockRecargar }) }));
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback: () => void) => { require('react').useEffect(callback, [callback]); } }));
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getEquipo: jest.fn(), resolverCodigo: jest.fn(), invitarTrabajador: jest.fn(), actualizarPermisosMiembro: jest.fn(),
}));

let raiz: ReactTestRenderer.ReactTestRenderer;
const empleado = { id: 2, name: 'Ana', rol: 'trabajador', activo: true, es_yo: false, codigo_publico: 'U23456', permisos: { ...sinPermisos } };
const dueno = { ...empleado, id: 1, name: 'Luis', rol: 'propietario', es_yo: true, permisos: { modificar_inventario: true, gestionar_pedidos: true, cambiar_estado: true, administrador: true } };
beforeEach(() => {
  jest.clearAllMocks();
  mockNegocio = { id: 1, nombre: 'Tienda', rol: 'propietario', permisos: { ...sinPermisos } };
  (getEquipo as jest.Mock).mockResolvedValue({ miembros: [dueno, empleado], pendientes: [] });
  (resolverCodigo as jest.Mock).mockResolvedValue({ name: 'Ana', codigo_publico: 'U23456' });
  (invitarTrabajador as jest.Mock).mockResolvedValue('Invitación enviada');
  (actualizarPermisosMiembro as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => { if (raiz) act(() => raiz.unmount()); });
async function montar() {
  await act(async () => { raiz = ReactTestRenderer.create(<EquipoScreen {...({ navigation: { navigate: jest.fn() } } as any)} />); });
}
async function abrir(nombre: string) {
  const card = raiz.root.findAll(n => n.props.accessibilityLabel === `Ver información y permisos de ${nombre}` && typeof n.props.onPress === 'function')[0];
  await act(async () => { card.props.onPress(); });
}
async function pulsar(texto: string) {
  const boton = raiz.root.findAll(n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => t.props.children === texto))[0];
  await act(async () => { boton.props.onPress(); });
}
async function activar(etiqueta: string) {
  const control = raiz.root.findAllByType(Switch).find(n => n.props.accessibilityLabel === etiqueta)!;
  await act(async () => { control.props.onValueChange(true); });
}

test('elige permisos antes de enviar la invitacion', async () => {
  await montar();
  await act(async () => { raiz.root.findByType(TextInput).props.onChangeText('U23456'); });
  await act(async () => { await raiz.root.findByType(TextInput).props.onSubmitEditing(); });
  await activar('Modificar inventario');
  await activar('Abrir y cerrar el negocio');
  await pulsar('Enviar invitación');
  expect(invitarTrabajador).toHaveBeenCalledWith('token', 1, 'U23456', { ...sinPermisos, modificar_inventario: true, cambiar_estado: true });
});

test('la card abre su informacion y permite guardar permisos', async () => {
  await montar();
  await abrir('Ana');
  expect(raiz.root.findAllByType(Text).some(t => [t.props.children].flat().join('') === 'Código: #U23456')).toBe(true);
  await activar('Manejar pedidos');
  await pulsar('Guardar permisos');
  expect(actualizarPermisosMiembro).toHaveBeenCalledWith('token', 1, 2, { ...sinPermisos, gestionar_pedidos: true });
  expect(mockRecargar).toHaveBeenCalled();
});

test('un administrador gestiona empleados y ve al propietario con permisos bloqueados', async () => {
  mockNegocio = { ...mockNegocio, rol: 'trabajador', permisos: { ...sinPermisos, administrador: true } };
  await montar();
  await abrir('Ana');
  expect(raiz.root.findAllByType(Switch).every(n => !n.props.disabled)).toBe(true);
  await pulsar('Cerrar');
  await abrir('Luis');
  expect(raiz.root.findAllByType(Switch).every(n => n.props.disabled)).toBe(true);
  expect(raiz.root.findAllByType(Text).some(t => t.props.children === 'Guardar permisos')).toBe(false);
});

test('un trabajador consulta el modal sin editar permisos', async () => {
  mockNegocio = { ...mockNegocio, rol: 'trabajador' };
  await montar();
  await abrir('Ana');
  expect(raiz.root.findAllByType(Switch).every(n => n.props.disabled)).toBe(true);
  expect(raiz.root.findAllByType(Text).some(t => t.props.children === 'Guardar permisos')).toBe(false);
});
