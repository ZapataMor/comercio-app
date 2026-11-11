import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import MisDireccionesScreen from '../src/screens/MisDireccionesScreen';
import { eliminarClienteDireccion, marcarDireccionPrincipal } from '../src/api';

const mockAuth = { token: 'token', user: { direccion: 'Calle 1', barrio: 'Centro' } };
const mockActualizar = jest.fn();
const mockConfirmar = jest.fn();
const mockDirecciones = [
  { id: 1, nombre: 'Casa', direccion: 'Calle 1', barrio: 'Centro', es_principal: true },
  { id: 2, nombre: 'Trabajo', direccion: 'Calle 2', barrio: 'Norte', es_principal: false },
];
jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: mockAuth, actualizarUsuario: mockActualizar }) }));
jest.mock('../src/usePolling', () => ({ useEnVivo: jest.fn() }));
jest.mock('../src/components/EditarDireccion', () => () => null);
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));
jest.mock('../src/api', () => ({
  getClienteDirecciones: jest.fn(async () => mockDirecciones),
  marcarDireccionPrincipal: jest.fn(async () => mockDirecciones.map(d => ({ ...d, es_principal: d.id === 2 }))),
  eliminarClienteDireccion: jest.fn(async () => [{ ...mockDirecciones[1], es_principal: true }]),
}));

let pantalla: ReactTestRenderer.ReactTestRenderer;
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => { pantalla = ReactTestRenderer.create(<MisDireccionesScreen />); });
});
afterEach(async () => { await act(async () => pantalla.unmount()); });
async function tocar(label: string) {
  await act(async () => {
    await pantalla.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === label)!.props.onPress();
  });
}

test('marca otra principal y actualiza el perfil y las acciones visibles', async () => {
  await tocar('Marcar como principal Trabajo');
  expect(marcarDireccionPrincipal).toHaveBeenCalledWith('token', 2);
  expect(mockActualizar).toHaveBeenCalledWith({ direccion: 'Calle 2', barrio: 'Norte' });
  const labels = pantalla.root.findAllByType(TouchableOpacity).map(b => b.props.accessibilityLabel);
  expect(labels).toContain('Marcar como principal Casa');
  expect(labels).not.toContain('Marcar como principal Trabajo');
});

test('solo elimina al confirmar y muestra la nueva principal', async () => {
  await tocar('Eliminar Casa');
  expect(eliminarClienteDireccion).not.toHaveBeenCalled();
  await act(async () => { await mockConfirmar.mock.calls[0][0].accion(); });
  expect(eliminarClienteDireccion).toHaveBeenCalledWith('token', 1);
  const textos = pantalla.root.findAllByType(Text).map(t => t.props.children);
  expect(textos).not.toContain('Casa');
  expect(textos).toContain('Principal');
  expect(mockActualizar).toHaveBeenCalledWith({ direccion: 'Calle 2', barrio: 'Norte' });
});
