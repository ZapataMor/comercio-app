/**
 * Cómo se marca lo que el tutorial señala.
 *
 *   <Objetivo id="explorar.buscador" style={styles.buscador}>…</Objetivo>
 *     Una vista común (con el estilo que se le pase) que el tutorial puede medir.
 *
 *   const ref = useObjetivo('mapa.miUbicacion');
 *   <TouchableOpacity ref={ref} …>
 *     Para marcar una vista que ya existe sin envolverla (botones flotantes).
 *
 * Dentro de un ScrollView largo, useDesplazableTutorial deja que el tutorial
 * lo desplace hasta el elemento antes de señalarlo.
 *
 * <RaizTutorial> es la raíz de la app: la capa del tutorial se dibuja dentro y
 * mide los elementos respecto de ella.
 *
 * <PantallaTutorial nombre="EditarDireccion" style={…}> envuelve el contenido
 * de un modal: lo cuenta como una pantalla más (para sus tutoriales) y dibuja
 * ahí su capa, porque un modal tapa todo lo que se dibuja en la ventana
 * principal.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View, ViewProps } from 'react-native';
import CapaTutorial from './CapaTutorial';
import { BarraVisibleContext, RaizContext, useRegistroTutorial } from './contexto';

type Desplazable = { mostrar: (ref: React.RefObject<View | null>) => Promise<void> };
const DesplazableContext = createContext<Desplazable | null>(null);
export const DesplazableTutorial = DesplazableContext.Provider;

const esperar = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function medir(v: View | null): Promise<{ y: number; alto: number } | null> {
  return new Promise(resolve => {
    if (!v) return resolve(null);
    v.measureInWindow((_x, y, _ancho, alto) => resolve(Number.isFinite(y) ? { y, alto } : null));
  });
}

/**
 * Para un ScrollView con elementos marcados: devuelve su ref, el onScroll que
 * hay que pasarle y el valor para <DesplazableTutorial value={…}>. Si la
 * pantalla ya tiene una ref del ScrollView, se le pasa y se usa esa.
 */
export function useDesplazableTutorial(refExistente?: React.RefObject<ScrollView | null>) {
  const propia = useRef<ScrollView>(null);
  const scrollRef = refExistente ?? propia;
  const offset = useRef(0);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
  const valor = useMemo<Desplazable>(
    () => ({
      mostrar: async ref => {
        const [caja, obj] = await Promise.all([medir(scrollRef.current as unknown as View), medir(ref.current)]);
        if (!caja || !obj) return;
        const margen = 90;
        const dentro = obj.y >= caja.y + margen && obj.y + obj.alto <= caja.y + caja.alto - margen;
        if (dentro) return;
        // Deja el elemento a un tercio de la altura visible.
        const y = Math.max(0, offset.current + (obj.y - caja.y) - caja.alto / 3);
        scrollRef.current?.scrollTo({ y, animated: true });
        await esperar(450);
      },
    }),
    [scrollRef],
  );
  return { scrollRef, onScroll, valor };
}

/**
 * Marca una vista existente: pásale la ref que devuelve. `activo` = false la
 * deja sin marcar (p. ej. en una lista, solo se marca el primer elemento).
 */
export function useObjetivo<T extends View = View>(id: string, activo = true) {
  const ref = useRef<T>(null);
  const { registrar } = useRegistroTutorial();
  const desplazable = useContext(DesplazableContext);
  useEffect(() => {
    if (!activo) return;
    const vista = ref as unknown as React.RefObject<View | null>;
    return registrar(id, { ref: vista, desplazar: desplazable ? () => desplazable.mostrar(vista) : undefined });
  }, [id, activo, registrar, desplazable]);
  return ref;
}

/**
 * Vista que el tutorial puede señalar. Con `activo={false}` es una vista común
 * (la misma, para no cambiar el diseño), sin marcar. `enBarra`: es un botón de
 * la barra superior; solo se marca en la barra que se ve (BarraVisibleContext).
 */
export function Objetivo({
  id,
  activo = true,
  enBarra = false,
  children,
  ...props
}: ViewProps & { id: string; activo?: boolean; enBarra?: boolean }) {
  const enBarraVisible = useContext(BarraVisibleContext);
  const ref = useObjetivo(id, activo && (!enBarra || enBarraVisible));
  return (
    <View ref={ref} collapsable={false} {...props}>
      {children}
    </View>
  );
}

/** Raíz donde se dibuja la capa del tutorial (va al final de sus hijos). */
export function RaizTutorial({ capa = 'raiz', children, ...props }: ViewProps & { capa?: string }) {
  const ref = useRef<View>(null);
  return (
    <RaizContext.Provider value={ref}>
      <View ref={ref} collapsable={false} {...props}>
        {children}
        <CapaTutorial capa={capa} />
      </View>
    </RaizContext.Provider>
  );
}

/** Contenido de un modal: lo cuenta como pantalla del tutorial y dibuja su capa. */
export function PantallaTutorial({ nombre, ...props }: ViewProps & { nombre: string }) {
  const { entrarPantalla } = useRegistroTutorial();
  useEffect(() => entrarPantalla(nombre), [nombre, entrarPantalla]);
  return <RaizTutorial capa={nombre} {...props} />;
}
