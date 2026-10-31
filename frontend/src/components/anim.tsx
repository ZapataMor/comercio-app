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
  LayoutAnimation,
  Pressable,
  PressableProps,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { radius, useTheme } from '../theme';

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

/** Duración del despliegue de un <Desplegable> (alto + fundido), en ms. */
const DURACION_DESPLIEGUE = 280;

/**
 * Anima el alto del próximo cambio de layout. Llámalo justo antes del setState
 * que abre o cierra un <Desplegable>:
 *
 *   animarDespliegue();
 *   setAbiertoId(id);
 *
 * Usa LayoutAnimation: en la Nueva Arquitectura los cuadros intermedios se
 * calculan en el hilo de UI, así que la sección, su card y las cards de abajo
 * se mueven fluidas aunque JS esté ocupado. (Animar `height` con Animated iba
 * por JS y re-medía toda la lista en cada cuadro: de ahí los tirones.)
 */
export function animarDespliegue(duration = DURACION_DESPLIEGUE) {
  LayoutAnimation.configureNext({
    duration,
    // Arranca rápido y frena suave: responde al instante sin verse brusco.
    update: { type: LayoutAnimation.Types.easeOut },
  });
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
 * Recogida queda con alto 0 y recorta su contenido, que sigue montado (la
 * imagen ya está cargada al abrir). El alto lo anima `animarDespliegue()`, que
 * quien cambia `abierto` llama justo antes; el fundido va aquí con el driver
 * nativo. Ninguno de los dos pasa por JS cuadro a cuadro.
 *
 * Si la card que lo contiene es un PressableScale, pon el fondo de la card en
 * una View interna: LayoutAnimation corta en seco la animación de una vista si
 * React le cambia props a mitad de camino, y PressableScale sincroniza su
 * escala al terminar el resorte. Con el fondo adentro solo se corta el
 * envoltorio, que no se ve.
 */
export function Desplegable({ abierto, children, duration = DURACION_DESPLIEGUE }: DesplegableProps) {
  // Arranca ya abierto/cerrado según el estado inicial: así una card extendida
  // que la FlatList vuelve a montar no se re-anima desde cero.
  const anim = useRef(new Animated.Value(abierto ? 1 : 0)).current;
  const previo = useRef(abierto);

  useEffect(() => {
    // Solo anima cuando cambia: al montar ya está en su sitio.
    if (previo.current === abierto) return;
    previo.current = abierto;
    Animated.timing(anim, {
      toValue: abierto ? 1 : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [abierto, anim, duration]);

  // El fundido termina de aparecer antes que el alto, para que no se vea vacío.
  const opacity = anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.75, 1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <View style={{ overflow: 'hidden', height: abierto ? undefined : 0 }}>
      {/* El fundido va en esta vista interna, que nunca cambia de tamaño: así
          LayoutAnimation no la toca y no pisa la opacidad del driver nativo. */}
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
    </View>
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
  const { c } = useTheme();
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
  const { c } = useTheme();
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
