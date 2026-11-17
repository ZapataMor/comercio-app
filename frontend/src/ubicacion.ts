import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import { ApiError, Coordenadas, enviarUbicacion } from './api';
import { detenerServicioUbicacion, iniciarServicioUbicacion } from './servicioUbicacion';

/**
 * GPS del celular para el mapa.
 *
 *  - pedirPermisoUbicacion(): pide el permiso (si ya lo tiene no muestra nada).
 *  - miUbicacion(): dónde estoy ahora (para "Usar mi ubicación").
 *  - useCompartirUbicacion() / iniciarRastreo(): el domiciliario manda su
 *    posición al backend mientras trabaja, TAMBIÉN con la app en segundo plano
 *    (minimizada, con la pantalla apagada, usando otra app) o cerrada. En
 *    Android lo sostiene un servicio en primer plano con la notificación
 *    «Compartiendo tu ubicación» (servicioUbicacion.ts).
 *  - useEstadoUbicacion() / arreglarUbicacion(): si no se está compartiendo
 *    (sin permiso, ubicación aproximada, GPS apagado), el panel del
 *    domiciliario lo muestra fijo con un botón que lo arregla (AvisoUbicacion).
 */

/**
 * Cada cuánto se le pide una lectura al GPS. Con 2 s el cliente ve la moto
 * avanzar casi continua (el mapa la desliza entre puntos, ver Mapa.tsx).
 */
const CADA_MS = 2000;
/** Moviéndose, no se envía más seguido que esto (el backend acepta 60 por minuto). */
const MIN_ENTRE_ENVIOS_MS = 2000;
/** Quieto, se reenvía la misma posición cada tanto para que no se vea vieja. */
const SIN_MOVERSE_MS = 30000;
/** Menos que esto es ruido del GPS, no movimiento (a 20 km/h son ~11 m cada 2 s). */
const MOVIMIENTO_M = 6;
/** Un envío que no responde en este tiempo se da por perdido. */
const ENVIO_COLGADO_MS = 30000;

const FINA = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const APROXIMADA = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

/**
 * precisa: puede compartir. aproximada: el usuario eligió «Aproximada» (no
 * sirve para seguir al domiciliario). bloqueado: Android ya no deja volver a
 * preguntar por la precisa: hay que ir a Ajustes. denegado: dijo que no.
 */
export type PermisoUbicacion = 'precisa' | 'aproximada' | 'bloqueado' | 'denegado';

/**
 * Estado del permiso. Con `pedir` muestra el diálogo si hace falta; sin él
 * solo consulta (sirve al volver de Ajustes).
 *
 * Android 12+ exige pedir la precisa JUNTO con la aproximada: el diálogo
 * deja elegir una de las dos.
 */
export async function permisoUbicacion(pedir: boolean): Promise<PermisoUbicacion> {
  if (Platform.OS !== 'android') {
    // En iOS el sistema pregunta solo la primera vez que se pide la posición.
    return 'precisa';
  }
  if (await PermissionsAndroid.check(FINA)) return 'precisa';
  if (!pedir) return (await PermissionsAndroid.check(APROXIMADA)) ? 'aproximada' : 'denegado';

  const r = await PermissionsAndroid.requestMultiple([FINA, APROXIMADA]);
  const { GRANTED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;
  if (r[FINA] === GRANTED) return 'precisa';
  if (r[FINA] === NEVER_ASK_AGAIN) return 'bloqueado';
  if (r[APROXIMADA] === GRANTED) return 'aproximada';
  return 'denegado';
}

/** Para ubicar algo en el mapa basta con la aproximada. */
export async function pedirPermisoUbicacion(): Promise<boolean> {
  const p = await permisoUbicacion(true);
  return p === 'precisa' || p === 'aproximada';
}

export function miUbicacion(): Promise<Coordenadas> {
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => reject(new Error(e.code === 1 ? 'Sin permiso de ubicación.' : 'No se pudo leer el GPS. ¿Está encendido?')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    ),
  );
}

/** Distancia aproximada en metros (suficiente para "¿se movió?"). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

export type ProblemaUbicacion = 'permiso' | 'gps';

// ---------- Estado visible del envío (para el panel del domiciliario) ----------

/**
 * activa: llegan lecturas y se envían. buscando: esperando la primera.
 * sin-permiso / aproximada / bloqueado: falta el permiso de ubicación precisa.
 * gps-apagado: no llegan lecturas (ubicación del teléfono apagada o sin señal).
 * null: no le toca compartir.
 */
export type EstadoUbicacion = 'activa' | 'buscando' | 'sin-permiso' | 'aproximada' | 'bloqueado' | 'gps-apagado';

