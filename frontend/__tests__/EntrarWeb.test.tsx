import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { aprobarAccesoWeb, cerrarSesionWeb, consultarAccesoWeb, getAccesoWeb, getSesionesWeb } from '../src/api';
import EntrarWebScreen, { formatearCodigoWeb } from '../src/screens/EntrarWebScreen';

const mockToast = { exito: jest.fn(), error: jest.fn() };
jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 'token', user: { id: 1 } } }) }));
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/useLectura', () => ({ useLecturaEnFoco: (cb: () => void) => { require('react').useEffect(cb, [cb]); } }));
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getAccesoWeb: jest.fn(), getSesionesWeb: jest.fn(), consultarAccesoWeb: jest.fn(), aprobarAccesoWeb: jest.fn(), cerrarSesionWeb: jest.fn(),
}));

let raiz: ReactTestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  (getAccesoWeb as jest.Mock).mockResolvedValue({ disponible: true, negocios: [{ id: 1, nombre: 'Grumar' }], url: 'http://localhost:8000/negocio/entrar' });
  (getSesionesWeb as jest.Mock).mockResolvedValue([{ id: 7, navegador: 'Chrome en Windows', ip: '1.1.1.1', desde: '2026-11-25T10:00:00-05:00', ultimo_uso: null }]);
  (consultarAccesoWeb as jest.Mock).mockResolvedValue({ codigo: 'ABCD-EFGH', navegador: 'Edge en Windows', creado_hace_segundos: 5 });
  (aprobarAccesoWeb as jest.Mock).mockResolvedValue('Listo. El panel web se abrirá en Edge en Windows.');
  (cerrarSesionWeb as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => { if (raiz) act(() => raiz.unmount()); });

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat().join(''));
async function montar() {
  await act(async () => { raiz = ReactTestRenderer.create(<EntrarWebScreen {...({ navigation: { navigate: jest.fn() } } as any)} />); });
}
async function pulsar(texto: string) {
  const boton = raiz.root.findAll(n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => t.props.children === texto))[0];
  await act(async () => { boton.props.onPress(); });
}

test('formatea el código como lo muestra la web', () => {
  expect(formatearCodigoWeb('abcd efgh')).toBe('ABCD-EFGH');
  expect(formatearCodigoWeb('ab-c')).toBe('ABC');
  expect(formatearCodigoWeb('ABCDEFGHJK')).toBe('ABCD-EFGH');
});

test('muestra el navegador antes de aprobar y aprueba el código', async () => {
  await montar();
  expect(textos().some(t => t.includes('Grumar'))).toBe(true);
  await act(async () => { raiz.root.findByType(TextInput).props.onChangeText('abcdefgh'); });
  expect(raiz.root.findByType(TextInput).props.value).toBe('ABCD-EFGH');
  await pulsar('Continuar');
  expect(consultarAccesoWeb).toHaveBeenCalledWith('token', 'ABCD-EFGH');
  expect(textos().some(t => t.includes('Edge en Windows'))).toBe(true);
  await pulsar('Sí, entrar');
  expect(aprobarAccesoWeb).toHaveBeenCalledWith('token', 'ABCD-EFGH');
  expect(mockToast.exito).toHaveBeenCalledWith('Listo', 'Listo. El panel web se abrirá en Edge en Windows.');
});

test('cierra una sesión web abierta', async () => {
  await montar();
  expect(textos()).toContain('Chrome en Windows');
  const cerrar = raiz.root.findAll(n => n.props.accessibilityLabel === 'Cerrar la sesión en Chrome en Windows' && typeof n.props.onPress === 'function')[0];
  await act(async () => { await cerrar.props.onPress(); });
  expect(cerrarSesionWeb).toHaveBeenCalledWith('token', 7);
  expect(textos()).not.toContain('Chrome en Windows');
});

test('sin panel web explica que es parte de Vitrina Gestión', async () => {
  (getAccesoWeb as jest.Mock).mockResolvedValue({ disponible: false, negocios: [], url: '' });
  (getSesionesWeb as jest.Mock).mockResolvedValue([]);
  await montar();
  expect(textos().some(t => t.includes('Vitrina Gestión'))).toBe(true);
  expect(raiz.root.findAllByType(TextInput)).toHaveLength(0);
});
