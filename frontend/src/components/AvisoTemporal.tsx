/**
 * Envoltura de todo mensaje que se va solo (toasts, avisos emergentes):
 *
 * - Su borde es una barra de carga: se va llenando de izquierda a derecha y,
 *   cuando se llena, el mensaje se cierra.
 * - Se quita deslizándolo hacia la derecha con el dedo. Mientras el dedo está
 *   encima, la barra se detiene; si lo suelta sin cerrarlo, sigue.
 *
 * El contenido va dentro, con el fondo de `colorFondo`. La sombra y el ancho
 * los pone quien lo usa (en `style`).
 *
 * Ojo (Android, RN 0.86): las vistas animadas conservan siempre el mismo
 * transform; quitar un transform animado de una vista viva cierra la app.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

type Props = {
  /** Cuánto dura visible (ms) si nadie lo toca. */
  duracion: number;
  /** Se acabó el tiempo o lo deslizaron: quien lo usa lo quita. */
  onCerrar: (motivo: 'tiempo' | 'deslizado') => void;
  /** Color de la barra que se llena (por defecto, el acento). */
  color?: string;
  /** Fondo del contenido (por defecto, el de las tarjetas). */
  colorFondo?: string;
  /** Grosor del borde-barra. */
  grosor?: number;
  radio?: number;
  style?: StyleProp<ViewStyle>;
  /** Estilo de la caja interior (padding, dirección…). */
  contenidoStyle?: StyleProp<ViewStyle>;
  /** Detiene la barra (p. ej. mientras hay otra cosa encima). */
  pausado?: boolean;
  children: React.ReactNode;
};

/** Cuánto hay que arrastrar (fracción del ancho) para quitarlo. */
export const UMBRAL_DESLIZAR = 0.35;

/** ¿Con este arrastre se quita? (distancia en px, velocidad en px/ms). */
export function seQuita(dx: number, vx: number, ancho: number): boolean {
  return dx > Math.max(60, ancho * UMBRAL_DESLIZAR) || (dx > 24 && vx > 0.6);
}

export default function AvisoTemporal({
  duracion,
  onCerrar,
  color,
  colorFondo,
  grosor = 2.5,
  radio = 14,
  style,
  contenidoStyle,
  pausado = false,
  children,
}: Props) {
  const { c } = useTheme();
  const progreso = useRef(new Animated.Value(0)).current; // 0 → 1: la barra llena
  const arrastre = useRef(new Animated.Value(0)).current; // px hacia la derecha
  const ancho = useRef(320);
  const cerrado = useRef(false);
  const tocando = useRef(false);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;

  const cerrar = useCallback((motivo: 'tiempo' | 'deslizado') => {
    if (cerrado.current) return;
    cerrado.current = true;
    onCerrarRef.current(motivo);
  }, []);

  /** Llena lo que falta de la barra en el tiempo que corresponde. */
  const seguir = useCallback(() => {
    if (cerrado.current) return;
    progreso.stopAnimation(valor => {
      const falta = Math.max(0, 1 - valor);
      Animated.timing(progreso, {
        toValue: 1,
        duration: falta * duracion,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !tocando.current) cerrar('tiempo');
      });
    });
  }, [progreso, duracion, cerrar]);

  const detener = useCallback(() => progreso.stopAnimation(), [progreso]);

  useEffect(() => {
    if (pausado) detener();
    else seguir();
    return detener;
  }, [pausado, seguir, detener]);

  const pan = useRef(
    PanResponder.create({
      // Solo los gestos claramente horizontales hacia la derecha: los toques y
      // los desplazamientos verticales siguen llegando al contenido.
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
      onPanResponderGrant: () => {
        tocando.current = true;
        detener();
      },
      onPanResponderMove: (_e, g) => {
        // Hacia la izquierda apenas cede, para que se note que no va por ahí.
        arrastre.setValue(g.dx >= 0 ? g.dx : g.dx * 0.15);
      },
      onPanResponderRelease: (_e, g) => {
        tocando.current = false;
        if (seQuita(g.dx, g.vx, ancho.current)) {
          Animated.timing(arrastre, {
            toValue: ancho.current + 40,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start(() => cerrar('deslizado'));
        } else {
          Animated.spring(arrastre, { toValue: 0, speed: 24, bounciness: 6, useNativeDriver: true }).start();
          if (!pausadoRef.current) seguir();
        }
      },
      onPanResponderTerminate: () => {
        tocando.current = false;
        Animated.spring(arrastre, { toValue: 0, speed: 24, bounciness: 6, useNativeDriver: true }).start();
        if (!pausadoRef.current) seguir();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const alMedir = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) ancho.current = w;
  };

  // Rango fijo: cambiar el nodo animado de una vista viva es arriesgado en Android.
  const opacity = useRef(arrastre.interpolate({ inputRange: [0, 280], outputRange: [1, 0.15], extrapolate: 'clamp' })).current;
  // scaleX desde el borde izquierdo: la barra crece hacia la derecha.
  const escala = useRef(progreso.interpolate({ inputRange: [0, 1], outputRange: [0.0001, 1] })).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      onLayout={alMedir}
      style={[
        style,
        estilos.marco,
        { borderRadius: radio, padding: grosor, backgroundColor: c.border },
        { opacity, transform: [{ translateX: arrastre }] },
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[
          estilos.barra,
          { backgroundColor: color ?? c.accent, transform: [{ scaleX: escala }] },
        ]}
      />
      <View style={[estilos.contenido, { borderRadius: Math.max(0, radio - grosor), backgroundColor: colorFondo ?? c.surface }, contenidoStyle]}>
        {children}
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  marco: { overflow: 'hidden' },
  // Crece desde el borde izquierdo (scaleX): la barra se llena hacia la derecha.
  barra: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, transformOrigin: 'left' },
  contenido: { overflow: 'hidden' },
});
