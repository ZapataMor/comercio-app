import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
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

export async function pedirPermisoUbicacion(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // En iOS el sistema pregunta solo la primera vez que se pide la posición.
    return true;
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Tu ubicación',
    message: 'Vitrina usa tu ubicación para mostrarte en el mapa y ubicar negocios.',
    buttonPositive: 'Permitir',
    buttonNegative: 'Ahora no',
  });
  return r === PermissionsAndroid.RESULTS.GRANTED;
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

/**
 * Mientras `activo` (en turno, con entregas o debiendo dinero), envía mi
 * posición, también con la app en segundo plano. Si no hay permiso o el GPS
 * está apagado, avisa una vez con `onProblema`.
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

    const iniciar = () => {
      if (!permitido || rechazado || cerrado) return;
      asegurarServicio();
      if (watchId !== null) return;
      watchId = Geolocation.watchPosition(
        p => enviar({ lat: p.coords.latitude, lng: p.coords.longitude }),
        e => problema(e.code === 1 ? 'permiso' : 'gps'),
        // distanceFilter 0: también llegan lecturas estando quieto (para reenviar).
        { enableHighAccuracy: true, distanceFilter: 0, interval: CADA_MS, fastestInterval: MIN_ENTRE_ENVIOS_MS },
      );
    };

    function detener() {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (servicio) {
        servicio = false;
        detenerServicioUbicacion().catch(() => {});
      }
    }

    pedirPermisoUbicacion()
      .then(ok => {
        if (cerrado) return;
        if (!ok) {
          problema('permiso');
          return;
        }
        permitido = true;
        iniciar();
      })
      .catch(() => problema('permiso'));

    // En segundo plano se sigue igual. Al volver se reafirma el servicio (por
    // si el sistema lo cerró; si sigue vivo solo se actualiza su aviso) y se
    // reintenta compartir si el backend lo había rechazado: la app vuelve a
    // preguntar si toca y apaga esto si ya no.
    const sub = AppState.addEventListener('change', estado => {
      if (estado !== 'active') return;
      if (rechazado) {
        rechazado = false;
        enviada = null;
      }
      servicio = false;
      iniciar();
    });

    return () => {
      cerrado = true;
      detener();
      sub.remove();
    };
  }, [token, activo]);
}
