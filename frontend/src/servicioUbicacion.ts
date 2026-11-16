/**
 * Servicio en primer plano (Android) para que el GPS del domiciliario siga
 * llegando con la app en segundo plano: minimizada, con la pantalla apagada o
 * mientras usa otra app (Google Maps, WhatsApp...).
 *
 * Android solo le da la ubicación unas pocas veces por hora a una app que no se
 * ve. Con un servicio en primer plano de tipo «location» —el que muestra la
 * notificación fija «Compartiendo tu ubicación»— la app cuenta como en uso: el
 * GPS sigue a su ritmo y el JS sigue vivo para enviar cada posición.
 *
 * Notifee arranca el servicio al mostrar la notificación con
 * `asForegroundService` y corre `registrarServicioUbicacion` como tarea headless
 * mientras dure; la promesa queda abierta hasta `detenerServicioUbicacion`.
 *
 * Reglas de Android 14+: hay que iniciarlo con la app en primer plano y con el
 * permiso de ubicación ya dado; por eso lo inicia useCompartirUbicacion
 * (ubicacion.ts) solo con AppState 'active'. El tipo «location» está declarado
 * en AndroidManifest.xml (el de Notifee trae «shortService», que dura 3 min).
 */
import notifee, { AndroidForegroundServiceType, AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import { Platform } from 'react-native';

export const CANAL_UBICACION = 'ubicacion';
export const ID_AVISO_UBICACION = 'compartiendo-ubicacion';

let terminarTarea: (() => void) | null = null;

// Iniciar y detener van en fila: si se piden seguidos (salió de turno justo al
// entrar), el servicio no puede quedar prendido después de haberlo apagado.
let cola: Promise<void> = Promise.resolve();
function enFila(tarea: () => Promise<void>): Promise<void> {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => {});
  return resultado;
}

/** En index.js, antes de registrar la app: lo que corre mientras dura el servicio. */
export function registrarServicioUbicacion() {
  if (Platform.OS !== 'android') return;
  notifee.registerForegroundService(
    () =>
      new Promise<void>(resolve => {
        terminarTarea = resolve;
      }),
  );
}

/** Muestra la notificación fija y arranca el servicio (si ya corre, solo la actualiza). */
export function iniciarServicioUbicacion(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  return enFila(mostrarAviso);
}

async function mostrarAviso(): Promise<void> {
  const channelId = await notifee.createChannel({
    id: CANAL_UBICACION,
    name: 'Ubicación mientras trabajas',
    description: 'Aviso fijo mientras compartes tu ubicación con el cliente y el negocio.',
    importance: AndroidImportance.LOW,
    vibration: false,
  });
  await notifee.displayNotification({
    id: ID_AVISO_UBICACION,
    title: 'Compartiendo tu ubicación',
    body: 'El cliente y el negocio ven por dónde vas, aunque uses otra app o apagues la pantalla.',
    android: {
      channelId,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION],
      color: '#E8A019', // dorado Vitrina
      ongoing: true,
      autoCancel: false,
      onlyAlertOnce: true,
      visibility: AndroidVisibility.PUBLIC,
      // Tocarla vuelve a la app (sin datos: no abre ninguna pantalla en especial).
      pressAction: { id: 'default' },
    },
  });
}

/** Detiene el servicio y quita la notificación. */
export function detenerServicioUbicacion(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  return enFila(async () => {
    const terminar = terminarTarea;
    terminarTarea = null;
    terminar?.();
    await notifee.stopForegroundService();
    await notifee.cancelNotification(ID_AVISO_UBICACION);
  });
}
