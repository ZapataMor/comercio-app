import notifee, { AndroidImportance, Event, EventType } from '@notifee/react-native';
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
import { detenerAlarma, sonarAlarma } from './alarmaPedidos';
import { eliminarDeviceToken, registrarDeviceToken, Usuario } from './api';
import {
  ACCION_ACEPTAR,
  ACCION_RECHAZAR,
  aceptarOferta,
  mostrarOferta,
  quitarOferta,
  rechazarOferta,
} from './ofertasPedidos';
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

/**
 * Los avisos de la alarma de pedidos: cuando llega uno nuevo suena, y cuando
 * alguien del equipo lo atiende (o lo cancelan, o vence) se calla.
 */
async function atenderAlarma(data: Record<string, string>) {
  const pedidoId = Number(data.pedido_id);
  if (!Number.isFinite(pedidoId)) {
    return;
  }

  try {
    if (data.tipo === 'nuevo_pedido') {
      await sonarAlarma({
        pedidoId,
        negocioId: Number(data.negocio_id),
        titulo: data.titulo ?? '¡Nuevo pedido! 🛒',
        cuerpo: data.cuerpo ?? 'Acéptalo antes de que venza.',
        segundos: Number(data.segundos),
      });
    } else if (data.tipo === 'pedido_atendido' || data.tipo === 'pedido_cancelado') {
      await detenerAlarma(pedidoId);
    }
  } catch (error) {
    console.warn('No se pudo actualizar la alarma de pedidos.', error);
  }
}

/** Otro tomó el pedido o se canceló: su notificación ya no sirve para nada. */
async function retirarOferta(data: Record<string, string>) {
  const pedidoId = Number(data.pedido_id);
  if (data.tipo !== 'pedido_no_disponible' || !Number.isFinite(pedidoId)) {
    return;
  }

  try {
    await quitarOferta(pedidoId);
  } catch (error) {
    console.warn('No se pudo retirar el pedido disponible.', error);
  }
}

/**
 * Con la app abierta el pedido disponible se ve en el modal OfertaPedido; aquí
 * solo se publica la notificación, y solo la llama el código de segundo plano.
 */
async function ofrecerPedido(data: Record<string, string>) {
  const pedidoId = Number(data.pedido_id);
  if (data.tipo !== 'pedido_disponible' || !Number.isFinite(pedidoId)) {
    return;
  }

  try {
    await mostrarOferta(pedidoId, data.titulo ?? 'Pedido listo para recoger 🛵', data.cuerpo ?? '');
  } catch (error) {
    console.warn('No se pudo mostrar el pedido disponible.', error);
  }
}

/** Aceptar: pasa a Mis entregas y el modal pregunta en cuánto lo recoge. */
function aceptarDesdeNotificacion(data: Record<string, string>, user?: Usuario) {
  const pedidoId = Number(data.pedido_id);
  quitarOferta(pedidoId).catch(() => {});
  aceptarOferta(pedidoId);
  abrirNotificacion(data, user);
}

/** Toques en una notificación de Notifee, con la app abierta o en segundo plano. */
async function atenderToque({ type, detail }: Event, user?: Usuario) {
  const data = dataPlano(detail.notification?.data);
  if (type === EventType.PRESS && detail.notification?.data) {
    // En segundo plano Android abre la app y queda pendiente hasta que la
    // navegación esté lista.
    abrirNotificacion(data, user);
  } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === ACCION_ACEPTAR) {
    aceptarDesdeNotificacion(data, user);
  } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === ACCION_RECHAZAR) {
    await rechazarOferta(Number(data.pedido_id));
  }
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
    atenderAlarma(dataPlano(message.data));
    retirarOferta(dataPlano(message.data));
    // Los de datos (la alarma) no traen notificación que mostrar.
    if (message.notification) {
      mostrarNotificacionForeground(message);
    }
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

  // La alarma la muestra Notifee: si se tocó con la app cerrada, se sabe aquí.
  notifee.getInitialNotification().then(inicial => {
    if (!inicial?.notification.data) {
      return;
    }
    const data = dataPlano(inicial.notification.data);
    if (inicial.pressAction?.id === ACCION_ACEPTAR) {
      aceptarDesdeNotificacion(data, user);
    } else {
      abrirNotificacion(data, user);
    }
  });

  const unsubscribeNotifee = notifee.onForegroundEvent(evento => {
    atenderToque(evento, user);
  });

  return () => {
    unsubscribeMessage();
    unsubscribeOpened();
    unsubscribeNotifee();
  };
}

export function configurarMensajesBackground() {
  // Con la app cerrada o en segundo plano, solo este código puede arrancar o
  // callar la alarma de pedidos y ofrecerle pedidos al domiciliario.
  setBackgroundMessageHandler(fcm, async message => {
    const data = dataPlano(message.data);
    await atenderAlarma(data);
    await ofrecerPedido(data);
    await retirarOferta(data);
  });
  notifee.onBackgroundEvent(evento => atenderToque(evento));
}
