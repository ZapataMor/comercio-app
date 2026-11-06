/**
 * El reporte de errores: apagado en desarrollo y sin datos de las personas.
 */
import * as Sentry from '@sentry/react-native';
import { iniciarReporteErrores, limpiarMigaja } from '../src/errores';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn(componente => componente),
}));

test('no envía nada en desarrollo ni sin dirección configurada', () => {
  iniciarReporteErrores();

  expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
});

test('nunca pide datos de la persona ni capturas de pantalla', () => {
  iniciarReporteErrores();

  expect(Sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({ sendDefaultPii: false, attachScreenshot: false, attachViewHierarchy: false }),
  );
});

test('descarta los mensajes de consola', () => {
  expect(limpiarMigaja({ category: 'console', message: 'cliente: Ana, 300 1234567' })).toBeNull();
});

test('quita los parámetros de las URL y deja lo demás', () => {
  const miga = limpiarMigaja({
    category: 'xhr',
    data: { url: 'https://api.vitrina.co/api/buscar?q=algo', status_code: 500 },
  });

  expect(miga?.data).toEqual({ url: 'https://api.vitrina.co/api/buscar', status_code: 500 });
});
