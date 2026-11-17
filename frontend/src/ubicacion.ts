import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import { Coordenadas, enviarUbicacion } from './api';
import { detenerServicioUbicacion, iniciarServicioUbicacion } from './servicioUbicacion';

/**
 * GPS del celular para el mapa.
 *
 *  - pedirPermisoUbicacion(): pide el permiso (si ya lo tiene no muestra nada).
 *  - miUbicacion(): dónde estoy ahora (para "Usar mi ubicación").
 *  - useCompartirUbicacion(): el domiciliario manda su posición al backend
 *    mientras trabaja, TAMBIÉN con la app en segundo plano (minimizada, con la
 *    pantalla apagada o usando otra app). En Android lo sostiene un servicio en
 *    primer plano con la notificación «Compartiendo tu ubicación»
 *    (servicioUbicacion.ts).
 *  - useEstadoUbicacion() / arreglarUbicacion(): si no se está compartiendo
 *    (sin permiso, ubicación aproximada, GPS apagado), el panel del
 *    domiciliario lo muestra fijo con un botón que lo arregla (AvisoUbicacion).
 */

/** Cada cuánto se le pide una lectura al GPS. */
const CADA_MS = 10000;
/** Moviéndose, no se envía más seguido que esto (el backend acepta 20 por minuto). */
const MIN_ENTRE_ENVIOS_MS = 5000;
/** Quieto, se reenvía la misma posición cada tanto para que no se vea vieja. */
const SIN_MOVERSE_MS = 30000;
/** Menos que esto es ruido del GPS, no movimiento. */
const MOVIMIENTO_M = 10;
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

/**
 * Mientras `activo` (en turno, con entregas o debiendo dinero), envía mi
 * posición, también con la app en segundo plano. Si no hay permiso o el GPS
 * está apagado, avisa una vez con `onProblema` y deja el problema en
 * useEstadoUbicacion() hasta que se arregle.
 *
 * Cada lectura del GPS (unas cada 10 s) decide si se envía: moviéndose, cada
 * 5 s como mucho; quieto, cada 30 s. No se usan timers de JS porque con la
 * pantalla apagada Android no los dispara; las lecturas del GPS sí llegan.
 */
export function useCompartirUbicacion(
  token: string,
  activo: boolean,
  onProblema?: (motivo: ProblemaUbicacion) => void,
) {
  const avisar = useRef(onProblema);
  avisar.current = onProblema;

  useEffect(() => {
    if (!activo) return;

    let cerrado = false;
    let permitido = false;
    let avisado = false;
    let watchId: number | null = null;
    let servicio = false;
    let enviada: { punto: Coordenadas; at: number } | null = null;
    let enviandoDesde: number | null = null;
    // El backend dijo que ya no comparta (salió de turno y no lleva nada).
    let rechazado = false;

    const problema = (motivo: ProblemaUbicacion) => {
      if (avisado) return;
      avisado = true;
      avisar.current?.(motivo);
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
        .catch(() => {
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
        { enableHighAccuracy: true, distanceFilter: 0, interval: CADA_MS, fastestInterval: MIN_ENTRE_ENVIOS_MS },
      );
    };

    function detener() {
      pararGps();
      if (servicio) {
        servicio = false;
        detenerServicioUbicacion().catch(() => {});
      }
    }

    // Revisa el permiso (con `pedir`, mostrando el diálogo) y arranca o
    // deja el motivo a la vista. También lo usa el botón del aviso.
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

    // En segundo plano se sigue igual. Al volver a la app (por ejemplo, de
    // Ajustes) se reintenta lo que falle: el permiso, el GPS, el servicio (por
    // si el sistema lo cerró; si sigue vivo solo se actualiza su aviso) o
    // compartir si el backend lo había rechazado (la app vuelve a preguntar si
    // toca y apaga esto si ya no).
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
      // Con el GPS apagado la librería no dejó registrada la solicitud: se
      // pide de nuevo para que tome la ubicación recién encendida.
      if (estadoActual === 'gps-apagado') pararGps();
      servicio = false;
      iniciar();
    });

    return () => {
      cerrado = true;
      if (reintentarActual === comprobar) reintentarActual = null;
      detener();
      sub.remove();
      fijarEstado(null);
    };
  }, [token, activo]);
}
