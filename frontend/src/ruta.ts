import type { Coordenadas, PasoRuta, Ruta } from './api';

/**
 * Cuentas de la pantalla «Cómo llegar» (RutaScreen), sin tocar el mapa:
 * dónde va la persona sobre la ruta, cuál es la próxima indicación y a
 * cuánto, cuánto falta y si se salió del camino (para recalcular).
 */

/** A más de esto de la línea, la persona tomó otro camino: se recalcula. */
export const DESVIO_M = 45;
/** Recalcular como mucho cada tanto (el GPS salta y el servidor es compartido). */
export const ENTRE_RECALCULOS_MS = 12000;
/** A menos de esto del destino, ya llegó. */
export const LLEGADA_M = 25;

const RADIO_TIERRA = 6371000;
const RAD = Math.PI / 180;

/** Distancia aproximada en metros (de sobra para una ciudad). */
export function metrosEntre(a: Coordenadas, b: Coordenadas): number {
  const x = (b.lng - a.lng) * RAD * Math.cos(((a.lat + b.lat) / 2) * RAD);
  const y = (b.lat - a.lat) * RAD;
  return Math.sqrt(x * x + y * y) * RADIO_TIERRA;
}

/**
 * Proyecta `p` sobre la línea ([lng, lat]): cuántos metros de la línea lleva
 * recorridos, cuánto mide toda y a qué distancia está `p` de ella.
 */
export function proyectar(linea: [number, number][], p: Coordenadas): { avance: number; total: number; desvio: number } {
  if (linea.length === 0) return { avance: 0, total: 0, desvio: Infinity };
  // Plano local en metros con `p` en el origen.
  const kx = Math.cos(p.lat * RAD) * RAD * RADIO_TIERRA;
  const ky = RAD * RADIO_TIERRA;
  const pts = linea.map(([lng, lat]) => [(lng - p.lng) * kx, (lat - p.lat) * ky]);

  let recorrido = 0;
  let mejor = { avance: 0, desvio: Math.hypot(pts[0][0], pts[0][1]) };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const largo2 = dx * dx + dy * dy;
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo2));
    const desvio = Math.hypot(ax + t * dx, ay + t * dy);
    const largo = Math.sqrt(largo2);
    if (desvio < mejor.desvio) mejor = { avance: recorrido + t * largo, desvio };
    recorrido += largo;
  }
  return { avance: mejor.avance, total: recorrido, desvio: mejor.desvio };
}

export type EstadoRuta = {
  /** Metros que faltan por la ruta. */
  restante: number;
  /** Minutos que faltan (al menos 1 mientras no haya llegado). */
  minutos: number;
  /** A qué distancia está la persona de la línea. */
  desvio: number;
  /** La próxima indicación y a cuántos metros está. */
  paso: PasoRuta | null;
  hastaPaso: number;
  llegado: boolean;
};

/** Cómo va la persona en la ruta, estando en `p`. */
export function estadoRuta(ruta: Ruta, p: Coordenadas): EstadoRuta {
  const { avance: avanceLinea, total, desvio } = proyectar(ruta.linea, p);
  // Los pasos vienen en metros de OSRM; la línea dibujada mide casi lo mismo.
  const escala = total > 0 ? ruta.distancia_m / total : 1;
  const avance = avanceLinea * escala;
  const restante = Math.max(0, ruta.distancia_m - avance);

  const fin = ruta.linea[ruta.linea.length - 1];
  const alDestino = fin ? metrosEntre(p, { lat: fin[1], lng: fin[0] }) : Infinity;
  const llegado = alDestino <= LLEGADA_M || (restante <= LLEGADA_M && desvio <= DESVIO_M);

  // La próxima maniobra que queda adelante (la de arrancar ya pasó al moverse).
  const paso = ruta.pasos.find(s => s.en_m > avance + 3) ?? ruta.pasos[ruta.pasos.length - 1] ?? null;
  const hastaPaso = paso ? Math.max(0, paso.en_m - avance) : 0;

  const proporcion = ruta.distancia_m > 0 ? restante / ruta.distancia_m : 0;
  const minutos = llegado ? 0 : Math.max(1, Math.ceil((ruta.duracion_s * proporcion) / 60));

  return { restante, minutos, desvio, paso, hastaPaso, llegado };
}

/** ¿Hay que pedir una ruta nueva? Solo si se salió del camino y ya pasó un rato. */
export function hayQueRecalcular(desvio: number, msDesdeUltima: number): boolean {
  return desvio > DESVIO_M && msDesdeUltima >= ENTRE_RECALCULOS_MS;
}

/** "120 m", "1,2 km". */
export function textoDistancia(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

/** "8 min", "1 h 5 min". */
export function textoMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const resto = min % 60;
  return `${Math.floor(min / 60)} h${resto ? ` ${resto} min` : ''}`;
}

/** La línea de la ruta como puntos, para encuadrarla en el mapa. */
export function puntosDe(linea: [number, number][]): Coordenadas[] {
  return linea.map(([lng, lat]) => ({ lat, lng }));
}
