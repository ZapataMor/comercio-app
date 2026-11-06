/**
 * Alarma de pedidos nuevos: suena cada 10 segundos desde que llega un pedido
 * hasta que alguien del negocio lo acepta (o lo rechaza, o vence).
 *
 * Es una notificación que Android repite sola, así que sigue sonando con la
 * app cerrada: el sonido (res/raw/alarma_pedido.wav) dura justo 10 segundos,
 * con los tonos al inicio y silencio hasta el final, y `loopSound` lo repite.
 *
 *  - Con la app cerrada o en segundo plano la arranca y la calla el push
 *    (ver pushNotifications.ts).
 *  - Con la app abierta, `useAlarmaPedidos` además le pregunta al servidor qué
 *    falta por aceptar, por si un push no llegó.
 *
 * Android no permite más de un sonido a la vez, así que con varios pedidos
 * esperando suena el último. Al callar ese hay que hacer sonar otro.
 *
 * Android también calla el sonido al bajar la cortina de notificaciones, sin
 * avisarle a la app. Por eso, al volver a la app, si algo sigue esperando,
 * la alarma se reanuda.
 */
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  DisplayedNotification,
} from '@notifee/react-native';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPedidosPorAceptar, PedidoPorAceptar } from './api';
import { alCambiarDesdePush } from './usePolling';

// Android no deja cambiar el sonido de un canal ya creado: si cambia el sonido,
// hay que cambiar este id.
const CANAL_ALARMA = 'pedidos-alarma';
const PREFIJO = 'alarma-pedido-';
/** Cada cuánto se pregunta al servidor con la app abierta. */
const CADA_MS = 10000;
/** Vibra al ritmo del sonido: dos toques y espera hasta completar 10 segundos. */
const VIBRACION = [300, 300, 300, 9100];
/**
 * Publicar dos veces la misma notificación seguidas la deja MUDA: Android toma la
 * segunda por ruido ("recently noisy") y corta el sonido de la primera. Y con la
 * app abierta llegan casi a la vez el push y la respuesta del servidor.
 */
const ESPERA_MISMA_ALARMA_MS = 15000;
const ultimoAviso = new Map<number, number>();

/** Pedido por aceptar con la hora en que vence, para contar lo que le queda. */
export type PedidoEnEspera = PedidoPorAceptar & { vence: number };

export type DatosAlarma = {
  pedidoId: number;
  negocioId: number;
  titulo: string;
  cuerpo: string;
  /** Lo que le queda al pedido antes de vencer: la alarma se calla sola ahí. */
  segundos: number;
};

const idAlarma = (pedidoId: number) => `${PREFIJO}${pedidoId}`;

/** `repique`: la alarma ya existe y hay que hacerla sonar de nuevo a propósito. */
export async function sonarAlarma(alarma: DatosAlarma, repique = false): Promise<void> {
  if (alarma.segundos <= 0) return;

  const ahora = Date.now();
  const anterior = ultimoAviso.get(alarma.pedidoId);
  if (!repique && anterior && ahora - anterior < ESPERA_MISMA_ALARMA_MS) return;
  ultimoAviso.set(alarma.pedidoId, ahora);

  const channelId = await notifee.createChannel({
    id: CANAL_ALARMA,
    name: 'Alarma de pedidos nuevos',
    description: 'Suena cada 10 segundos hasta que alguien acepte el pedido.',
    importance: AndroidImportance.HIGH,
    sound: 'alarma_pedido',
    vibration: true,
    vibrationPattern: VIBRACION,
    visibility: AndroidVisibility.PUBLIC,
  });

  await notifee.displayNotification({
    id: idAlarma(alarma.pedidoId),
    title: alarma.titulo,
    body: alarma.cuerpo,
    data: {
      tipo: 'nuevo_pedido',
      pedido_id: String(alarma.pedidoId),
      negocio_id: String(alarma.negocioId),
      vence: String(Date.now() + alarma.segundos * 1000),
    },
    android: {
      channelId,
      category: AndroidCategory.ALARM,
      color: '#E8A019', // dorado Vitrina
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      timeoutAfter: alarma.segundos * 1000,
      visibility: AndroidVisibility.PUBLIC,
      pressAction: { id: 'default' },
    },
  });
}

