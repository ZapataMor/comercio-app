/**
 * Microanimaciones de Vitrina, con la API `Animated` nativa de React Native
 * (sin dependencias nuevas). Movimiento con propósito: entradas suaves, tacto
 * que responde y skeletons de carga.
 *
 *   <PressableScale onPress={...} style={styles.card}>…</PressableScale>
 *   <FadeInView delay={index * 50}>…</FadeInView>
 *   <Skeleton width={120} height={16} />
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { c, radius } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  /** A cuánto se encoge al presionar (0.96 por defecto). */
  scaleTo?: number;
  children?: React.ReactNode;
};

/** Pressable que se encoge con un pequeño "spring" al tocarlo. */
export function PressableScale({
  style,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={e => {
        Animated.spring(s, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
        onPressIn?.(e);
      }}
      onPressOut={e => {
        Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale: s }] }]}>
      {children}
    </AnimatedPressable>
  );
}

type FadeInViewProps = {
  children?: React.ReactNode;
  /** Retardo en ms (úsalo con el índice para entradas en cascada). */
  delay?: number;
  /** Desplazamiento vertical inicial (px). */
  offset?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/** Aparece con fundido + leve deslizamiento hacia arriba al montarse. */
export function FadeInView({
  children,
  delay = 0,
  offset = 12,
  duration = 340,
  style,
}: FadeInViewProps) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [a, delay, duration]);

  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

type DesplegableProps = {
  /** true = extendido, false = recogido. El cambio se anima en ambos sentidos. */
  abierto: boolean;
  children?: React.ReactNode;
  duration?: number;
};

/**
 * Sección plegable con transición suave de alto + fundido, en ambos sentidos.
 *
 * El contenido se renderiza siempre (en una capa absoluta que sirve para
 * medir su alto real con onLayout) y el contenedor anima su `height` entre 0
 * y ese alto. `height` no soporta el driver nativo, por eso useNativeDriver
 * va en false.
 */
export function Desplegable({ abierto, children, duration = 200 }: DesplegableProps) {
  const [alto, setAlto] = useState(0);
  // Arranca ya abierto/cerrado según el estado inicial: así una card extendida
  // que la FlatList recicla y vuelve a montar no se re-anima desde cero.
  const anim = useRef(new Animated.Value(abierto ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: abierto ? 1 : 0,
      duration,
      // Arranca rápido y frena suave: responde al instante sin verse brusco.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [abierto, anim, duration]);

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, alto] });
  // El fundido termina de aparecer antes que el alto, para que no se vea vacío.
  const opacity = anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.75, 1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <Animated.View style={{ height, opacity, overflow: 'hidden' }}>
      <Animated.View
        style={{ position: 'absolute', left: 0, top: 0, right: 0, transform: [{ translateY }] }}
        onLayout={e => setAlto(e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  r?: number;
  style?: StyleProp<ViewStyle>;
};

/** Bloque "fantasma" que late suavemente mientras carga el contenido. */
export function Skeleton({ width = '100%', height = 14, r = radius.sm, style }: SkeletonProps) {
  const a = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: c.surface2, opacity: a }, style]}
    />
  );
}

/** Lista de tarjetas "fantasma" para pantallas que cargan (Explorar, etc.). */
export function CardSkeletons({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            backgroundColor: c.surface,
            borderRadius: radius.lg,
            padding: 16,
            marginBottom: 12,
          }}>
          <Skeleton width="100%" height={120} r={radius.md} style={{ marginBottom: 12 }} />
          <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </Animated.View>
      ))}
    </>
  );
}
