/**
 * Microanimaciones de Vitrina, con la API `Animated` nativa de React Native
 * (sin dependencias nuevas). Movimiento con propósito: entradas suaves, tacto
 * que responde y skeletons de carga.
 *
 *   <PressableScale onPress={...} style={styles.card}>…</PressableScale>
 *   <FadeInView delay={index * 50}>…</FadeInView>
 *   <Skeleton width={120} height={16} />
 */
import React, { useEffect, useRef } from 'react';
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
