/**
 * Vista que deja libre, abajo, el tramo que le tapa el teclado.
 *
 * La app compila para Android 16 (targetSdk 36), que la dibuja de borde a
 * borde. Ahí `adjustResize` ya no encoge la ventana al abrir el teclado, y los
 * campos de la mitad de abajo quedaban tapados. Esta vista mide cuánto de ella
 * cubre el teclado y lo pone como margen inferior: el contenido se encoge como
 * antes, y el ScrollView que lo trae sube solo hasta el campo enfocado (Android
 * lo hace cuando el ScrollView cambia de tamaño).
 *
 * Si el sistema sí encoge la ventana (Android 14 o anterior), la vista ya
 * termina encima del teclado y la cuenta da 0: no hay doble espacio.
 *
 * `descontar`: lo que el contenido ya deja abajo por su cuenta (la barra de
 * navegación del sistema, que el teclado también tapa).
 *
 * Los <Modal> son otra ventana, también de borde a borde, y no heredan el
 * espacio de la raíz: van con `EspacioTecladoModal`, que además deja libre la
 * barra de navegación cuando no hay teclado (en lugar del KeyboardAvoidingView,
 * que en Android no hacía nada).
 *
 * Formularios de un solo campo (el código de entrega, una reseña, la respuesta
 * a una reseña): además del campo tiene que verse el botón que lo envía. Esa
 * parte va dentro de un `ScrollTeclado` (un ScrollView), y el campo y su botón
 * en una vista con `useBloqueConTeclado`: al abrir el teclado, el ScrollView
 * baja hasta mostrar el bloque entero. Con varios campos no se usa: basta con
 * que suba hasta el campo donde se escribe.
 */
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  FlatListProps,
  Keyboard,
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  View,
  ViewProps,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

type Props = ViewProps & {
  descontar?: number;
  /** Margen inferior mínimo, con o sin teclado. */
  minimo?: number;
  /**
   * La raíz de la app: no se encoge mientras la pantalla al frente maneja el
   * teclado por su cuenta (ver useTecladoPropio).
   */
  cederAPantallas?: boolean;
};

/** Pantallas enfocadas que manejan el teclado por su cuenta (Buscar). */
let pantallasConTecladoPropio = 0;

/**
 * Para una pantalla que deja ella misma el espacio del teclado (solo en su
 * lista): mientras está al frente, la raíz no cambia de alto. Cambiar el alto
 * de la raíz recalcula todas las pantallas montadas, también las de atrás con
 * sus fotos, y la búsqueda se trababa al abrir y cerrar.
 */
export function useTecladoPropio() {
  useFocusEffect(
    useCallback(() => {
      pantallasConTecladoPropio++;
      return () => {
        pantallasConTecladoPropio--;
      };
    }, []),
  );
}

/** Aire entre el campo enfocado y el teclado: sin él queda pegado al borde. */
export const AIRE_TECLADO = 16;

/** Cuánto tapa el teclado de una vista que ocupa de `y` a `y + alto`. */
export function tramoTapado(y: number, alto: number, arribaTeclado: number, descontar = 0): number {
  if (![y, alto, arribaTeclado].every(Number.isFinite)) return 0;
  const tapado = Math.round(y + alto - arribaTeclado - descontar);
  return tapado > 0 ? tapado + AIRE_TECLADO : 0;
}

export default function EspacioTeclado({ descontar = 0, minimo = 0, cederAPantallas = false, style, children, ...props }: Props) {
  const ref = useRef<View>(null);
  const [tapado, setTapado] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const medir = (e: KeyboardEvent) => {
      if (cederAPantallas && pantallasConTecladoPropio > 0) return;
      const arriba = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _ancho, alto) => {
        setTapado(tramoTapado(y, alto, arriba, descontar));
      });
    };
    const abre = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', medir);
    const cierra = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTapado(0));
    return () => {
      abre.remove();
      cierra.remove();
    };
  }, [descontar, cederAPantallas]);

  return (
    <View ref={ref} style={[style, Math.max(tapado, minimo) > 0 && { paddingBottom: Math.max(tapado, minimo) }]} {...props}>
      {children}
    </View>
  );
}

/**
 * Para el contenido de un <Modal>: deja libre la barra de navegación del
 * sistema y, con el teclado abierto, lo que este tapa.
 */
export function EspacioTecladoModal(props: Omit<Props, 'descontar' | 'minimo'>) {
  // Sin SafeAreaProvider (algunas pruebas) no hay barra que dejar libre.
  const abajo = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return <EspacioTeclado {...props} minimo={abajo} />;
}

/**
 * Cuánto bajar un ScrollView (de `scrollY` a `scrollY + scrollAlto` en la
 * ventana) para que un bloque quede entero encima de su borde de abajo, sin
 * que su parte de arriba (el campo) se salga por arriba.
 */
export function desplazamientoBloque(bloqueY: number, bloqueAlto: number, scrollY: number, scrollAlto: number): number {
  if (![bloqueY, bloqueAlto, scrollY, scrollAlto].every(Number.isFinite)) return 0;
  const falta = bloqueY + bloqueAlto + AIRE_TECLADO - (scrollY + scrollAlto);
  if (falta <= 0) return 0;
  return Math.max(0, Math.round(Math.min(falta, bloqueY - scrollY - AIRE_TECLADO)));
}

