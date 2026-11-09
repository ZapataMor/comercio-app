/**
 * Carita con casco de domiciliario, de 1 (muy brava) a 5 (muy feliz). Con
 * ellas el cliente califica al domiciliario en amabilidad, rapidez y estado
 * del producto, y el domiciliario ve su promedio.
 *
 *   <Carita nota={5} size={44} />
 *
 * Colores fijos (de rojo a verde), como un emoji: se leen igual en el modo
 * día y en el modo noche.
 */
import React from 'react';
import { Circle, Path, Svg } from 'react-native-svg';
import { NotaCarita } from '../api';

/** [casco, cara] de cada nota. */
const TONOS: Record<NotaCarita, [string, string]> = {
  1: ['#D64541', '#FFDCD6'],
  2: ['#EF7D32', '#FFE6D1'],
  3: ['#E9AE1C', '#FFF1C9'],
  4: ['#7DB52E', '#E8F5D2'],
  5: ['#1F9D5C', '#D3F1E0'],
};

const TINTA = '#2B2118';
const RUBOR = '#FF7A6B';

/** Color de la nota (el del casco), para textos y bordes que la acompañan. */
export function colorCarita(nota: NotaCarita): string {
  return TONOS[nota][0];
}

/** 3.6 → 4: la carita que corresponde a un promedio. */
export function notaDePromedio(promedio: number): NotaCarita {
  return Math.min(5, Math.max(1, Math.round(promedio))) as NotaCarita;
}

const trazo = { stroke: TINTA, strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' };

function Ojos({ y }: { y: number }) {
  return (
    <>
      <Circle cx={25.5} cy={y} r={2.4} fill={TINTA} />
      <Circle cx={38.5} cy={y} r={2.4} fill={TINTA} />
    </>
  );
}

function Rubor({ opacidad }: { opacidad: number }) {
  return (
    <>
      <Circle cx={20.5} cy={46.5} r={2.8} fill={RUBOR} opacity={opacidad} />
      <Circle cx={43.5} cy={46.5} r={2.8} fill={RUBOR} opacity={opacidad} />
    </>
  );
}

/** Cejas, ojos y boca de cada nota. */
const GESTOS: Record<NotaCarita, React.ReactNode> = {
  // Muy brava: cejas fruncidas y boca hacia abajo.
  1: (
    <>
      <Path d="M20.5 34 28.5 37M43.5 34 35.5 37" {...trazo} />
      <Ojos y={40.5} />
      <Path d="M25 51.5Q32 44.5 39 51.5" {...trazo} />
    </>
  ),
  // Molesta: cejas caídas, boca un poco hacia abajo.
  2: (
    <>
      <Path d="M21.5 35.5 28 33.7M42.5 35.5 36 33.7" {...trazo} />
      <Ojos y={40.5} />
      <Path d="M26 50.5Q32 46.5 38 50.5" {...trazo} />
    </>
  ),
  // Ni fu ni fa.
  3: (
    <>
      <Ojos y={40} />
      <Path d="M26 48.5H38" {...trazo} />
    </>
  ),
  // Contenta.
  4: (
    <>
      <Ojos y={40} />
      <Rubor opacidad={0.35} />
      <Path d="M25 46.5Q32 53 39 46.5" {...trazo} />
    </>
  ),
  // Muy feliz: ojos cerrados de risa y boca abierta.
  5: (
    <>
      <Path d="M22 41Q25.5 36.5 29 41M35 41Q38.5 36.5 42 41" {...trazo} />
      <Rubor opacidad={0.45} />
      <Path d="M24 45.5Q32 57 40 45.5Z" fill={TINTA} stroke={TINTA} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M28 49.6Q32 46.8 36 49.6Q32 52.6 28 49.6Z" fill={RUBOR} />
    </>
  ),
};

export default function Carita({ nota, size = 44 }: { nota: NotaCarita; size?: number }) {
  const [casco, cara] = TONOS[nota];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Correa del casco bajo la barbilla. */}
      <Path d="M15.5 49Q17 58.8 32 59.2Q47 58.8 48.5 49" stroke={casco} strokeWidth={1.8} fill="none" />
      <Circle cx={32} cy={38} r={18.5} fill={cara} stroke={casco} strokeWidth={2} />
      {GESTOS[nota]}
      {/* Casco abierto: cúpula que baja por los lados de la cara. */}
      <Path
        d="M8 42C8 21 18.5 7 32 7S56 21 56 42V47Q56 50 53 50H48.5V36Q48.5 28.5 41 28.5H23Q15.5 28.5 15.5 36V50H11Q8 50 8 47Z"
        fill={casco}
      />
      {/* Franja, visera levantada y brillo. */}
      <Path d="M29 7.2Q32 6.9 35 7.2V18.3H29Z" fill="#FFFFFF" fillOpacity={0.85} />
      <Path d="M13 29.5C18 19.5 46 19.5 51 29.5V26C46 15.5 18 15.5 13 26Z" fill={TINTA} fillOpacity={0.85} />
      <Path
        d="M16 21C18 15 21.5 11.8 25.5 10.2"
        stroke="#FFFFFF"
        strokeOpacity={0.5}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
