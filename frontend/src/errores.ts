import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from './config';

/**
 * Reporte de errores de la app (Sentry): cierres inesperados y errores que nadie
 * atrapó, con la pantalla y la versión donde pasaron.
 *
 * Solo funciona en la versión final y con SENTRY_DSN puesto: en desarrollo los
 * errores ya salen en pantalla. No se envían datos de la persona (nombre, correo,
 * IP) ni capturas de pantalla, y las peticiones a la API quedan sin sus parámetros.
 */
export function iniciarReporteErrores(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: !__DEV__ && SENTRY_DSN !== '',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb: limpiarMigaja,
  });
}

/**
 * Las "migas" son lo último que pasó antes del error. Se quitan los mensajes de
 * consola (pueden traer datos del pedido) y los parámetros de las URL.
 */
export function limpiarMigaja(miga: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (miga.category === 'console') {
    return null;
  }
  const url = miga.data?.url;
  if (typeof url === 'string') {
    return { ...miga, data: { ...miga.data, url: url.split('?')[0] } };
  }
  return miga;
}

/** Envuelve la app para atrapar sus errores. */
export const conReporteErrores = Sentry.wrap;