type ContextoScroll = { mostrar: (bloque: View) => void };
const ScrollContexto = createContext<ContextoScroll | null>(null);

type Desplazable = { getNativeScrollRef?: () => unknown };

/** Lo común a ScrollTeclado y FlatListTeclado: medir, bajar y seguir el desplazamiento. */
function useScrollConBloques<R extends Desplazable>(
  desplazar: (lista: R, y: number) => void,
  onScroll: ((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined,
) {
  const lista = useRef<R>(null);
  const desplazado = useRef(0);

  const contexto = useMemo<ContextoScroll>(
    () => ({
      mostrar(bloque) {
        const actual = lista.current;
        const nativo = actual?.getNativeScrollRef?.() as View | null | undefined;
        if (!actual || !nativo) return;
        nativo.measureInWindow((_sx, sy, _sw, sh) => {
          bloque.measureInWindow((_bx, by, _bw, bh) => {
            const extra = desplazamientoBloque(by, bh, sy, sh);
            if (extra > 0) desplazar(actual, desplazado.current + extra);
          });
        });
      },
    }),
    [desplazar],
  );

  const alDesplazar = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      desplazado.current = e.nativeEvent.contentOffset.y;
      // Un Animated.event no es una función: con él no se reenvía.
      if (typeof onScroll === 'function') onScroll(e);
    },
    [onScroll],
  );

  return { lista, contexto, alDesplazar };
}

const bajarScroll = (s: ScrollView, y: number) => s.scrollTo({ y, animated: true });
const bajarLista = (l: FlatList<unknown>, y: number) => l.scrollToOffset({ offset: y, animated: true });

/** ScrollView que sabe bajar hasta un bloque de `useBloqueConTeclado`. */
export const ScrollTeclado = forwardRef<ScrollView, ScrollViewProps>(function ScrollTeclado(
  { onScroll, scrollEventThrottle = 16, ...props },
  ref,
) {
  const { lista, contexto, alDesplazar } = useScrollConBloques<ScrollView>(bajarScroll, onScroll);
  useImperativeHandle(ref, () => lista.current as ScrollView, [lista]);
  return (
    <ScrollContexto.Provider value={contexto}>
      <ScrollView ref={lista} scrollEventThrottle={scrollEventThrottle} onScroll={alDesplazar} {...props} />
    </ScrollContexto.Provider>
  );
});

/** Lo mismo que ScrollTeclado, para un FlatList. */
export function FlatListTeclado<T>({ onScroll, scrollEventThrottle = 16, ...props }: FlatListProps<T>) {
  const { lista, contexto, alDesplazar } = useScrollConBloques<FlatList<unknown>>(bajarLista, onScroll);
  return (
    <ScrollContexto.Provider value={contexto}>
      <FlatList<T>
        ref={lista as unknown as React.RefObject<FlatList<T>>}
        scrollEventThrottle={scrollEventThrottle}
        onScroll={alDesplazar}
        {...props}
      />
    </ScrollContexto.Provider>
  );
}

/**
 * Espera tras abrir el teclado: primero la raíz se encoge y Android sube hasta
 * el campo; después se baja lo que falte para ver el botón.
 */
const ESPERA_BLOQUE_MS = 150;

/**
 * Para el campo de un formulario de un solo campo y su botón: `ref` va en la
 * vista que los envuelve; `onFocus` y `onBlur`, en el TextInput. Fuera de un
 * `ScrollTeclado` no hace nada.
 */
export function useBloqueConTeclado() {
  const contexto = useContext(ScrollContexto);
  const ref = useRef<View>(null);
  const enfocado = useRef(false);

  const mostrar = useCallback(() => {
    setTimeout(() => {
      if (enfocado.current && ref.current) contexto?.mostrar(ref.current);
    }, ESPERA_BLOQUE_MS);
  }, [contexto]);

  useEffect(() => {
    if (!contexto) return;
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', mostrar);
    return () => sub.remove();
  }, [contexto, mostrar]);

  return useMemo(
    () => ({
      ref,
      onFocus: () => {
        enfocado.current = true;
        // Si el teclado ya estaba abierto (venía de otro campo), no habrá aviso.
        if (Keyboard.isVisible()) mostrar();
      },
      onBlur: () => {
        enfocado.current = false;
      },
    }),
    [mostrar],
  );
}

/**
 * `useBloqueConTeclado` para cuando el campo vive en la misma pantalla que su
 * ScrollTeclado (el gancho tiene que estar por debajo de él).
 */
export function BloqueTeclado({
  children,
  ...props
}: Omit<ViewProps, 'children'> & { children: (campo: { onFocus: () => void; onBlur: () => void }) => React.ReactNode }) {
  const bloque = useBloqueConTeclado();
  return (
    <View ref={bloque.ref} {...props}>
      {children(bloque)}
    </View>
  );
}
