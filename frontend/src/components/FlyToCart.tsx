/**
 * Animación "paquete al carrito" de Vitrina.
 *
 * Cuando el cliente toca "Pedir", un paquetito dorado nace en el botón,
 * "salta" con un pop y vuela en arco (parábola) hasta el botón flotante de
 * Carrito, girando y encogiéndose en el camino. Al aterrizar, el carrito
 * rebota y el contador late. Todo con `Animated` + native driver (60 fps),
 * sin dependencias nuevas.
 *
 * Piezas:
 *  - <FlyToCartProvider> envuelve la app y pinta el overlay de vuelos.
 *  - useFlyToCart().volar({x, y}) lanza un paquete desde esas coordenadas
 *    de PANTALLA (pageX/pageY del toque sirven directo).
 *  - El botón de Carrito se registra como destino con registrarDestino()
 *    y recibe el aviso de aterrizaje con registrarAterrizaje() para rebotar.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { c, shadow } from '../theme';
import Icon from './Icon';

export type Punto = { x: number; y: number };

type Vuelo = { id: number; desde: Punto; hasta: Punto };

type FlyToCartApi = {
  /** Lanza un paquete desde estas coordenadas de pantalla hacia el carrito. */
  volar: (desde: Punto) => void;
  /** El botón Carrito registra aquí el CENTRO de su posición en pantalla. */
  registrarDestino: (p: Punto | null) => void;
  /** Callback que se dispara cuando un paquete aterriza (para rebotar). */
  registrarAterrizaje: (cb: (() => void) | null) => void;
};

const noop = () => {};
const FlyToCartContext = createContext<FlyToCartApi>({
  volar: noop,
  registrarDestino: noop,
  registrarAterrizaje: noop,
});

export const useFlyToCart = () => useContext(FlyToCartContext);

export function FlyToCartProvider({ children }: { children: React.ReactNode }) {
  const [vuelos, setVuelos] = useState<Vuelo[]>([]);
  const idRef = useRef(0);
  const destinoRef = useRef<Punto | null>(null);
  const aterrizajeRef = useRef<(() => void) | null>(null);
  // Origen del overlay en coordenadas de ventana (en Android puede no ser 0
  // por la barra de estado); se resta para alinear toque y overlay.
  const overlayRef = useRef<View>(null);
  const origenRef = useRef<Punto>({ x: 0, y: 0 });

  const medirOverlay = useCallback(() => {
    overlayRef.current?.measureInWindow((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        origenRef.current = { x, y };
      }
    });
  }, []);

  const volar = useCallback((desde: Punto) => {
    const hasta = destinoRef.current;
    if (!hasta) {
      // Sin botón de carrito visible: al menos avisamos el "aterrizaje"
      // para que cualquier contador visible reaccione.
      aterrizajeRef.current?.();
      return;
    }
    const o = origenRef.current;
    const id = ++idRef.current;
    setVuelos(prev => [
      ...prev,
      {
        id,
        desde: { x: desde.x - o.x, y: desde.y - o.y },
        hasta: { x: hasta.x - o.x, y: hasta.y - o.y },
      },
    ]);
  }, []);

  const terminar = useCallback((id: number) => {
    aterrizajeRef.current?.();
    setVuelos(prev => prev.filter(v => v.id !== id));
  }, []);

  const api = useMemo<FlyToCartApi>(
    () => ({
      volar,
      registrarDestino: p => {
        destinoRef.current = p;
      },
      registrarAterrizaje: cb => {
        aterrizajeRef.current = cb;
      },
    }),
    [volar],
  );

  return (
    <FlyToCartContext.Provider value={api}>
      {children}
      <View
        ref={overlayRef}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={medirOverlay}>
        {vuelos.map(v => (
          <Paquete key={v.id} vuelo={v} onFin={terminar} />
        ))}
      </View>
    </FlyToCartContext.Provider>
  );
}

// ---------------------------------------------------------------------------

const TAMANO = 36; // lado del paquetito (px)

/**
 * Puntos de una curva Bézier cuadrática entre `a` y `b` con un punto de
 * control elevado: es lo que dibuja el "salto" en arco del paquete.
 */
function arco(a: Punto, b: Punto, pasos: number) {
  const control = {
    x: a.x + (b.x - a.x) * 0.35,
    y: Math.min(a.y, b.y) - 150,
  };
  const xs: number[] = [];
  const ys: number[] = [];
  const entradas: number[] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const u = 1 - t;
    xs.push(u * u * a.x + 2 * u * t * control.x + t * t * b.x);
    ys.push(u * u * a.y + 2 * u * t * control.y + t * t * b.y);
    entradas.push(t);
  }
  return { xs, ys, entradas };
}

function Paquete({ vuelo, onFin }: { vuelo: Vuelo; onFin: (id: number) => void }) {
  // pop: nacimiento (0 → 1 con "overshoot"); p: progreso del vuelo (0 → 1).
  const pop = useRef(new Animated.Value(0)).current;
  const p = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      // 1) El paquete "nace" sobre el botón con un pop elástico.
      Animated.timing(pop, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.back(2.2)),
        useNativeDriver: true,
      }),
      // 2) Vuela en arco hasta el carrito.
      Animated.timing(p, {
        toValue: 1,
        duration: 620,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]).start(() => onFin(vuelo.id));
  }, [pop, p, onFin, vuelo.id]);

  const { xs, ys, entradas } = arco(vuelo.desde, vuelo.hasta, 12);
  const translateX = p.interpolate({ inputRange: entradas, outputRange: xs });
  const translateY = p.interpolate({ inputRange: entradas, outputRange: ys });
  // Se encoge mientras vuela, como si se alejara hacia el carrito.
  const escalaVuelo = p.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [1, 0.75, 0.4],
  });
  // Giro tipo "paquete dando tumbos".
  const rotar = p.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: ['0deg', '-16deg', '10deg', '24deg'],
  });
  // Se desvanece justo al llegar (el rebote del carrito toma el relevo).
  const opacidad = p.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={[
        styles.paquete,
        {
          opacity: opacidad,
          transform: [
            { translateX },
            { translateY },
            { scale: Animated.multiply(pop, escalaVuelo) },
            { rotate: rotar },
          ],
        },
      ]}>
      <Icon name="caja" size={22} color={c.onAccent} strokeWidth={2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  paquete: {
    position: 'absolute',
    // Centrado sobre el punto (0,0): el translate lo lleva a su sitio.
    top: -TAMANO / 2,
    left: -TAMANO / 2,
    width: TAMANO,
    height: TAMANO,
    borderRadius: 11,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.gold,
  },
});
