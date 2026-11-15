/**
 * Aviso de que el carrito está por vencer (10 minutos antes de su hora).
 *
 * Con la app abierta lo muestra un modal (AvisoCarritoPorVencer). Con la app
 * en segundo plano o cerrada, una notificación programada en el teléfono: se
 * programa al salir de la app y se retira al volver, para no avisar dos veces.
 */
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

/** Cuánto antes de vencer se avisa. */
export const AVISO_ANTES_DE_VENCER = 10 * 60 * 1000;

const ID_NOTIFICACION = 'carrito-por-vencer';
const CANAL = 'carrito';

/** Momento del aviso para un carrito que vence en `venceEn` (o null si no hay que avisar). */
export function momentoAviso(venceEn: number | null, ahora = Date.now()): number | null {
  if (venceEn == null) return null;
  const momento = venceEn - AVISO_ANTES_DE_VENCER;
  return momento > ahora ? momento : null;
}

/** Programa la notificación para cuando falten 10 minutos. Devuelve el momento, o null. */
export async function programarNotificacionCarrito(venceEn: number | null, negocio: string | null): Promise<number | null> {
  await retirarNotificacionCarrito();
  const momento = momentoAviso(venceEn);
  if (momento == null) return null;
  try {
    const channelId = await notifee.createChannel({ id: CANAL, name: 'Carrito', importance: AndroidImportance.HIGH });
    await notifee.createTriggerNotification(
      {
        id: ID_NOTIFICACION,
        title: 'Tu carrito vence en 10 minutos',
        body: negocio
          ? `Confirma tu pedido de ${negocio} antes de que se vacíe el carrito.`
          : 'Confirma tu pedido antes de que se vacíe el carrito.',
        data: { tipo: 'carrito_por_vencer' },
        android: { channelId, color: '#E8A019', pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: momento },
    );
    return momento;
  } catch {
    // Sin permiso de notificaciones (o en pruebas): el modal avisará al volver.
    return null;
  }
}

/** Quita la notificación programada (y la ya mostrada, si la hay). */
export async function retirarNotificacionCarrito(): Promise<void> {
  try {
    await notifee.cancelNotification(ID_NOTIFICACION);
  } catch {
    // Nada que retirar.
  }
}
