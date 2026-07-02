/**
 * Logo de Vitrina — concepto "V-toldo": un toldo/marquesina de tienda (las ondas
 * doradas arriba) sobre una "V" que evoca la vitrina/escaparate. Dibujado en SVG
 * para que escale nítido a cualquier tamaño (ícono de app, header, splash).
 *
 *   <VitrinaMark size={48} />              ← ícono cuadrado (grafito + dorado)
 *   <VitrinaMark size={28} showBg={false} gold={c.accent} />  ← solo la marca
 *   <VitrinaWordmark size={26} />          ← marca + palabra "Vitrina"
 */
import React from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { G, Line, Path, Rect, Svg } from 'react-native-svg';
import { c, font } from '../theme';

type MarkProps = {
  size?: number;
  /** Fondo del cuadrado (variante ícono). */
  bg?: string;
  /** Color de la marca (toldo + V). */
  gold?: string;
  /** Mostrar el cuadrado de fondo (ícono) o solo la marca. */
  showBg?: boolean;
  rounded?: boolean;
};

export function VitrinaMark({
  size = 44,
  bg = c.brand,
  gold = c.accent,
  showBg = true,
  rounded = true,
}: MarkProps) {
  const shine = showBg ? c.onBrand : gold;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {showBg && <Rect x={0} y={0} width={64} height={64} rx={rounded ? 16 : 0} fill={bg} />}
      <G>
        {/* Toldo (marquesina) con ondas */}
        <Path
          d="M12 15 H52 V20 Q47 26 42 20 Q37 26 32 20 Q27 26 22 20 Q17 26 12 20 Z"
          fill={gold}
        />
        {/* La "V" de Vitrina */}
        <Path
          d="M19 28 L32 49 L45 28"
          stroke={gold}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Brillo del vidrio */}
        <Line
          x1={22}
          y1={36}
          x2={29}
          y2={29}
          stroke={shine}
          strokeOpacity={0.22}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

type WordmarkProps = {
  size?: number;
  color?: string;
  gold?: string;
  withMark?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function VitrinaWordmark({
  size = 26,
  color = c.textStrong,
  gold = c.accent,
  withMark = true,
  style,
  textStyle,
}: WordmarkProps) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
      {withMark && <VitrinaMark size={size * 1.3} gold={gold} />}
      <Text
        style={[
          { fontFamily: font.displayExtra, fontSize: size, color, letterSpacing: 0.3 },
          textStyle,
        ]}>
        Vitrina
      </Text>
    </View>
  );
}
