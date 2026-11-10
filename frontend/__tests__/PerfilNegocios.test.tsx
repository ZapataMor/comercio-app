import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { desactivarNegocio, eliminarNegocio, Negocio } from '../src/api';
import MiInformacionScreen from '../src/screens/MiInformacionScreen';

const mockRecargar = jest.fn(async () => {});
let mockNegocios: Partial<Negocio>[] = [];
const mockConfirmar = jest.fn();
const mockToast = { exito: jest.fn(), error: jest.fn() };
jest.mock('../src/NegocioContext', () => ({
  useNegocio: () => ({ negocios: mockNegocios, codigoPublico: null, recargar: mockRecargar }),
}));
jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 'token', user: { name: 'Ana', email: 'ana@correo.com', roles: ['usuario'] } } }),
}));
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  desactivarNegocio: jest.fn(async () => ({})),
  eliminarNegocio: jest.fn(async () => {}),
}));

let pantalla: ReactTestRenderer.ReactTestRenderer;
async function montar() {
  await act(async () => {
    pantalla = ReactTestRenderer.create(<MiInformacionScreen {...({} as any)} />);
  });
}
const textos = () => pantalla.root.findAllByType(Text).map(t => t.props.children);
async function tocar(texto: string) {
  const boton = pantalla.root.findAllByType(TouchableOpacity)
    .find(b => b.findAllByType(Text).some(t => t.props.children === texto));
  expect(boton).toBeDefined();
  await act(async () => { boton!.props.onPress(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNegocios = [
    { id: 4, nombre: 'Mi tienda', rol: 'propietario', desactivado: false },
    { id: 9, nombre: 'Tienda ajena', rol: 'trabajador' },
  ];
});
afterEach(async () => { if (pantalla) await act(async () => pantalla.unmount()); });

test('solo muestra acciones para los negocios propios', async () => {
  await montar();
  expect(textos()).toContain('Mi tienda');
  expect(textos()).not.toContain('Tienda ajena');
  expect(textos()).toContain('Desactivar temporalmente');
  expect(textos()).toContain('Eliminar negocio definitivamente');
});

test('desactiva el negocio elegido solo después de confirmar y actualiza el contexto', async () => {
  await montar();
  await tocar('Desactivar temporalmente');
  expect(desactivarNegocio).not.toHaveBeenCalled();
  const confirmacion = mockConfirmar.mock.calls[0][0];
  expect(confirmacion.titulo).toContain('Mi tienda');
  await act(async () => { await confirmacion.accion(); });
  expect(desactivarNegocio).toHaveBeenCalledWith('token', 4, true);
  expect(mockRecargar).toHaveBeenCalled();
});

test('permite reactivar desde el perfil', async () => {
  mockNegocios[0].desactivado = true;
  await montar();
  expect(textos()).toContain('Desactivado · Oculto para los clientes');
  await tocar('Reactivar negocio');
  await act(async () => { await mockConfirmar.mock.calls[0][0].accion(); });
  expect(desactivarNegocio).toHaveBeenCalledWith('token', 4, false);
});

test('explica el borrado irreversible y muestra el error si hay pedidos activos', async () => {
  (eliminarNegocio as jest.Mock).mockRejectedValueOnce(new Error('Hay pedidos activos'));
  await montar();
  await tocar('Eliminar negocio definitivamente');
  expect(eliminarNegocio).not.toHaveBeenCalled();
  const confirmacion = mockConfirmar.mock.calls[0][0];
  expect(confirmacion.peligro).toBe(true);
  expect(confirmacion.texto).toContain('No se puede deshacer');
  await act(async () => { await confirmacion.accion(); });
  expect(eliminarNegocio).toHaveBeenCalledWith('token', 4);
  expect(mockToast.error).toHaveBeenCalled();
  expect(mockRecargar).not.toHaveBeenCalled();
});
