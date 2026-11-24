/**
 * Varias cuentas en el mismo teléfono, como en Instagram: se agregan sin
 * cerrar las demás, se cambia entre ellas sin contraseña y al cerrar la
 * sesión de una se sigue con otra. Y entrar con el celular y la clave.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { BackHandler, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { alRechazarToken, ApiError, entrarConClave, entrarEnDispositivo, getMisNegocios, Usuario } from '../src/api';
import { AuthProvider, useAuth } from '../src/AuthContext';
import { NegocioProvider, useNegocio } from '../src/NegocioContext';
import { eliminarPush, registrarPush } from '../src/pushNotifications';
import LoginScreen from '../src/screens/LoginScreen';
import { detenerRastreo } from '../src/ubicacion';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  alRechazarToken: jest.fn(),
  getMisNegocios: jest.fn(() => new Promise(() => {})),
  entrarConClave: jest.fn(),
  confirmarCodigoAcceso: jest.fn(),
  entrarEnDispositivo: jest.fn(),
}));
jest.mock('../src/pushNotifications', () => ({
  registrarPush: jest.fn(),
  eliminarPush: jest.fn(),
  escucharRotacionToken: jest.fn(() => () => {}),
}));
jest.mock('../src/ubicacion', () => ({ detenerRastreo: jest.fn() }));

const ana: Usuario = { id: 1, name: 'Ana', apellidos: 'Pérez', email: 'ana@demo.co', roles: ['usuario'] };
const bruno: Usuario = { id: 2, name: 'Bruno', email: null, telefono: '3001234567', roles: ['usuario'] };

let sesion: ReturnType<typeof useAuth>;
function Sonda() {
  sesion = useAuth();
  return null;
}

let app: ReactTestRenderer.ReactTestRenderer | undefined;

async function montar(conLogin = false) {
  await act(async () => {
    app = ReactTestRenderer.create(
      <AuthProvider>
        <Sonda />
        {conLogin ? <LoginScreen {...({ navigation: { navigate: jest.fn(), isFocused: () => true } } as any)} /> : null}
      </AuthProvider>,
    );
  });
}

async function hacer(accion: () => unknown) {
  let resultado: unknown;
  await act(async () => {
    resultado = accion();
  });
  return resultado;
}

const guardado = async (clave: string) => JSON.parse((await AsyncStorage.getItem(clave)) ?? 'null');
const ids = () => sesion.cuentas.map(c => c.user.id);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

afterEach(async () => {
  await act(async () => app?.unmount());
  app = undefined;
});

test('agregar una cuenta no cierra la otra, y se cambia entre ellas sin contraseña', async () => {
  await montar();
  await hacer(() => sesion.entrar('t-ana', ana));

  await hacer(() => sesion.agregarCuenta());
  expect(sesion.auth).toBeNull();
  expect(sesion.agregando).toBe(true);
  expect(ids()).toEqual([1]);

  await hacer(() => sesion.entrar('t-bruno', bruno));
  expect(sesion.auth?.user.id).toBe(2);
  expect(sesion.agregando).toBe(false);
  expect(ids()).toEqual([2, 1]);

  await hacer(() => sesion.cambiarCuenta(1));
  expect(sesion.auth).toEqual({ token: 't-ana', user: ana });
  expect(ids()).toEqual([1, 2]);
  // Los avisos push pasan a la cuenta activa.
  expect(registrarPush).toHaveBeenLastCalledWith('t-ana');

  expect(await guardado('sesion')).toEqual({ token: 't-ana', user: ana });
  expect((await guardado('cuentas')).map((c: { token: string }) => c.token)).toEqual(['t-ana', 't-bruno']);
});

test('al abrir la app recupera todas las cuentas; las instalaciones de antes solo tenían la activa', async () => {
  await AsyncStorage.setItem('sesion', JSON.stringify({ token: 't-ana', user: ana }));
  await montar();
  expect(sesion.auth?.user.id).toBe(1);
  expect(ids()).toEqual([1]);
  await act(async () => app?.unmount());

  await AsyncStorage.setItem('sesion', JSON.stringify({ token: 't-bruno', user: bruno }));
  await AsyncStorage.setItem(
    'cuentas',
    JSON.stringify([{ token: 't-ana', user: ana }, { token: 't-bruno', user: bruno }, { basura: true }]),
  );
  await montar();
  expect(sesion.auth?.user.id).toBe(2);
  expect(ids()).toEqual([2, 1]);
});

test('si se cierra la app a medio agregar una cuenta, vuelve a la que estaba', async () => {
  await montar();
  await hacer(() => sesion.entrar('t-ana', ana));
  await hacer(() => sesion.agregarCuenta());
  await act(async () => app?.unmount());

  await montar();
  expect(sesion.auth?.user.id).toBe(1);
  expect(sesion.agregando).toBe(false);
});

test('cerrar sesión sigue con la cuenta más reciente y solo da de baja el push de la que sale', async () => {
  await montar();
  await hacer(() => sesion.entrar('t-ana', ana));
  await hacer(() => sesion.agregarCuenta());
  await hacer(() => sesion.entrar('t-bruno', bruno));

  const siguiente = await hacer(() => sesion.salir());
  expect(siguiente).toEqual({ token: 't-ana', user: ana });
  expect(sesion.auth?.user.id).toBe(1);
  expect(ids()).toEqual([1]);
  expect(eliminarPush).toHaveBeenCalledTimes(1);
  expect(eliminarPush).toHaveBeenCalledWith('t-bruno');

  expect(await hacer(() => sesion.salir())).toBeNull();
  expect(sesion.auth).toBeNull();
  expect(sesion.cuentas).toEqual([]);
  expect(await AsyncStorage.getItem('sesion')).toBeNull();
  expect(await AsyncStorage.getItem('cuentas')).toBeNull();
});

test('cerrar todas las sesiones deja el teléfono sin cuentas', async () => {
  await montar();
  await hacer(() => sesion.entrar('t-ana', ana));
  await hacer(() => sesion.agregarCuenta());
  await hacer(() => sesion.entrar('t-bruno', bruno));

  await hacer(() => sesion.salirDeTodas());
  expect(sesion.auth).toBeNull();
  expect(sesion.cuentas).toEqual([]);
  expect(detenerRastreo).toHaveBeenCalled();
  expect(await AsyncStorage.getItem('sesion')).toBeNull();
  expect(await AsyncStorage.getItem('cuentas')).toBeNull();
});

test('el GPS de una cuenta se apaga al pasar a otra, no al ir a agregar y volver', async () => {
  await montar();
  await hacer(() => sesion.entrar('t-ana', ana));
  await hacer(() => sesion.agregarCuenta());
  await hacer(() => sesion.cambiarCuenta(1));
  expect(detenerRastreo).not.toHaveBeenCalled();

  await hacer(() => sesion.agregarCuenta());
  await hacer(() => sesion.entrar('t-bruno', bruno));
  expect(detenerRastreo).toHaveBeenCalledTimes(1);
});

test('si el servidor rechaza una sesión, esa cuenta sale de las guardadas y las demás siguen', async () => {
  await montar();
  const rechazar = jest.mocked(alRechazarToken).mock.calls[0][0]!;
  await hacer(() => sesion.entrar('t-ana', ana));
  await hacer(() => sesion.agregarCuenta());
  await hacer(() => sesion.entrar('t-bruno', bruno));

  await hacer(() => rechazar('t-bruno'));
  expect(sesion.auth).toBeNull();
  expect(ids()).toEqual([1]);
  expect(await AsyncStorage.getItem('sesion')).toBeNull();
});

test('una respuesta tardía de la cuenta anterior no pisa los datos de la activa', async () => {
  await montar();
  await hacer(() => sesion.entrar('t-ana', ana));
  await hacer(() => sesion.agregarCuenta());
  await hacer(() => sesion.entrar('t-bruno', bruno));

  await hacer(() => sesion.actualizarUsuario({ ...ana, name: 'Ana María' }));
  expect(sesion.auth?.user).toEqual(bruno);
  expect(sesion.cuentas.find(c => c.user.id === 1)?.user.name).toBe('Ana María');
});

test('al pasar directo a otra cuenta, los negocios de la anterior no se le pegan', async () => {
  const tienda = { id: 9, nombre: 'Tienda de Ana', rol: 'propietario' };
  jest.mocked(getMisNegocios).mockImplementation(token =>
    token === 't-ana' ? Promise.resolve({ negocios: [tienda], codigoPublico: null } as any) : new Promise(() => {}),
  );
  let negocios: ReturnType<typeof useNegocio>['negocios'] = [];
  function SondaNegocios() {
    negocios = useNegocio().negocios;
    return null;
  }
  await act(async () => {
    app = ReactTestRenderer.create(
      <AuthProvider>
        <NegocioProvider>
          <Sonda />
          <SondaNegocios />
        </NegocioProvider>
      </AuthProvider>,
    );
  });
  await hacer(() => sesion.entrar('t-bruno', bruno));
  await hacer(() => sesion.agregarCuenta());
  await hacer(() => sesion.entrar('t-ana', ana));
  expect(sesion.auth?.user.negocios).toEqual([{ id: 9, nombre: 'Tienda de Ana', rol: 'propietario' }]);

  await hacer(() => sesion.cambiarCuenta(2));
  expect(sesion.auth?.user.id).toBe(2);
  expect(sesion.auth?.user.negocios).toBeUndefined();
  expect(negocios).toEqual([]);
});

describe('login', () => {
  const boton = (etiqueta: string) =>
    app!.root.findAll(n => n.props.accessibilityLabel === etiqueta && typeof n.props.onPress === 'function')[0];
  const escribir = (etiqueta: string, valor: string) =>
    hacer(() => app!.root.findAll(n => n.type === TextInput && n.props.accessibilityLabel === etiqueta)[0].props.onChangeText(valor));

  test('sin cuentas guardadas no ofrece «Continuar como»', async () => {
    await montar(true);
    expect(app!.root.findAll(n => n.props.children === 'Continuar como')).toHaveLength(0);
  });

  test('ofrece las cuentas guardadas a un toque', async () => {
    await AsyncStorage.setItem(
      'cuentas',
      JSON.stringify([{ token: 't-ana', user: ana }, { token: 't-bruno', user: bruno }]),
    );
    await montar(true);
    expect(sesion.auth).toBeNull();

    await hacer(() => boton('Continuar como Bruno').props.onPress());
    expect(sesion.auth).toEqual({ token: 't-bruno', user: bruno });
  });

  test('con el celular y la clave en un teléfono nuevo pide el código; en uno de confianza entra', async () => {
    const entrarMock = entrarConClave as jest.Mock;
    entrarMock.mockResolvedValueOnce({ requiere_codigo: true, telefono: '3001234567', message: 'ok', espera: 60, codigo_prueba: '482913' });
    await montar(true);

    await escribir('Número de celular', '300 123 4567');
    await escribir('Clave de 4 números', '2468');
    expect(entrarMock).toHaveBeenLastCalledWith('3001234567', '2468', undefined);
    expect(sesion.auth).toBeNull();
    expect(JSON.stringify(app!.toJSON())).toContain('482913');

    // La flecha vuelve del código al celular y la clave.
    await hacer(() => boton('Volver al celular y la clave').props.onPress());
    expect(JSON.stringify(app!.toJSON())).not.toContain('482913');
    expect(app!.root.findAll(n => n.type === TextInput && n.props.accessibilityLabel === 'Número de celular')).toHaveLength(1);
  });

  test('en el login a secas no hay flecha; desde «Agregar cuenta» vuelve a la cuenta anterior', async () => {
    await montar(true);
    expect(app!.root.findAll(n => n.props.accessibilityLabel === 'Volver a la cuenta anterior' && typeof n.props.onPress === 'function')).toHaveLength(0);

    await hacer(() => sesion.entrar('t-ana', ana));
    await hacer(() => sesion.agregarCuenta());
    await hacer(() => boton('Volver a la cuenta anterior').props.onPress());
    expect(sesion.auth?.user.id).toBe(1);
  });

  test('una cuenta con teléfono de confianza vuelve desde «Continuar como» con su clave', async () => {
    const dispositivoMock = entrarEnDispositivo as jest.Mock;
    await montar(true);
    await hacer(() => sesion.entrar('t-bruno', bruno, { dispositivo: 'disp-bruno' }));
    await hacer(() => sesion.salir());
    // Sin la sesión, sigue recordada (sin su token de sesión) con su token de confianza.
    expect(sesion.recordadas).toEqual([{ user: bruno }]);
    expect(sesion.dispositivos[2]).toBe('disp-bruno');
    expect(await guardado('dispositivos')).toEqual({ 2: 'disp-bruno' });

    dispositivoMock.mockRejectedValueOnce(
      new ApiError('La clave no es correcta. Te quedan 4 intentos.', 422, { pin: ['La clave no es correcta. Te quedan 4 intentos.'] }),
    );
    dispositivoMock.mockResolvedValueOnce({ token: 't-bruno-2', user: bruno, dispositivo: 'disp-bruno' });
    await hacer(() => boton('Continuar como Bruno con tu clave').props.onPress());
    await escribir('Escribe tu clave de 4 números', '1357');
    expect(dispositivoMock).toHaveBeenLastCalledWith('disp-bruno', '1357');
    expect(sesion.auth).toBeNull();

    await escribir('Escribe tu clave de 4 números', '2468');
    expect(sesion.auth).toEqual({ token: 't-bruno-2', user: bruno });
  });

  test('si el teléfono ya no es de confianza, lo olvida y deja el celular listo para entrar', async () => {
    (entrarEnDispositivo as jest.Mock).mockRejectedValueOnce(
      new ApiError('Este teléfono ya no recuerda tu cuenta.', 422, { dispositivo: ['Este teléfono ya no recuerda tu cuenta.'] }, { codigo: 'dispositivo_desconocido' }),
    );
    const brunoVerificado = { ...bruno, telefono_verificado: true };
    await montar(true);
    await hacer(() => sesion.entrar('t-bruno', brunoVerificado, { dispositivo: 'disp-bruno' }));
    await hacer(() => sesion.salir());

    await hacer(() => boton('Continuar como Bruno con tu clave').props.onPress());
    await escribir('Escribe tu clave de 4 números', '2468');

    expect(sesion.dispositivos[2]).toBeUndefined();
    expect(app!.root.findAll(n => n.type === TextInput && n.props.accessibilityLabel === 'Número de celular')[0].props.value).toBe('3001234567');
  });

  test('«Cerrar todas las sesiones» y «Quitar de este teléfono» olvidan el teléfono de confianza', async () => {
    await montar();
    await hacer(() => sesion.entrar('t-ana', ana, { dispositivo: 'disp-ana' }));
    await hacer(() => sesion.entrar('t-bruno', bruno, { dispositivo: 'disp-bruno' }));
    await hacer(() => sesion.salir());
    await hacer(() => sesion.olvidarRecordada(2));
    expect(sesion.dispositivos).toEqual({ 1: 'disp-ana' });

    await hacer(() => sesion.salirDeTodas());
    expect(sesion.dispositivos).toEqual({});
    expect(await guardado('dispositivos')).toBeNull();
  });

  test('desde «Agregar cuenta», «atrás» vuelve a la cuenta anterior', async () => {
    type Oyente = Parameters<typeof BackHandler.addEventListener>[1];
    const oyentes: Oyente[] = [];
    const espia = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_evento, oyente) => {
      oyentes.push(oyente);
      return { remove: () => oyentes.splice(oyentes.indexOf(oyente), 1) };
    });
    await montar(true);
    expect(oyentes).toHaveLength(0);

    await hacer(() => sesion.entrar('t-ana', ana));
    await hacer(() => sesion.agregarCuenta());
    expect(oyentes).toHaveLength(1);

    let atendido: boolean | null | undefined;
    await hacer(() => {
      atendido = oyentes[0]({} as Parameters<Oyente>[0]);
    });
    expect(atendido).toBe(true);
    expect(sesion.auth?.user.id).toBe(1);
    espia.mockRestore();
  });
});
