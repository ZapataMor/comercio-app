/**
 * Lo que flota abajo (la barra de catálogos de Explorar y los botones Carrito
 * / Mis pedidos) se encoge mientras la lista se desplaza y vuelve a su tamaño
 * cuando se queda quieta, como en Instagram.
 *
 * Es un solo valor para toda la app: las listas llaman a
 * `avisarDesplazamiento` en su onScroll y cada pieza interpola `encogida`
 * (0 = normal, 1 = encogida) a su manera.
 */
import { Animated } from 'react-native';

export const encogida = new Animated.Value(0);

/** Tras el último movimiento de la lista, cuánto espera para volver a crecer (ms). */
const ESPERA_QUIETA = 260;

let moviendose = false;
let espera: ReturnType<typeof setTimeout> | null = null;

function animar(hacia: number) {
  Animated.spring(encogida, {
    toValue: hacia,
    speed: 20,
    bounciness: hacia ? 0 : 6,
    useNativeDriver: true,
  }).start();
}

export function avisarDesplazamiento() {
  if (!moviendose) {
    moviendose = true;
    animar(1);
  }
  if (espera) clearTimeout(espera);
  espera = setTimeout(() => {
    moviendose = false;
    espera = null;
    animar(0);
  }, ESPERA_QUIETA);
}
