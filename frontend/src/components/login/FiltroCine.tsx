/**
 * Filtro de cine del login: capas encima de la foto y debajo del contenido.
 *   · baño de color a pantalla completa,
 *   · viñeta radial,
 *   · grano de película,
 *   · velo superior (barra de estado) e inferior (nombre del lugar).
 * Todo es estático: no anima nada.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { ColoresLogin } from '../../theme';

const GRANO = require('../../../assets/login/grano.png');

const VELO_ARRIBA = 150;
const VELO_ABAJO = 220;

type Props = { ancho: number; alto: number; c: ColoresLogin };

export default function FiltroCine({ ancho, alto, c }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bano }]} />

      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="vinetaLogin"
            cx="50%"
            cy="48%"
            r="72%"
            fx="50%"
            fy="48%"
          >
            <Stop offset="0" stopColor={c.sombraEscena} stopOpacity={0} />
            <Stop offset="0.45" stopColor={c.sombraEscena} stopOpacity={0} />
            <Stop
              offset="1"
              stopColor={c.sombraEscena}
              stopOpacity={c.vinetaOp}
            />
          </RadialGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={ancho}
          height={alto}
          fill="url(#vinetaLogin)"
        />
      </Svg>

      <Image
        source={GRANO}
        resizeMode="stretch"
        fadeDuration={0}
        style={[
          StyleSheet.absoluteFill,
          { width: ancho, height: alto, opacity: c.granoOp },
        ]}
      />

      <Svg width={ancho} height={VELO_ARRIBA} style={styles.arriba}>
        <Defs>
          <LinearGradient id="veloArribaLogin" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={c.sombraEscena}
              stopOpacity={c.veloArribaOp}
            />
            <Stop offset="1" stopColor={c.sombraEscena} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={ancho}
          height={VELO_ARRIBA}
          fill="url(#veloArribaLogin)"
        />
      </Svg>

      <Svg
        width={ancho}
        height={VELO_ABAJO}
        style={[styles.abajo, { top: alto - VELO_ABAJO }]}
      >
        <Defs>
          <LinearGradient id="veloAbajoLogin" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.sombraEscena} stopOpacity={0} />
            <Stop offset="0.6" stopColor={c.sombraEscena} stopOpacity={0.72} />
            <Stop offset="1" stopColor={c.sombraEscena} stopOpacity={0.92} />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={ancho}
          height={VELO_ABAJO}
          fill="url(#veloAbajoLogin)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  arriba: { position: 'absolute', left: 0, top: 0 },
  abajo: { position: 'absolute', left: 0 },
});