let estadoActual: EstadoUbicacion | null = null;
const oyentesEstado = new Set<() => void>();
let reintentarActual: ((pedir: boolean) => Promise<PermisoUbicacion>) | null = null;

function fijarEstado(estado: EstadoUbicacion | null) {
  if (estado === estadoActual) return;
  estadoActual = estado;
  oyentesEstado.forEach(o => o());
}

function suscribirEstado(oyente: () => void) {
  oyentesEstado.add(oyente);
  return () => {
    oyentesEstado.delete(oyente);
  };
}

/** ¿Se está compartiendo mi ubicación? (null si no me toca compartir). */
export function useEstadoUbicacion(): EstadoUbicacion | null {
  return useSyncExternalStore(suscribirEstado, () => estadoActual);
}

/** Abre los ajustes de ubicación del teléfono (o los de la app si no se puede). */
async function abrirAjustesUbicacion() {
  try {
    await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  } catch {
    await Linking.openSettings();
  }
}

/**
 * El botón del aviso: vuelve a pedir el permiso y, si Android ya no deja
 * preguntar, abre los Ajustes de la app. Con el GPS apagado abre los de
 * ubicación. Al volver a Vitrina se reintenta solo (ver useCompartirUbicacion).
 */
export async function arreglarUbicacion(): Promise<void> {
  const estado = estadoActual;
  if (estado === 'gps-apagado') {
    await abrirAjustesUbicacion();
    return;
  }
  if (estado === 'bloqueado' || !reintentarActual) {
    await Linking.openSettings();
    return;
  }
  const permiso = await reintentarActual(true);
  if (permiso === 'bloqueado') await Linking.openSettings();
}

// ---------- El rastreo: vive fuera de la interfaz ----------

/**
 * Envía mi posición mientras dure, también con la app en segundo plano o
 * CERRADA: al cerrar la app (deslizarla de recientes o salir con «atrás»)
 * React Native desmonta toda la interfaz, pero el JS sigue vivo gracias al
 * servicio en primer plano, y este rastreo con él. Solo se detiene con
 * detenerRastreo(): ya no le toca compartir, cerró sesión, o el servidor
 * rechazó la sesión.
 *
 * Cada lectura del GPS (unas cada 2 s) decide si se envía: moviéndose, cada
 * 2 s como mucho; quieto, cada 30 s. No se usan timers de JS porque con la
 * pantalla apagada Android no los dispara; las lecturas del GPS sí llegan.
 */
type Rastreo = { token: string; detener: () => void };

let rastreo: Rastreo | null = null;
/** El toast de la pantalla abierta (null con la app cerrada). */
let avisarProblema: ((motivo: ProblemaUbicacion) => void) | null = null;

/** ¿Se está rastreando? (con la app cerrada también). */
export function rastreoActivo(): boolean {
  return rastreo !== null;
}

/** Empieza a compartir con esta sesión. Si ya se está compartiendo con ella, no hace nada. */
export function iniciarRastreo(token: string) {
  if (rastreo?.token === token) return;
  detenerRastreo();
  rastreo = crearRastreo(token);
}

/** Deja de compartir: apaga el GPS, el servicio y su notificación. */
export function detenerRastreo() {
  const actual = rastreo;
  rastreo = null;
  actual?.detener();
  fijarEstado(null);
}

