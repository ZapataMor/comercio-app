/**
 * Íconos de línea fina (solo borde), en el estilo de la referencia.
 * Dibujados con react-native-svg para que se vean nítidos y consistentes,
 * con color y grosor configurables. Reemplazan a los emojis de la app.
 *
 * Uso: <Icon name="tienda" size={24} color="#4f46e5" />
 */
import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Circle, G, Path, Polyline, Rect, Svg } from 'react-native-svg';

export type IconName =
  | 'casa'
  | 'tienda'
  | 'etiqueta'
  | 'bolsa'
  | 'herramientas'
  | 'moto'
  | 'usuario'
  | 'usuarios'
  | 'ubicacion'
  | 'telefono'
  | 'tarjeta'
  | 'caja'
  | 'basura'
  | 'carrito'
  | 'efectivo'
  | 'banco'
  | 'check'
  | 'cerrar'
  | 'imagen'
  | 'chevron'
  | 'lista'
  | 'lupa'
  | 'reloj';

const GLYPHS: Record<IconName, React.ReactNode> = {
  casa: (
    <>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <Path d="M9.5 21v-6h5v6" />
    </>
  ),
  tienda: (
    <>
      <Path d="M3 9l1.4-5h15.2L21 9" />
      <Path d="M3 9h18" />
      <Path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <Path d="M9.5 20.5v-5.5h5v5.5" />
    </>
  ),
  etiqueta: (
    <>
      <Path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 12.9V3.5h9.4l8.2 8.2a2 2 0 0 1 0 1.7z" />
      <Circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  bolsa: (
    <>
      <Path d="M6 2 3.5 6.5V20a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V6.5L18 2z" />
      <Path d="M3.5 6.5h17" />
      <Path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  herramientas: (
    <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
  ),
  moto: (
    <>
      <Circle cx="6" cy="16.5" r="3" />
      <Circle cx="18" cy="16.5" r="3" />
      <Path d="M6 16.5 9.5 9H15l3 7.5" />
      <Path d="M9.5 9 8 6H6" />
      <Path d="M15 9h3" />
    </>
  ),
  usuario: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  usuarios: (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  ubicacion: (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  telefono: (
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  tarjeta: (
    <>
      <Rect x="2" y="5" width="20" height="14" rx="2" />
      <Path d="M2 10h20" />
    </>
  ),
  caja: (
    <>
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <Polyline points="3.3 7 12 12 20.7 7" />
      <Path d="M12 22V12" />
    </>
  ),
  basura: (
    <>
      <Path d="M3 6h18" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
    </>
  ),
  carrito: (
    <>
      <Circle cx="9" cy="21" r="1.6" />
      <Circle cx="19" cy="21" r="1.6" />
      <Path d="M2 3h2.5l2.3 12.2a1.6 1.6 0 0 0 1.6 1.3h9.1a1.6 1.6 0 0 0 1.6-1.3L21.5 7H6" />
    </>
  ),
  efectivo: (
    <>
      <Rect x="2" y="6" width="20" height="12" rx="2" />
      <Circle cx="12" cy="12" r="2.5" />
      <Path d="M5.5 9.5v5" />
      <Path d="M18.5 9.5v5" />
    </>
  ),
  banco: (
    <>
      <Path d="M3 9.5 12 4l9 5.5" />
      <Path d="M4 9.5h16" />
      <Path d="M5.5 10v8" />
      <Path d="M9.5 10v8" />
      <Path d="M14.5 10v8" />
      <Path d="M18.5 10v8" />
      <Path d="M3 20.5h18" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  cerrar: (
    <>
      <Path d="M18 6 6 18" />
      <Path d="M6 6l12 12" />
    </>
  ),
  imagen: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Path d="M21 15l-5-5L5 21" />
    </>
  ),
  chevron: <Path d="M9 6l6 6-6 6" />,
  lista: (
    <>
      <Path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <Rect x="8" y="2" width="8" height="4" rx="1" />
      <Path d="M8 11h8" />
      <Path d="M8 15h8" />
      <Path d="M8 19h5" />
    </>
  ),
  lupa: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M21 21l-4.3-4.3" />
    </>
  ),
  reloj: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
};

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Acepta también estilos de texto (p. ej. heredados de un emoji) por comodidad. */
  style?: StyleProp<ViewStyle | TextStyle>;
};

export default function Icon({ name, size = 22, color = '#0f172a', strokeWidth = 1.8, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style as StyleProp<ViewStyle>}>
      <G
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round">
        {GLYPHS[name]}
      </G>
    </Svg>
  );
}
