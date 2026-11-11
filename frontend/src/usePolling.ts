import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { alCambiarEnVivo, AvisoEnVivo, enVivoConectado } from './enVivo';

/**
 * Refresco de las pantallas "en vivo" sin gastar batería ni datos de más:
 *  - AL INSTANTE cuando el servidor avisa por WebSocket que cambió algo que la
 *    pantalla muestra (ver src/enVivo.ts y el filtro de temas de abajo), o
 *    cuando llega un push con la app abierta;
 *  - cada `ms` como respaldo, solo mientras la pantalla está visible y la app
 *    en primer plano. Con el WebSocket conectado el respaldo se espacia
 *    (RESPALDO_EN_VIVO): los avisos ya traen los cambios.
 * Al volver a primer plano refresca de una vez.
 */

/**
 * Respaldo de lo que muestra si un negocio está abierto. Con el WebSocket
 * caído es lo único que avisa del cambio, por eso es corto.
 */
export const REFRESCO_NEGOCIOS = 5000;

/** Con el WebSocket conectado, el refresco de respaldo no corre más seguido que esto. */
export const RESPALDO_EN_VIVO = 60000;

/**
 * Qué avisos le importan a una pantalla: una lista de temas, o una función
 * para filtrar también por ids (p. ej. solo el negocio que se está viendo).
 * El aviso '*' (se recuperó la conexión) le importa a todas.
 */
export type FiltroEnVivo = readonly string[] | ((aviso: AvisoEnVivo) => boolean);

/** Varios avisos seguidos (un pedido avisa al cliente, al negocio...) piden una sola vez. */
const ESPERA_AVISOS_MS = 300;

function coincide(filtro: FiltroEnVivo, aviso: AvisoEnVivo): boolean {
  if (aviso.tema === '*') return true;
  return typeof filtro === 'function' ? filtro(aviso) : filtro.includes(aviso.tema);
}

/** Atajo de filtro: estos temas, y solo del negocio `negocioId` (o sin negocio). */
export function temasDelNegocio(temas: readonly string[], negocioId: number | null | undefined): FiltroEnVivo {
  return a => temas.includes(a.tema) && (a.negocio_id == null || a.negocio_id === negocioId);
}

type Oyente = () => void;
const oyentes = new Set<Oyente>();

/** Lo llama el puente de push al recibir una notificación con la app abierta. */
export function avisarCambioDesdePush() {
  oyentes.forEach(o => o());
}

/** Para lo que no es una pantalla (la alarma de pedidos). Devuelve cómo quitarse. */
export function alCambiarDesdePush(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/**
 * Para lo que no es una pantalla (contextos, avisos globales): llama a
 * `cargar` con cada aviso que pase el filtro, agrupando los seguidos.
 */
export function useAvisosEnVivo(filtro: FiltroEnVivo | null | undefined, cargar: () => void) {
  const ref = useRef({ filtro, cargar });
  ref.current = { filtro, cargar };
  const activo = !!filtro;

  useEffect(() => {
    if (!activo) return;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const quitar = alCambiarEnVivo(aviso => {
      const f = ref.current.filtro;
      if (!f || !coincide(f, aviso) || espera) return;
      espera = setTimeout(() => {
        espera = null;
        ref.current.cargar();
      }, ESPERA_AVISOS_MS);
    });
    return () => {
      quitar();
      if (espera) clearTimeout(espera);
    };
  }, [activo]);
}

/**
 * Pantallas: refresca con los avisos en vivo que pasen el filtro mientras
 * está visible. Si llegan con la pantalla tapada (otra encima), refresca al
 * volver a ella.
 */
export function useEnVivo(filtro: FiltroEnVivo, cargar: () => void) {
  const enfocada = useRef(false);
  const pendiente = useRef(false);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  useAvisosEnVivo(filtro, () => {
    if (enfocada.current && AppState.currentState === 'active') {
      cargarRef.current();
    } else {
      pendiente.current = true;
    }
  });

  useFocusEffect(
    useCallback(() => {
      enfocada.current = true;
      if (pendiente.current) {
        pendiente.current = false;
        cargarRef.current();
      }
      return () => {
        enfocada.current = false;
      };
    }, []),
  );
}

/**
 * Refresco periódico de respaldo + push + (si se da `filtro`) avisos en vivo.
 * Sin filtro la pantalla no se entera por WebSocket y el respaldo no se espacia.
 */
export function usePolling(cargar: () => void, ms = 15000, filtro?: FiltroEnVivo) {
  const ref = useRef(cargar);
  const ultima = useRef(0);
  ref.current = () => {
    ultima.current = Date.now();
    cargar();
  };
  const conFiltro = !!filtro;

  // Sin filtro igual se pone al día cuando vuelve la conexión ('*').
  useEnVivo(filtro ?? NADA, () => ref.current());

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      const tic = () => {
        // Con los avisos llegando, el respaldo puede esperar.
        if (conFiltro && enVivoConectado() && Date.now() - ultima.current < RESPALDO_EN_VIVO) return;
        ref.current();
      };
      const iniciar = () => {
        if (!timer) timer = setInterval(tic, ms);
      };
      const detener = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };

      ultima.current = Date.now();
      if (AppState.currentState === 'active') iniciar();
      const sub = AppState.addEventListener('change', estado => {
        if (estado === 'active') {
          ref.current();
          iniciar();
        } else {
          detener();
        }
      });
      const oyente = () => ref.current();
      oyentes.add(oyente);

      return () => {
        detener();
        sub.remove();
        oyentes.delete(oyente);
      };
    }, [ms, conFiltro]),
  );
}

const NADA: FiltroEnVivo = [];
