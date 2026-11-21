/**
 * Clave de 4 números: las reglas (iguales a las del backend) y la pantalla
 * «Crea tu clave» de las cuentas que aún no la tienen.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError, guardarClave, Usuario } from '../src/api';
import { AuthProvider, useAuth } from '../src/AuthContext';
import { erroresClaveNueva, problemaClave } from '../src/clave';
import CrearClaveScreen from '../src/screens/CrearClaveScreen';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  alRechazarToken: jest.fn(),
  guardarClave: jest.fn(),
}));
jest.mock('../src/pushNotifications', () => ({
  registrarPush: jest.fn(),
  eliminarPush: jest.fn(),
  escucharRotacionToken: jest.fn(() => () => {}),
}));
jest.mock('../src/ubicacion', () => ({ detenerRastreo: jest.fn() }));

const guardarMock = guardarClave as jest.Mock;

describe('reglas de la clave', () => {
  test.each(['0000', '7777', '1234', '6789', '0123', '4321', '9876', '1212', '9090', '1004', '2000'])('%s es fácil de adivinar', clave => {
    expect(problemaClave(clave)).not.toBeNull();
  });

  test.each(['2468', '1357', '8024', '5193', '0472'])('%s sirve', clave => {
    expect(problemaClave(clave)).toBeNull();
  });

  test('pide 4 números y que las dos coincidan', () => {
    expect(problemaClave('123')).toBe('La clave debe tener exactamente 4 números.');
    expect(problemaClave('12a4')).toBe('La clave debe tener exactamente 4 números.');
    expect(erroresClaveNueva('2468', '2469')).toEqual({ confirmar: 'Las dos claves no coinciden.' });
    expect(erroresClaveNueva('2468', '2468')).toEqual({});
  });
});

describe('«Crea tu clave»', () => {
  const vieja: Usuario = { id: 3, name: 'Carla Ríos', email: null, telefono: '3001234567', telefono_verificado: true, roles: ['usuario'], tiene_pin: false };
  let sesion: ReturnType<typeof useAuth>;
  function Sonda() {
    sesion = useAuth();
    return null;
  }
  let app: ReactTestRenderer.ReactTestRenderer | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await act(async () => {
      app = ReactTestRenderer.create(
        <AuthProvider>
          <Sonda />
          <CrearClaveScreen />
        </AuthProvider>,
      );
    });
    await act(async () => {
      sesion.entrar('t-carla', vieja);
    });
  });
  afterEach(async () => {
    if (app) await act(async () => app!.unmount());
    app = undefined;
  });

  const textos = () =>
    app!.root
      .findAllByType(Text)
      .map(t => [].concat(t.props.children).join(''))
      .join(' | ');
  const escribir = (etiqueta: string, valor: string) =>
    act(async () => {
      await app!.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === etiqueta)!.props.onChangeText(valor);
    });

  test('crea la clave, deja el teléfono de confianza y ofrece completar la cuenta (le falta el correo)', async () => {
    guardarMock.mockResolvedValue({ message: 'ok', user: { ...vieja, tiene_pin: true }, dispositivo: 'disp-carla' });
    expect(textos()).toContain('Hola, Carla');

    await escribir('Tu clave de 4 números', '2468');
    await escribir('Confirma tu clave', '2468');

    expect(guardarMock).toHaveBeenCalledWith('t-carla', '2468');
    expect(sesion.auth?.user.tiene_pin).toBe(true);
    expect(sesion.dispositivos[3]).toBe('disp-carla');
    expect(sesion.porCompletar).toBe(3);
  });

  test('un error del servidor sobre la clave se muestra y la borra', async () => {
    guardarMock.mockRejectedValue(new ApiError('Esa clave es de las más usadas. Elige otra.', 422, { pin: ['Esa clave es de las más usadas. Elige otra.'] }));

    await escribir('Tu clave de 4 números', '5193');
    await escribir('Confirma tu clave', '5193');

    expect(textos()).toContain('Esa clave es de las más usadas. Elige otra.');
    expect(sesion.auth?.user.tiene_pin).toBe(false);
    expect(app!.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === 'Tu clave de 4 números')!.props.value).toBe('');
  });
});
