/**
 * Pedidos que se le ofrecen al domiciliario en turno cuando el negocio los deja
 * listos. Con la app abierta se ven en el modal OfertaPedido; con la app cerrada
 * o en segundo plano, en una notificación con Aceptar y Rechazar.
 *
 * Rechazar no toca el servidor: el pedido sigue disponible para los demás, y
 * para este domiciliario en "Mis entregas". Solo deja de ofrecérsele, por eso se
 * guarda en el teléfono; la notificación lo rechaza sin abrir la app.
 *
 * Aceptar abre la app, y el modal sigue con el proceso normal: preguntar en
 * cuánto lo recoge.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';

export const ACCION_ACEPTAR = 'aceptar-oferta';
export const ACCION_RECHAZAR = 'rechazar-oferta';

const CANAL_OFERTAS = 'ofertas-domiciliario';
const PREFIJO = 'oferta-pedido-';
const CLAVE_RECHAZADOS = 'ofertas-rechazadas';
/** Los ids de pedido solo crecen: con los últimos basta. */
const MAX_RECHAZADOS = 100;

const idOferta = (pedidoId: number) => `${PREFIJO}${pedidoId}`;

export async function mostrarOferta(pedidoId: number, titulo: string, cuerpo: string): Promise<void> {
  const channelId = await notifee.createChannel({
    id: CANAL_OFERTAS,
    name: 'Pedidos para recoger',
    description: 'Pedidos listos que puedes aceptar mientras estás en turno.',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  await notifee.displayNotification({
    id: idOferta(pedidoId),
    title: titulo,
    body: cuerpo,
    data: { tipo: 'pedido_disponible', pedido_id: String(pedidoId) },
    android: {
      channelId,
      color: '#E8A019', // dorado Vitrina
      pressAction: { id: 'default' },
      actions: [
        { title: 'Aceptar', pressAction: { id: ACCION_ACEPTAR, launchActivity: 'default' } },
        { title: 'Rechazar', pressAction: { id: ACCION_RECHAZAR } },
      ],
    },
  });
}

export function quitarOferta(pedidoId: number): Promise<void> {
  return notifee.cancelNotification(idOferta(pedidoId));
}

export async function ofertasRechazadas(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_RECHAZADOS);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export async function rechazarOferta(pedidoId: number): Promise<void> {
  const lista = await ofertasRechazadas();
  const nueva = [...lista.filter(id => id !== pedidoId), pedidoId].slice(-MAX_RECHAZADOS);
  await AsyncStorage.setItem(CLAVE_RECHAZADOS, JSON.stringify(nueva));
  await quitarOferta(pedidoId);
}

// La app arranca por la notificación antes de que exista el modal: el pedido
// aceptado espera aquí hasta que el modal se ponga a escuchar.
let pendiente: number | null = null;
let oyente: ((pedidoId: number) => void) | null = null;
// Android puede avisar el mismo toque por dos caminos.
const aceptadas = new Set<number>();

export function aceptarOferta(pedidoId: number) {
  if (aceptadas.has(pedidoId)) return;
  aceptadas.add(pedidoId);
  if (oyente) {
    oyente(pedidoId);
  } else {
    pendiente = pedidoId;
  }
}

/** Para el modal. Devuelve cómo dejar de escuchar. */
export function alAceptarOferta(alAceptar: (pedidoId: number) => void): () => void {
  oyente = alAceptar;
  if (pendiente != null) {
    const id = pendiente;
    pendiente = null;
    alAceptar(id);
  }
  return () => {
    oyente = null;
  };
}
