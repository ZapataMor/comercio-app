/**
 * Entrar y registrarse con Google: el botón del login, la cuenta que ya
 * existe, la cuenta nueva (último paso en RegistroGoogle) y los errores.
 * El selector de cuentas de Google (nativo) y la API se simulan.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError, entrarConGoogle, Usuario } from '../src/api';
import { AuthProvider, useAuth } from '../src/AuthContext';
import { elegirCuentaGoogle, googleDisponible } from '../src/google';
import LoginScreen from '../src/screens/LoginScreen';
import RegistroGoogleScreen from '../src/screens/RegistroGoogleScreen';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  alRechazarToken: jest.fn(),
  entrarConGoogle: jest.fn(),
}));
jest.mock('../src/google', () => ({
  googleDisponible: jest.fn(() => true),
  elegirCuentaGoogle: jest.fn(),
}));
jest.mock('../src/pushNotifications', () => ({
  registrarPush: jest.fn(),
  eliminarPush: jest.fn(),
  escucharRotacionToken: jest.fn(() => () => {}),
}));
jest.mock('../src/ubicacion', () => ({ detenerRastreo: jest.fn() }));

const entrarMock = entrarConGoogle as jest.Mock;
const elegirMock = elegirCuentaGoogle as jest.Mock;
const disponibleMock = googleDisponible as jest.Mock;

const ana: Usuario = { id: 7, name: 'Ana', apellidos: 'Pérez', email: 'ana.perez@gmail.com', roles: ['usuario'], google: true, tiene_clave: false };
const perfil = { name: 'Ana', apellidos: 'Pérez', email: 'ana.perez@gmail.com' };

let sesion: ReturnType<typeof useAuth>;
function Sonda() {
  sesion = useAuth();
  return null;
}

let app: ReactTestRenderer.ReactTestRenderer | undefined;
let navigation: { navigate: jest.Mock; goBack: jest.Mock; isFocused: () => boolean };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  disponibleMock.mockReturnValue(true);
  navigation = { navigate: jest.fn(), goBack: jest.fn(), isFocused: () => true };
});
afterEach(async () => {
  if (app) await act(async () => app!.unmount());
  app = undefined;
});

async function montar(pantalla: React.ReactElement) {
  await act(async () => {
    app = ReactTestRenderer.create(
      <AuthProvider>
        <Sonda />
        {pantalla}
      </AuthProvider>,
    );
  });
}

function textos(): string {
  return app!.root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');
}

function porEtiqueta(etiqueta: string) {
  return app!.root.findAll(n => n.props.accessibilityLabel === etiqueta && typeof n.props.onPress === 'function');
}

async function tocarEtiqueta(etiqueta: string) {
  await act(async () => {
    await porEtiqueta(etiqueta)[0].props.onPress();
  });
}

async function tocarTexto(texto: string) {
  const nodo = app!.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => [].concat(t.props.children).join('') === texto),
  );
  await act(async () => {
    await nodo[nodo.length - 1].props.onPress();
  });
}

describe('login', () => {
  test('con una cuenta ya conectada entra directo', async () => {
    elegirMock.mockResolvedValue('id-token-google');
    entrarMock.mockResolvedValue({ token: 'tok-ana', user: ana });
    await montar(<LoginScreen {...({ navigation } as any)} />);

    await tocarEtiqueta('Continuar con Google');

    expect(entrarMock).toHaveBeenCalledWith('id-token-google');
    expect(sesion.auth).toEqual({ token: 'tok-ana', user: ana });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test('con una cuenta nueva lleva al último paso del registro', async () => {
    elegirMock.mockResolvedValue('id-token-google');
    entrarMock.mockResolvedValue({ nuevo: true, perfil });
    await montar(<LoginScreen {...({ navigation } as any)} />);

    await tocarEtiqueta('Continuar con Google');

    expect(navigation.navigate).toHaveBeenCalledWith('RegistroGoogle', { idToken: 'id-token-google', perfil });
    expect(sesion.auth).toBeNull();
  });

  test('si cierra la ventana de Google no pasa nada', async () => {
    elegirMock.mockResolvedValue(null);
    await montar(<LoginScreen {...({ navigation } as any)} />);

    await tocarEtiqueta('Continuar con Google');

    expect(entrarMock).not.toHaveBeenCalled();
    expect(textos()).not.toContain('No fue posible');
  });

  test('si el correo ya tiene cuenta explica cómo conectar Google', async () => {
    elegirMock.mockResolvedValue('id-token-google');
    const mensaje = 'Ya tienes una cuenta de Vitrina con ana.perez@gmail.com. Entra con tu celular o correo y tu contraseña, y conecta Google desde Mi información.';
    entrarMock.mockRejectedValue(new ApiError(mensaje, 409, undefined, { codigo: 'correo_existente' }));
    await montar(<LoginScreen {...({ navigation } as any)} />);

    await tocarEtiqueta('Continuar con Google');

    expect(textos()).toContain(mensaje);
    expect(sesion.auth).toBeNull();
  });

  test('sin Google configurado no aparece el botón', async () => {
    disponibleMock.mockReturnValue(false);
    await montar(<LoginScreen {...({ navigation } as any)} />);

    expect(porEtiqueta('Continuar con Google')).toHaveLength(0);
    expect(textos()).toContain('Entrar');
  });
});

describe('último paso del registro', () => {
  const route = { params: { idToken: 'id-token-google', perfil } };

  test('trae el nombre de Google, exige la política y crea la cuenta', async () => {
    entrarMock.mockResolvedValue({ token: 'tok-ana', user: ana });
    await montar(<RegistroGoogleScreen {...({ navigation, route } as any)} />);

    expect(textos()).toContain('ana.perez@gmail.com');
    const campos = app!.root.findAllByType(TextInput);
    expect(campos.find(c => c.props.accessibilityLabel === 'Nombre(s)')!.props.value).toBe('Ana');
    expect(campos.find(c => c.props.accessibilityLabel === 'Apellidos')!.props.value).toBe('Pérez');

    await tocarTexto('Crear cuenta');
    expect(entrarMock).not.toHaveBeenCalled();
    expect(textos()).toContain('Debes aceptar la política de privacidad');

    await tocarEtiqueta('Acepto la política de privacidad');
    await tocarTexto('Crear cuenta');

    expect(entrarMock).toHaveBeenCalledWith('id-token-google', { name: 'Ana', apellidos: 'Pérez', acepta_terminos: true });
    expect(sesion.auth).toEqual({ token: 'tok-ana', user: ana });
  });

  test('si el permiso de Google venció pide elegir la cuenta otra vez', async () => {
    entrarMock.mockRejectedValue(
      new ApiError('No fue posible confirmar tu cuenta de Google. Vuelve a intentarlo.', 422, {
        id_token: ['No fue posible confirmar tu cuenta de Google. Vuelve a intentarlo.'],
      }),
    );
    await montar(<RegistroGoogleScreen {...({ navigation, route } as any)} />);

    await tocarEtiqueta('Acepto la política de privacidad');
    await tocarTexto('Crear cuenta');

    expect(textos()).toContain('elige otra vez tu cuenta de Google');
    expect(sesion.auth).toBeNull();
  });
});
