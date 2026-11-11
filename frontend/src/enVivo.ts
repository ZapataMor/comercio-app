/**
 * Cambios en vivo: lo que hace otra persona (o tú en otro teléfono) se ve aquí
 * al instante, sin esperar ni tocar «refrescar».
 *
 * El backend avisa por WebSocket (Laravel Reverb, protocolo de Pusher) QUÉ
 * cambió —el «tema»— y de quién (ids). No manda los datos: cada pantalla que
 * muestra ese tema los vuelve a pedir a la API (ver useEnVivo en usePolling.ts).
 *
 * Temas (ver backend/app/Support/EnVivo.php):
 *  negocio      datos o estado (abierto/cerrado) de un negocio   { negocio_id? }
 *  cierre       hay que confirmar el cierre automático (equipo)  { negocio_id }
 *  catalogo     productos, servicios o categorías                { negocio_id }
 *  resenas      reseñas de un negocio                            { negocio_id? }
 *  agenda       horarios libres para citas                       { negocio_id }
 *  ajustes      tarifa de domicilio
 *  barrios      barrios aprobados o sugeridos
 *  pedidos      un pedido cambió                                 { id, negocio_id }
 *  ubicacion    se movió el domiciliario de un pedido            { id, negocio_id }
 *  disponibles  pedidos para tomar (domiciliarios)               { id, negocio_id }
 *  citas        una cita cambió                                  { id, negocio_id }
 *  equipo       miembros o invitaciones de un negocio            { negocio_id }
 *  negocios     cambió a qué negocios pertenezco o mis permisos  { negocio_id? }
 *  invitaciones me invitaron o cambió una invitación mía
 *  perfil       mis roles, datos o turno                         { id }
 *  direcciones  mis direcciones
 *  reputacion   confiabilidad de un negocio o domiciliario       { tipo, id }
 *  usuarios, reportes, mapa: paneles del admin
 *  *            se recuperó la conexión: todo puede estar viejo
 *
 * Si no hay conexión con Reverb la app sigue funcionando con el refresco de
 * respaldo de cada pantalla.
 */
import Pusher from 'pusher-js/react-native';
import { getCanalesEnVivo, Usuario } from './api';
import { API_URL, EN_VIVO_KEY, EN_VIVO_PUERTO_DESARROLLO } from './config';

export type AvisoEnVivo = {
  tema: string;
  id?: number;
  negocio_id?: number | null;
  tipo?: string;
};

type Oyente = (aviso: AvisoEnVivo) => void;

const oyentes = new Set<Oyente>();
let cliente: Pusher | null = null;
let tokenActual: string | null = null;
let suscritos = new Set<string>();
let conectado = false;
let yaEstuvoConectado = false;

/** ¿Llegan los avisos ahora mismo? Si no, las pantallas refrescan más seguido. */
export function enVivoConectado(): boolean {
  return conectado;
}

/** Escucha todos los avisos. Devuelve cómo dejar de escuchar. */
export function alCambiarEnVivo(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function avisar(aviso: AvisoEnVivo) {
  oyentes.forEach(o => {
    try {
      o(aviso);
    } catch (e) {
      console.warn('Error atendiendo un cambio en vivo.', e);
    }
  });
}

/** Servidor de WebSockets según la API: ver EN_VIVO_KEY en config.ts. */
export function servidorEnVivo(apiUrl: string = API_URL) {
  const m = apiUrl.match(/^(https?):\/\/(\[[^\]]+\]|[^/:]+)(?::(\d+))?/i);
  const tls = m?.[1].toLowerCase() === 'https';
  const host = m?.[2] ?? 'localhost';
  const puerto = tls ? Number(m?.[3] ?? 443) : EN_VIVO_PUERTO_DESARROLLO;
  return { host, puerto, tls };
}

function suscribir(canal: string) {
  if (!cliente || suscritos.has(canal)) return;
  suscritos.add(canal);
  const ch = cliente.subscribe(canal);
  ch.bind('cambio', (datos: AvisoEnVivo) => {
    if (datos && typeof datos.tema === 'string') avisar(datos);
  });
}

function desuscribir(canal: string) {
  if (!cliente || !suscritos.has(canal)) return;
  suscritos.delete(canal);
  cliente.unsubscribe(canal);
}

/**
 * Vuelve a pedir qué canales escuchar (cambian si entro a un equipo o me dan
 * otro rol) y devuelve mis datos actuales para refrescar la sesión.
 */
export async function actualizarCanalesEnVivo(): Promise<Usuario | null> {
  const token = tokenActual;
  if (!token || !cliente) return null;
  const { publicos, privados, user } = await getCanalesEnVivo(token);
  if (token !== tokenActual) return null;

  const deseados = new Set([...publicos, ...privados.map(c => `private-${c}`)]);
  [...suscritos].filter(c => !deseados.has(c)).forEach(desuscribir);
  deseados.forEach(suscribir);
  return user;
}

/** Conecta con la sesión actual (o la cambia). Devuelve mis datos actuales. */
export async function conectarEnVivo(token: string): Promise<Usuario | null> {
  if (token === tokenActual && cliente) return actualizarCanalesEnVivo();
  desconectarEnVivo();
  tokenActual = token;

  const { host, puerto, tls } = servidorEnVivo();
  cliente = new Pusher(EN_VIVO_KEY, {
    // pusher-js lo exige, pero con wsHost propio no se usa.
    cluster: 'mt1',
    wsHost: host,
    wsPort: puerto,
    wssPort: puerto,
    forceTLS: tls,
    enabledTransports: tls ? ['wss'] : ['ws'],
    disableStats: true,
    channelAuthorization: {
      endpoint: `${API_URL}/api/broadcasting/auth`,
      transport: 'ajax',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    },
  });

  cliente.connection.bind('state_change', ({ current }: { current: string }) => {
    const antes = conectado;
    conectado = current === 'connected';
    // Al recuperar la conexión pudo pasar de todo: que cada pantalla se ponga al día.
    if (conectado && !antes && yaEstuvoConectado) avisar({ tema: '*' });
    if (conectado) yaEstuvoConectado = true;
  });

  try {
    return await actualizarCanalesEnVivo();
  } catch (e) {
    // Sin la lista de canales al menos se escucha el catálogo público.
    suscribir('catalogo');
    throw e;
  }
}

export function desconectarEnVivo() {
  tokenActual = null;
  suscritos = new Set();
  conectado = false;
  yaEstuvoConectado = false;
  if (cliente) {
    cliente.disconnect();
    cliente = null;
  }
}

/** Para los tests: simula un aviso del servidor. */
export function simularAvisoEnVivo(aviso: AvisoEnVivo) {
  avisar(aviso);
}