async function alarmasActivas(): Promise<DisplayedNotification[]> {
  const mostradas = await notifee.getDisplayedNotifications();
  return mostradas.filter(m => m.id?.startsWith(PREFIJO));
}

/** Vuelve a hacer sonar una alarma que Android dejó callada (ver arriba). */
async function repicar(mostrada: DisplayedNotification): Promise<void> {
  const data = mostrada.notification.data ?? {};
  await sonarAlarma(
    {
      pedidoId: Number(data.pedido_id),
      negocioId: Number(data.negocio_id),
      titulo: mostrada.notification.title ?? '',
      cuerpo: mostrada.notification.body ?? '',
      segundos: Math.ceil((Number(data.vence) - Date.now()) / 1000),
    },
    true,
  );
}

/** Calla la alarma de un pedido; si otros siguen esperando, suena uno de ellos. */
export async function detenerAlarma(pedidoId: number): Promise<void> {
  const id = idAlarma(pedidoId);
  ultimoAviso.delete(pedidoId);
  const activas = await alarmasActivas();
  await notifee.cancelNotification(id);

  const quedan = activas.filter(a => a.id !== id);
  if (quedan.length < activas.length && quedan.length > 0) {
    await repicar(quedan[quedan.length - 1]);
  }
}

export async function detenerTodasLasAlarmas(): Promise<void> {
  const activas = await alarmasActivas();
  await Promise.all(activas.map(a => notifee.cancelNotification(a.id!)));
}

/**
 * Deja sonando exactamente los pedidos que siguen sin aceptar. `reanudar`: la
 * persona acaba de volver a la app y Android pudo haber callado la alarma.
 */
export async function sincronizarAlarmas(pedidos: PedidoPorAceptar[], reanudar = false): Promise<void> {
  const activas = await alarmasActivas();
  const porAceptar = new Set(pedidos.map(p => idAlarma(p.id)));

  const sobran = activas.filter(a => !porAceptar.has(a.id!));
  await Promise.all(sobran.map(a => notifee.cancelNotification(a.id!)));

  const sonando = new Set(activas.map(a => a.id));
  const faltan = pedidos.filter(p => !sonando.has(idAlarma(p.id)));
  for (const p of faltan) {
    await sonarAlarma({
      pedidoId: p.id,
      negocioId: p.negocio_id,
      titulo: '¡Nuevo pedido! 🛒',
      cuerpo: `Pedido #${p.codigo}${p.negocio ? ` en ${p.negocio}` : ''}. Acéptalo antes de que venza.`,
      segundos: p.segundos,
    });
  }

  const quedan = activas.filter(a => porAceptar.has(a.id!));
  if ((sobran.length > 0 || reanudar) && faltan.length === 0 && quedan.length > 0) {
    await repicar(quedan[quedan.length - 1]);
  }
}

/**
 * Con la app abierta, mantiene las alarmas al día con lo que dice el servidor.
 * `activa`: la persona tiene algún negocio (si cierra sesión, todo se calla).
 * Devuelve lo que falta por aceptar, para mostrarlo en pantalla.
 */
export function useAlarmaPedidos(token: string | null, activa: boolean): PedidoEnEspera[] {
  const [enEspera, setEnEspera] = useState<PedidoEnEspera[]>([]);

  useEffect(() => {
    if (!token || !activa) {
      setEnEspera([]);
      detenerTodasLasAlarmas().catch(() => {});
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    let vigente = true;

    // Sin red no se toca nada: lo que estaba sonando sigue sonando.
    const revisar = (reanudar = false) => {
      getPedidosPorAceptar(token)
        .then(pedidos => {
          if (!vigente) return undefined;
          const recibido = Date.now();
          setEnEspera(pedidos.map(p => ({ ...p, vence: recibido + p.segundos * 1000 })));
          return sincronizarAlarmas(pedidos, reanudar);
        })
        .catch(() => {});
    };
    const iniciar = () => {
      revisar(true);
      if (!timer) timer = setInterval(() => revisar(), CADA_MS);
    };
    const detener = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') iniciar();
    const sub = AppState.addEventListener('change', estado => (estado === 'active' ? iniciar() : detener()));
    const quitarOyente = alCambiarDesdePush(() => revisar());

    return () => {
      vigente = false;
      detener();
      sub.remove();
      quitarOyente();
    };
  }, [token, activa]);

  return enEspera;
}
