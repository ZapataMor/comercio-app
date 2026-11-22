/**
 * Barra de Explorar, como la de Instagram: una píldora flotante abajo con los
 * tres catálogos (Productos, Servicios y Propiedades), solo con íconos. El
 * activo lleva una píldora suave detrás; tocar otro cambia el catálogo.
 *
 * Mientras la lista se desplaza la barra se encoge y se vuelve translúcida
 * (deja ver lo de atrás); al quedarse quieta vuelve a su tamaño. Las listas
 * avisan con `useDesplazarCatalogo()` en su onScroll.
 *
 * Flota sobre el contenido (Explorar es bordeABorde en App.tsx): las listas
 * dejan abajo `espacioAbajo` para que lo último no quede tapado. Con el
 * teclado abierto (escribiendo en el buscador) se esconde.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SeccionCatalogo } from '../navTypes';
import { makeStyles, radius, useTheme } from '../theme';
import { Objetivo } from '../tutorial/Objetivo';
import Icon, { IconName } from './Icon';

export const SECCIONES: { valor: SeccionCatalogo; titulo: string; icono: IconName }[] = [
  { valor: 'productos', titulo: 'Productos', icono: 'bolsa' },
  { valor: 'servicios', titulo: 'Servicios', icono: 'herramientas' },
  { valor: 'propiedades', titulo: 'Propiedades', icono: 'casa' },
];

/** Alto de la barra y su distancia al borde de abajo (sobre el área segura). */
export const ALTO_BARRA_CATALOGO = 64;
export const MARGEN_BARRA_CATALOGO = 10;

/** Tamaño de la barra encogida (al desplazarse) respecto del normal. */
const ESCALA_ENCOGIDA = 0.84;
/** Tras el último movimiento de la lista, cuánto espera para volver a crecer (ms). */
const ESPERA_QUIETA = 260;

type Desplazamiento = { alDesplazar: () => void; espacioAbajo: number };
const DesplazamientoContexto = createContext<Desplazamiento>({ alDesplazar: () => {}, espacioAbajo: 0 });
export const ProveedorDesplazamiento = DesplazamientoContexto.Provider;

/** Para las listas de Explorar: su onScroll y el aire que dejan abajo. */
export function useDesplazarCatalogo() {
  return useContext(DesplazamientoContexto);
}

/** Valor animado de 0 (normal) a 1 (encogida) y el aviso de que la lista se movió. */
export function useEncogerAlDesplazar() {
  const encogida = useRef(new Animated.Value(0)).current;
  const moviendose = useRef(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animar = useCallback(
    (hacia: number) =>
      Animated.spring(encogida, {
        toValue: hacia,
        speed: 20,
        bounciness: hacia ? 0 : 6,
        useNativeDriver: true,
      }).start(),
    [encogida],
  );

  const alDesplazar = useCallback(() => {
    if (!moviendose.current) {
      moviendose.current = true;
      animar(1);
    }
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      moviendose.current = false;
      animar(0);
    }, ESPERA_QUIETA);
  }, [animar]);

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  return { encogida, alDesplazar };
}

export default function BarraCatalogo({
  seccion,
  onCambiar,
  encogida,
  abajo,
}: {
  seccion: SeccionCatalogo;
  onCambiar: (seccion: SeccionCatalogo) => void;
  encogida: Animated.Value;
  /** Distancia al borde de abajo de la pantalla. */
  abajo: number;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const teclado = useTecladoAbierto();
  if (teclado) return null;

  const escala = encogida.interpolate({ inputRange: [0, 1], outputRange: [1, ESCALA_ENCOGIDA] });
  // Encoge hacia abajo: el borde inferior se queda en su sitio.
  const bajar = encogida.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (ALTO_BARRA_CATALOGO * (1 - ESCALA_ENCOGIDA)) / 2],
  });
  // La capa blanca con sombra se desvanece y deja la translúcida de debajo.
  const opaca = encogida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.zona, { bottom: abajo, transform: [{ translateY: bajar }, { scale: escala }] }]}>
      <Objetivo id="catalogo.selector" style={styles.barra} accessibilityRole="tablist">
        <View style={[StyleSheet.absoluteFill, styles.fondoTranslucido]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.fondoOpaco, { opacity: opaca }]} />
        {SECCIONES.map(s => {
          const activa = s.valor === seccion;
          return (
            <Pressable
              key={s.valor}
              style={styles.pestana}
              accessibilityRole="tab"
              accessibilityLabel={s.titulo}
              accessibilityState={{ selected: activa }}
              onPress={() => !activa && onCambiar(s.valor)}>
              <View style={[styles.marca, activa && styles.marcaActiva]}>
                <Icon name={s.icono} size={26} color={c.textStrong} strokeWidth={activa ? 2.4 : 1.9} />
              </View>
            </Pressable>
          );
        })}
      </Objetivo>
    </Animated.View>
  );
}

function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setAbierto(true)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setAbierto(false)),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, []);
  return abierto;
}

const useStyles = makeStyles((c, shadow) => ({
  zona: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    height: ALTO_BARRA_CATALOGO,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  // Superficie del tema con transparencia (los colores son #RRGGBB).
  fondoTranslucido: {
    borderRadius: radius.pill,
    backgroundColor: `${c.surface}C7`,
    borderWidth: 1.5,
    borderColor: `${c.surface}F0`,
  },
  fondoOpaco: {
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    ...shadow.card,
  },
  pestana: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  // Radio exacto (la mitad del alto): con radius.pill (999) algunos
  // teléfonos dibujan la píldora activa con esquinas rectas.
  marca: {
    width: 84,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaActiva: { backgroundColor: c.surface2 },
}));
