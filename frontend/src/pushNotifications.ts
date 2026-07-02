import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import {
  FirebaseMessagingTypes,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { eliminarDeviceToken, registrarDeviceToken, Usuario } from './api';
import { abrirNotificacion } from './RootNavigation';

const fcm = getMessaging();
const CANAL_PEDIDOS = 'pedidos';

function dataPlano(data?: Record<string, unknown>): Record<string, string> {
  const plano: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      plano[key] = String(value);
    }
  }
  return plano;
}

async function pedirPermisoAndroid() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function prepararPermisos() {
  await pedirPermisoAndroid();
  await requestPermission(fcm);
}

async function canalPedidos() {
  return notifee.createChannel({
    id: CANAL_PEDIDOS,
    name: 'Pedidos',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

async function mostrarNotificacionForeground(message: FirebaseMessagingTypes.RemoteMessage) {
  const title = message.notification?.title ?? 'Nueva notificacion';
  const body = message.notification?.body ?? 'Toca para ver el detalle.';
  const data = dataPlano(message.data);

  try {
    const channelId = await canalPedidos();
    await notifee.displayNotification({
      title,
      body,
      data,
      android: {
        channelId,
        color: '#E8A019', // dorado Vitrina: tiñe el acento de la notificación
        pressAction: { id: 'default' },
      },
    });
  } catch (error) {
    console.warn('No se pudo mostrar la notificacion local.', error);
  }
}

export async function registrarPush(tokenAuth: string): Promise<string | null> {
  try {
    await prepararPermisos();
    await canalPedidos();

    const token = await getToken(fcm);
    if (!token) {
      return null;
    }

    await registrarDeviceToken(tokenAuth, token);
    console.log('Token FCM registrado en el backend.');
    return token;
  } catch (error) {
    console.warn('No se pudo registrar el token FCM.', error);
    return null;
  }
}

export async function eliminarPush(tokenAuth: string): Promise<void> {
  try {
    const token = await getToken(fcm);
    if (token) {
      await eliminarDeviceToken(tokenAuth, token);
    }
  } catch (error) {
    console.warn('No se pudo eliminar el token FCM.', error);
  }
}

export function escucharRotacionToken(tokenAuth: string) {
  return onTokenRefresh(fcm, async token => {
    try {
      await registrarDeviceToken(tokenAuth, token);
    } catch (error) {
      console.warn('No se pudo actualizar el token FCM.', error);
    }
  });
}

export function configurarMensajesForeground(
  user: Usuario | undefined,
  onMensaje: (message: FirebaseMessagingTypes.RemoteMessage) => void,
) {
  const unsubscribeMessage = onMessage(fcm, message => {
    mostrarNotificacionForeground(message);
    onMensaje(message);
  });

  const unsubscribeOpened = onNotificationOpenedApp(fcm, message => {
    abrirNotificacion(dataPlano(message.data), user);
  });

  getInitialNotification(fcm).then(message => {
    if (message?.data) {
      abrirNotificacion(dataPlano(message.data), user);
    }
  });

  const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data) {
      abrirNotificacion(dataPlano(detail.notification.data), user);
    }
  });

  return () => {
    unsubscribeMessage();
    unsubscribeOpened();
    unsubscribeNotifee();
  };
}

export function configurarMensajesBackground() {
  setBackgroundMessageHandler(fcm, async () => {});
  notifee.onBackgroundEvent(async ({ type }) => {
    if (type === EventType.PRESS) {
      // Android abre la app; la navegacion se resuelve cuando React Navigation esta listo.
    }
  });
}
