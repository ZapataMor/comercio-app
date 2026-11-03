import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { Coordenadas, enviarUbicacion } from './api';

/**
 * GPS del celular para el mapa.
 *
 *  - pedirPermisoUbicacion(): pide el permiso (si ya lo tiene no muestra nada).
 *  - miUbicacion(): dónde estoy ahora (para "Usar mi ubicación").
 *  - useCompartirUbicacion(): el domiciliario manda su posición al backend
 *    mientras trabaja, SOLO con la app en primer plano (cada ~10 s, o cada
 *    minuto si no se ha movido). En segundo plano no se envía nada.
 */

const CADA_MS = 10000;
const SIN_MOVERSE_MS = 60000;

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
 * Mientras `activo` (en turno o con entregas), envía mi posición. Si no hay
 * permiso o el GPS está apagado, avisa una vez con `onProblema`.
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
    let timer: ReturnType<typeof setInterval> | null = null;
    let ultima: Coordenadas | null = null;
    let enviada: { punto: Coordenadas; at: number } | null = null;
    // El backend dijo que ya no comparta (salió de turno y no lleva nada).
    let rechazado = false;

    const problema = (motivo: ProblemaUbicacion) => {
      if (avisado) return;
      avisado = true;
      avisar.current?.(motivo);
    };

    const enviar = () => {
      if (!ultima || rechazado) return;
      const ahora = Date.now();
      if (enviada && distanciaMetros(enviada.punto, ultima) < 10 && ahora - enviada.at < SIN_MOVERSE_MS) return;
      const punto = ultima;
      enviada = { punto, at: ahora };
      enviarUbicacion(token, punto)
        .then(ok => {
          if (!ok) rechazado = true;
        })
        .catch(() => {
          // Sin red: se reintenta en el próximo ciclo.
          enviada = null;
        });
    };

    const iniciar = () => {
      if (!permitido || watchId !== null) return;
      watchId = Geolocation.watchPosition(
        p => {
          ultima = { lat: p.coords.latitude, lng: p.coords.longitude };
          if (!enviada) enviar();
        },
        e => problema(e.code === 1 ? 'permiso' : 'gps'),
        { enableHighAccuracy: true, distanceFilter: 10, interval: CADA_MS, fastestInterval: CADA_MS / 2 },
      );
      timer = setInterval(enviar, CADA_MS);
    };

    const detener = () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    pedirPermisoUbicacion()
      .then(ok => {
        if (cerrado) return;
        if (!ok) {
          problema('permiso');
          return;
        }
        permitido = true;
        if (AppState.currentState === 'active') iniciar();
      })
      .catch(() => problema('permiso'));

    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') iniciar();
      else detener();
    });

    return () => {
      cerrado = true;
      detener();
      sub.remove();
    };
  }, [token, activo]);
}
