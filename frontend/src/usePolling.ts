import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Refresco de las pantallas "en vivo" (pedidos en espera, seguimiento,
 * entregas) sin gastar batería ni datos de más:
 *  - solo mientras la pantalla está visible y la app en primer plano;
 *  - cada `ms` (15 s por defecto) como respaldo;
 *  - y AL INSTANTE cuando llega un push con la app abierta (el push es el
 *    aviso real de que algo cambió).
 * Al volver a primer plano refresca de una vez.
 */

type Oyente = () => void;
const oyentes = new Set<Oyente>();

/** Lo llama el puente de push al recibir una notificación con la app abierta. */
export function avisarCambioDesdePush() {
  oyentes.forEach(o => o());
}

export function usePolling(cargar: () => void, ms = 15000) {
  const ref = useRef(cargar);
  ref.current = cargar;

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      const iniciar = () => {
        if (!timer) timer = setInterval(() => ref.current(), ms);
      };
      const detener = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };

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
    }, [ms]),
  );
}
