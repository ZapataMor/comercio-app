/**
 * src/google.ts: cuándo aparece «Continuar con Google» y cómo se traducen
 * las respuestas del módulo nativo (Credential Manager).
 * @format
 */

type Nativo = { elegirCuenta: jest.Mock };

/** Carga src/google.ts con la plataforma, el ID de cliente y el módulo nativo dados. */
function cargar({ os = 'android', clienteId = 'web-123.apps.googleusercontent.com', nativo }: { os?: string; clienteId?: string; nativo?: Nativo }) {
  let google!: typeof import('../src/google');
  // react-native entrega Platform y NativeModules al momento de usarlos, desde
  // el registro normal de módulos: se fijan ahí y en el aislado.
  const fijar = (rn: any) => {
    rn.Platform.OS = os;
    rn.NativeModules.GoogleAcceso = nativo;
  };
  fijar(require('react-native'));
  jest.isolateModules(() => {
    fijar(require('react-native'));
    jest.doMock('../src/config', () => ({ ...jest.requireActual('../src/config'), GOOGLE_WEB_CLIENT_ID: clienteId }));
    google = require('../src/google');
  });
  return google;
}

afterEach(() => {
  jest.dontMock('../src/config');
});

test('solo está disponible en Android con el módulo nativo y el ID de cliente', () => {
  const nativo = { elegirCuenta: jest.fn() };
  expect(cargar({ nativo }).googleDisponible()).toBe(true);
  expect(cargar({ nativo, clienteId: '' }).googleDisponible()).toBe(false);
  expect(cargar({ nativo, os: 'ios' }).googleDisponible()).toBe(false);
  expect(cargar({ nativo: undefined }).googleDisponible()).toBe(false);
});

test('devuelve el token de la cuenta elegida, con el ID de cliente web', async () => {
  const nativo = { elegirCuenta: jest.fn().mockResolvedValue('id-token') };
  await expect(cargar({ nativo }).elegirCuentaGoogle()).resolves.toBe('id-token');
  expect(nativo.elegirCuenta).toHaveBeenCalledWith('web-123.apps.googleusercontent.com');
});

test('cerrar la ventana no es un error; los demás fallos dan un mensaje claro', async () => {
  const error = (code: string) => Object.assign(new Error(code), { code });
  const nativo = { elegirCuenta: jest.fn() };
  const google = cargar({ nativo });
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  nativo.elegirCuenta.mockRejectedValueOnce(error('cancelado'));
  await expect(google.elegirCuentaGoogle()).resolves.toBeNull();

  nativo.elegirCuenta.mockRejectedValueOnce(error('sin_cuentas'));
  await expect(google.elegirCuentaGoogle()).rejects.toThrow('No encontramos cuentas de Google');

  nativo.elegirCuenta.mockRejectedValueOnce(error('error'));
  await expect(google.elegirCuentaGoogle()).rejects.toThrow('No fue posible entrar con Google');
});