function crearRastreo(token: string): Rastreo {
  let cerrado = false;
  let permitido = false;
  let avisado = false;
  let watchId: number | null = null;
  let servicio = false;
  let enviada: { punto: Coordenadas; at: number } | null = null;
  let enviandoDesde: number | null = null;
  // El backend dijo que ya no comparta (salió de turno y no lleva nada). Al
  // volver a la app se pregunta otra vez.
  let rechazado = false;

  const problema = (motivo: ProblemaUbicacion) => {
    if (avisado) return;
    avisado = true;
    avisarProblema?.(motivo);
  };

  const enviar = (punto: Coordenadas) => {
    if (rechazado || cerrado) return;
    const ahora = Date.now();
    if (enviandoDesde !== null && ahora - enviandoDesde < ENVIO_COLGADO_MS) return;
    if (enviada) {
      const espera = ahora - enviada.at;
      if (espera < MIN_ENTRE_ENVIOS_MS) return;
      if (distanciaMetros(enviada.punto, punto) < MOVIMIENTO_M && espera < SIN_MOVERSE_MS) return;
    }
    const anterior = enviada;
    const desde = ahora;
    enviada = { punto, at: ahora };
    enviandoDesde = desde;
    enviarUbicacion(token, punto)
      .then(ok => {
        if (!ok && !cerrado) {
          rechazado = true;
          detener();
          fijarEstado(null);
        }
      })
      .catch(e => {
        // Sesión cerrada o sin permiso de domiciliario: se acabó.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          if (!cerrado && rastreo?.token === token) detenerRastreo();
          return;
        }
        // Sin red: se reintenta con la próxima lectura del GPS.
        enviada = anterior;
      })
      .finally(() => {
        if (enviandoDesde === desde) enviandoDesde = null;
      });
  };

  // Android 14+ solo deja iniciar el servicio con la app a la vista.
  const asegurarServicio = () => {
    if (!permitido || servicio || rechazado || cerrado || AppState.currentState !== 'active') return;
    servicio = true;
    iniciarServicioUbicacion().catch(e => {
      servicio = false;
      console.warn('No se pudo iniciar el servicio de ubicación.', e);
    });
  };

  const pararGps = () => {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      watchId = null;
    }
  };

  const iniciar = () => {
    if (!permitido || rechazado || cerrado) return;
    asegurarServicio();
    if (watchId !== null) return;
    if (estadoActual !== 'gps-apagado') fijarEstado('buscando');
    watchId = Geolocation.watchPosition(
      p => {
        if (cerrado) return;
        fijarEstado('activa');
        enviar({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      e => {
        if (cerrado) return;
        if (e.code === 1) {
          // Le quitaron el permiso con la app abierta.
          permitido = false;
          detener();
          fijarEstado('sin-permiso');
          problema('permiso');
        } else {
          // GPS apagado o sin señal: vuelve a 'activa' con la próxima lectura.
          fijarEstado('gps-apagado');
          problema('gps');
        }
      },
      // distanceFilter 0: también llegan lecturas estando quieto (para reenviar).
      { enableHighAccuracy: true, distanceFilter: 0, interval: CADA_MS, fastestInterval: CADA_MS / 2 },
    );
  };

  function detener() {
    pararGps();
    if (servicio) {
      servicio = false;
      detenerServicioUbicacion().catch(() => {});
    }
  }

  // Revisa el permiso (con `pedir`, mostrando el diálogo) y arranca o deja el
  // motivo a la vista. También lo usa el botón del aviso.
  const comprobar = async (pedir: boolean): Promise<PermisoUbicacion> => {
    const permiso = await permisoUbicacion(pedir);
    if (cerrado) return permiso;
    if (permiso === 'precisa') {
      permitido = true;
      iniciar();
    } else {
      permitido = false;
      detener();
      fijarEstado(permiso === 'denegado' ? 'sin-permiso' : permiso);
      if (pedir) problema('permiso');
    }
    return permiso;
  };
  reintentarActual = comprobar;

  fijarEstado('buscando');
  comprobar(true).catch(() => {
    if (cerrado) return;
    fijarEstado('sin-permiso');
    problema('permiso');
  });

  // En segundo plano (o con la app cerrada) se sigue igual. Al volver a la
  // app (por ejemplo, de Ajustes) se reintenta lo que falle: el permiso, el
  // GPS, el servicio (por si el sistema lo cerró; si sigue vivo solo se
  // actualiza su aviso) o compartir si el backend lo había rechazado.
  const sub = AppState.addEventListener('change', estado => {
    if (estado !== 'active' || cerrado) return;
    if (rechazado) {
      rechazado = false;
      enviada = null;
    }
    if (!permitido) {
      comprobar(false).catch(() => {});
      return;
    }
    // Con el GPS apagado la librería no dejó registrada la solicitud: se pide
    // de nuevo para que tome la ubicación recién encendida.
    if (estadoActual === 'gps-apagado') pararGps();
    servicio = false;
    iniciar();
  });

  return {
    token,
    detener: () => {
      cerrado = true;
      if (reintentarActual === comprobar) reintentarActual = null;
      detener();
      sub.remove();
    },
  };
}

/**
 * Conecta la pantalla con el rastreo. `activo`: si al domiciliario le toca
 * compartir (en turno, con entregas o debiendo dinero), según el servidor;
 * null mientras no se sabe (la app acaba de abrir): no toca lo que ya corre.
 *
 * Desmontarse NO detiene el rastreo: pasa al cerrar la app y debe seguir.
 * Cerrar sesión lo detiene en AuthContext.
 */
export function useCompartirUbicacion(
  token: string,
  activo: boolean | null,
  onProblema?: (motivo: ProblemaUbicacion) => void,
) {
  const avisar = useRef(onProblema);
  avisar.current = onProblema;

  useEffect(() => {
    const oyente = (motivo: ProblemaUbicacion) => avisar.current?.(motivo);
    avisarProblema = oyente;
    return () => {
      if (avisarProblema === oyente) avisarProblema = null;
    };
  }, []);

  useEffect(() => {
    if (activo === null) return;
    if (activo) iniciarRastreo(token);
    else detenerRastreo();
  }, [token, activo]);
}
