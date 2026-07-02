/**
 * Sistema visual de Vitrina — "Ámbar & Grafito".
 *
 * Fuente única de verdad del look & feel: color, tipografía, radios, sombras.
 * Concepto: una vitrina/escaparate iluminado — neutros cálidos (crema/grafito)
 * con un acento dorado que hace de "luz". Reemplaza el índigo+slate genérico.
 *
 * Las fuentes (Sora para títulos, Inter para texto) se cargan desde
 * assets/fonts. Si por algún motivo no estuvieran instaladas, React Native cae
 * a la fuente del sistema sin romper nada.
 */
import { TextStyle, ViewStyle } from 'react-native';

/** Paleta (tokens de color). */
export const c = {
  // Neutros cálidos
  bg: '#FAF8F4', // fondo de la app (crema cálida)
  surface: '#FFFFFF', // tarjetas, inputs
  surface2: '#F4EFE7', // fondos suaves / skeletons
  border: '#EAE3D8', // bordes y divisores
  borderStrong: '#DED5C7', // borde de inputs

  // Texto
  textStrong: '#1F1B16', // títulos (grafito cálido casi negro)
  text: '#3D372F', // cuerpo
  muted: '#8A8175', // secundario
  mutedSoft: '#A89E90', // placeholders / muy tenue
  chevron: '#CDC3B4', // chevrons e íconos decorativos

  // Marca
  brand: '#262019', // primario: header, botón principal (texto claro)
  brandSoft: '#3A332B', // presionado
  onBrand: '#FFFFFF', // texto/ícono sobre grafito

  // Acento dorado (la "luz" de la vitrina)
  accent: '#E8A019', // resaltes, CTA de compra, foco, detalles
  accentStrong: '#C9851A', // dorado presionado
  accentSoft: '#FBEED4', // fondo de chips/badges dorados
  onAccent: '#3A2A06', // texto/ícono sobre dorado (contraste AA)
  goldText: '#9A6B0F', // dorado legible para texto sobre blanco (precios, links)

  // Semánticos
  success: '#1E874B',
  successSoft: '#D8F3E0',
  warning: '#B5740A',
  warningSoft: '#FBEED4',
  danger: '#C0392B',
  dangerSoft: '#FBE3DF',
  info: '#2F6FB0',
  infoSoft: '#E2EDF8',

  // Overlays
  scrim: 'rgba(31,27,22,0.45)',
} as const;

/** Color por estado del pedido (texto + fondo del chip). */
export const estado: Record<string, { fg: string; bg: string }> = {
  pendiente: { fg: '#B5740A', bg: '#FBEED4' },
  listo: { fg: '#2F6FB0', bg: '#E2EDF8' },
  tomado: { fg: '#6D54E0', bg: '#EBE7FE' },
  recogido: { fg: '#0E7C8C', bg: '#D9F1F2' },
  en_camino: { fg: '#0E7490', bg: '#D2ECEF' },
  entregado: { fg: '#1E874B', bg: '#D8F3E0' },
  cancelado: { fg: '#C0392B', bg: '#FBE3DF' },
};

export function estadoColor(e?: string | null) {
  return (e && estado[e]) || { fg: c.muted, bg: c.surface2 };
}

/**
 * Familias tipográficas (nombre de archivo del .ttf, que es como Android las
 * registra). Sora = títulos con carácter; Inter = cuerpo legible.
 */
export const font = {
  // Títulos / display (Sora)
  display: 'Sora_700Bold',
  displayExtra: 'Sora_800ExtraBold',
  displaySemi: 'Sora_600SemiBold',
  // Texto / UI (Inter)
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extra: 'Inter_800ExtraBold',
} as const;

/** Radios de esquina. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

/** Escala de espaciado (rejilla de 4). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Sombras cálidas, en capas (el "brillo de vitrina"). */
export const shadow: Record<'low' | 'soft' | 'card' | 'gold', ViewStyle> = {
  low: {
    shadowColor: '#7A5A2A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  soft: {
    shadowColor: '#7A5A2A',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  card: {
    shadowColor: '#7A5A2A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  gold: {
    shadowColor: '#E8A019',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

/** Presets de texto listos para usar (se combinan con color en cada pantalla). */
export const type: Record<string, TextStyle> = {
  display: { fontFamily: font.display, fontSize: 26, color: c.textStrong },
  h1: { fontFamily: font.display, fontSize: 22, color: c.textStrong },
  h2: { fontFamily: font.displaySemi, fontSize: 18, color: c.textStrong },
  cardTitle: { fontFamily: font.bold, fontSize: 17, color: c.textStrong },
  body: { fontFamily: font.regular, fontSize: 15, color: c.text },
  bodyMed: { fontFamily: font.medium, fontSize: 15, color: c.text },
  label: { fontFamily: font.semibold, fontSize: 13, color: c.text },
  meta: { fontFamily: font.medium, fontSize: 13, color: c.muted },
  chip: { fontFamily: font.bold, fontSize: 11 },
  button: { fontFamily: font.bold, fontSize: 16, color: c.onBrand },
};
