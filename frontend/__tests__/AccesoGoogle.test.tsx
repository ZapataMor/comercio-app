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
import RegisterScreen from '../src/screens/RegisterScreen';
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

const ana: Usuario = { id: 7, name: 'Ana', apellidos: 'Pérez', email: 'ana.perez@gmail.com', roles: ['usuario'], google: true, tiene_pin: true };
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

async function escribir(etiqueta: string, valor: string) {
  await act(async () => {
    await app!.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === etiqueta)!.props.onChangeText(valor);
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

  test('con una cuenta que ya tiene clave, pide la clave y entra', async () => {
    elegirMock.mockResolvedValue('id-token-google');
    entrarMock
      .mockResolvedValueOnce({ requiere_pin: true, user: { id: 7, name: 'Ana' } })
      .mockRejectedValueOnce(new ApiError('La clave no es correcta. Te quedan 4 intentos.', 422, { pin: ['La clave no es correcta. Te quedan 4 intentos.'] }))
      .mockResolvedValueOnce({ token: 'tok-ana', user: ana, dispositivo: 'disp-ana' });
    await montar(<LoginScreen {...({ navigation } as any)} />);

    await tocarEtiqueta('Continuar con Google');
    expect(sesion.auth).toBeNull();
    expect(textos()).toContain('Hola, Ana');

    await escribir('Escribe tu clave de 4 números', '1357');
    expect(entrarMock).toHaveBeenLastCalledWith('id-token-google', { pin: '1357', dispositivo: undefined });
    expect(textos()).toContain('Te quedan 4 intentos');
    expect(sesion.auth).toBeNull();

    await escribir('Escribe tu clave de 4 números', '2468');
    expect(sesion.auth).toEqual({ token: 'tok-ana', user: ana });
    // Google demostró quién es: este teléfono queda de confianza para Ana.
    expect(sesion.dispositivos[7]).toBe('disp-ana');
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

  test('trae el nombre de Google, exige la política, pide crear la clave y crea la cuenta', async () => {
    entrarMock.mockResolvedValue({ token: 'tok-ana', user: ana, dispositivo: 'disp-ana' });
    await montar(<RegistroGoogleScreen {...({ navigation, route } as any)} />);

    expect(textos()).toContain('ana.perez@gmail.com');
    const campos = app!.root.findAllByType(TextInput);
    expect(campos.find(c => c.props.accessibilityLabel === 'Nombre(s)')!.props.value).toBe('Ana');
    expect(campos.find(c => c.props.accessibilityLabel === 'Apellidos')!.props.value).toBe('Pérez');

    await tocarTexto('Continuar');
    expect(entrarMock).not.toHaveBeenCalled();
    expect(textos()).toContain('Debes aceptar los términos y la política de privacidad');

    await tocarEtiqueta('Acepto los términos y la política de privacidad');
    await tocarTexto('Continuar');
    expect(textos()).toContain('Último paso: crea tu clave');

    // Una clave fácil no se acepta, ni dos distintas.
    await escribir('Tu clave de 4 números', '1234');
    await escribir('Confirma tu clave', '1234');
    expect(textos()).toContain('No uses números seguidos');
    await escribir('Tu clave de 4 números', '2468');
    await escribir('Confirma tu clave', '2469');
    expect(textos()).toContain('Las dos claves no coinciden.');
    expect(entrarMock).not.toHaveBeenCalled();

    await escribir('Confirma tu clave', '2468');
    expect(entrarMock).toHaveBeenCalledWith('id-token-google', {
      registro: { name: 'Ana', apellidos: 'Pérez', acepta_terminos: true, pin: '2468' },
    });
    expect(sesion.auth).toEqual({ token: 'tok-ana', user: ana });
    expect(sesion.dispositivos[7]).toBe('disp-ana');
    // Cuenta nueva: al entrar ve «Completa tu cuenta».
    expect(sesion.porCompletar).toBe(7);
  });

  test('si el permiso de Google venció pide elegir la cuenta otra vez', async () => {
    entrarMock.mockRejectedValue(
      new ApiError('No fue posible confirmar tu cuenta de Google. Vuelve a intentarlo.', 422, {
        id_token: ['No fue posible confirmar tu cuenta de Google. Vuelve a intentarlo.'],
      }),
    );
    await montar(<RegistroGoogleScreen {...({ navigation, route } as any)} />);

    await tocarEtiqueta('Acepto los términos y la política de privacidad');
    await tocarTexto('Continuar');
    await escribir('Tu clave de 4 números', '2468');
    await escribir('Confirma tu clave', '2468');

    expect(textos()).toContain('elige otra vez tu cuenta de Google');
    expect(sesion.auth).toBeNull();
  });

  test('el botón de volver regresa a la pantalla anterior', async () => {
    await montar(<RegistroGoogleScreen {...({ navigation, route } as any)} />);
    await tocarEtiqueta('Volver');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('registro', () => {
  test('el botón de volver regresa al inicio de sesión', async () => {
    await montar(<RegisterScreen {...({ navigation } as any)} />);
    await tocarEtiqueta('Volver al inicio de sesión');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('cuentas de Google recordadas', () => {
  test('al cerrar sesión la cuenta de Google sigue en «Continuar como» y entra con un toque', async () => {
    elegirMock.mockResolvedValue('id-token-google');
    entrarMock.mockResolvedValue({ token: 'tok-ana', user: ana });
    await montar(<LoginScreen {...({ navigation } as any)} />);
    await tocarEtiqueta('Continuar con Google');
    expect(sesion.auth?.token).toBe('tok-ana');

    await act(async () => {
      sesion.salir();
    });
    expect(sesion.auth).toBeNull();
    expect(sesion.cuentas).toHaveLength(0);
    // No se guarda el token, solo los datos para mostrarla.
    expect(sesion.recordadas).toEqual([{ user: ana }]);
    expect(JSON.stringify(sesion.recordadas)).not.toContain('tok-ana');

    entrarMock.mockResolvedValue({ token: 'tok-ana-2', user: ana });
    await tocarEtiqueta('Continuar como Ana Pérez con Google');

    expect(elegirMock).toHaveBeenLastCalledWith({ rapido: true });
    expect(sesion.auth?.token).toBe('tok-ana-2');
    // Con la sesión abierta pasa a las cuentas guardadas.
    expect(sesion.recordadas).toHaveLength(0);
  });

  test('las cuentas sin Google no se recuerdan y «Cerrar todas» olvida las de Google', async () => {
    const bruno: Usuario = { id: 8, name: 'Bruno', email: 'bruno@demo.co', roles: ['usuario'], google: false };
    await montar(<LoginScreen {...({ navigation } as any)} />);

    await act(async () => {
      sesion.entrar('tok-bruno', bruno);
    });
    await act(async () => {
      sesion.salir();
    });
    expect(sesion.recordadas).toHaveLength(0);

    await act(async () => {
      sesion.entrar('tok-ana', ana);
    });
    await act(async () => {
      sesion.salirDeTodas();
    });
    expect(sesion.recordadas).toHaveLength(0);
    expect(porEtiqueta('Continuar como Ana Pérez con Google')).toHaveLength(0);
  });

  test('sin Google disponible no se muestran las cuentas recordadas', async () => {
    await montar(<LoginScreen {...({ navigation } as any)} />);
    await act(async () => {
      sesion.entrar('tok-ana', ana);
    });
    await act(async () => {
      sesion.salir();
    });
    disponibleMock.mockReturnValue(false);
    await act(async () => {
      app!.update(
        <AuthProvider>
          <Sonda />
          <LoginScreen {...({ navigation } as any)} />
        </AuthProvider>,
      );
    });
    expect(porEtiqueta('Continuar como Ana Pérez con Google')).toHaveLength(0);
  });
});
