/**
 * Splash animado de Vitrina — recreación nativa de vitrina-splash-dia.html /
 * -noche.html del kit oficial (Animated + react-native-svg, sin WebView).
 *
 * Secuencia (~2,3 s, tiempos del kit):
 *   0,1–0,7 s  el toldo se despliega (scaleY con rebote)
 *   0,5–1,0 s  la V sube y aparece
 *   0,8–1,8 s  el foco (sol/luna) parpadea y se enciende
 *   1,75–2,75 s destello (halo que crece y se disipa)
 *   1,7–2,25 s el nombre sube
 * Luego el overlay se desvanece y avisa con onFin.
 *
 * Respeta la preferencia de "reducir movimiento" del sistema: muestra el
 * logo estático un instante y sale, igual que el splash web del kit.
 */
import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Svg } from 'react-native-svg';
import {
  coloresModo,
  marca,
  PuntoGlifo,
  ToldoGlifo,
  UveGlifo,
  useModoVitrina,
  VitrinaNombre,
} from './Logo';

/** Lado del símbolo en px (como el splash del kit: 180×180, viewBox 200). */
const TAM = 180;
const ESC = TAM / 200;

export default function SplashVitrina({ onFin }: { onFin: () => void }) {
  const modo = useModoVitrina();
  const col = coloresModo(modo);
  const noche = modo === 'noche';
  const fondo = noche ? marca.indigo : marca.arena;

  const toldo = React.useRef(new Animated.Value(0)).current;
  const uve = React.useRef(new Animated.Value(0)).current;
  const foco = React.useRef(new Animated.Value(0)).current;
  const halo = React.useRef(new Animated.Value(0)).current;
  const nombre = React.useRef(new Animated.Value(0)).current;
  const salida = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    let cancelado = false;
    let espera: ReturnType<typeof setTimeout> | undefined;

    const terminar = () => {
      if (cancelado) return;
      Animated.timing(salida, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelado) onFin();
      });
    };

    AccessibilityInfo.isReduceMotionEnabled().then(reducido => {
      if (cancelado) return;
      if (reducido) {
        // Sin animación: logo completo estático y salida temprana.
        toldo.setValue(1);
        uve.setValue(1);
        foco.setValue(1);
        nombre.setValue(1);
        espera = setTimeout(terminar, 900);
        return;
      }
      Animated.parallel([
        // Toldo: keyframes 0 → 1,07 (70 %) → 1 vía bezier con rebote.
        Animated.timing(toldo, {
          toValue: 1,
          duration: 600,
          delay: 100,
          easing: Easing.bezier(0.34, 1.4, 0.64, 1),
          useNativeDriver: true,
        }),
        Animated.timing(uve, {
          toValue: 1,
          duration: 500,
          delay: 500,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        // Foco: apagado hasta el 40 % del segundo, enciende, titila, enciende.
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(foco, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(foco, { toValue: 0.25, duration: 100, useNativeDriver: true }),
          Animated.timing(foco, { toValue: 1, duration: 130, useNativeDriver: true }),
        ]),
        Animated.timing(halo, {
          toValue: 1,
          duration: 1000,
          delay: 1750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(nombre, {
          toValue: 1,
          duration: 550,
          delay: 1700,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) espera = setTimeout(terminar, 250);
      });
    });

    return () => {
      cancelado = true;
      if (espera) clearTimeout(espera);
    };
  }, [foco, halo, nombre, onFin, salida, toldo, uve]);

  // Origen de transformación: RN escala desde el centro (90 px). Los
  // translateY compensan para anclar el toldo a su borde superior (y=27)
  // y el halo al centro del punto (y=93,6), como el transform-origin del CSS.
  return (
    <Animated.View style={[styles.overlay, { backgroundColor: fondo, opacity: salida }]}>
      <StatusBar
        animated
        barStyle={noche ? 'light-content' : 'dark-content'}
        backgroundColor={fondo}
      />
      <View style={styles.simbolo}>
        {/* Destello (halo) detrás del punto */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: halo.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.5, 0] }),
              transform: [
                { translateY: halo.interpolate({ inputRange: [0, 1], outputRange: [1.44, -4.68] }) },
                { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.3] }) },
              ],
            },
          ]}>
          <Svg width={TAM} height={TAM} viewBox="0 0 200 200">
            <PuntoGlifo color={col.punto} />
          </Svg>
        </Animated.View>

        {/* Toldo que se despliega */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateY: toldo.interpolate({ inputRange: [0, 1], outputRange: [30 * ESC - TAM / 2, 0] }) },
                { scaleY: toldo },
              ],
            },
          ]}>
          <Svg width={TAM} height={TAM} viewBox="0 0 200 200">
            <ToldoGlifo crema={col.crema} />
          </Svg>
        </Animated.View>

        {/* La V que sube */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: uve,
              transform: [
                { translateY: uve.interpolate({ inputRange: [0, 1], outputRange: [26 * ESC, 0] }) },
              ],
            },
          ]}>
          <Svg width={TAM} height={TAM} viewBox="0 0 200 200">
            <UveGlifo color={col.trazoV} />
          </Svg>
        </Animated.View>

        {/* El foco (sol de día, luna de noche) */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: foco }]}>
          <Svg width={TAM} height={TAM} viewBox="0 0 200 200">
            <PuntoGlifo color={col.punto} />
          </Svg>
        </Animated.View>
      </View>

      {/* Nombre que sube y aparece */}
      <Animated.View
        style={{
          opacity: nombre,
          transform: [
            { translateY: nombre.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        }}>
        <VitrinaNombre fontSize={44} color={noche ? marca.arena : marca.tinta} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    zIndex: 100,
    elevation: 100,
  },
  simbolo: { width: TAM, height: TAM },
});
