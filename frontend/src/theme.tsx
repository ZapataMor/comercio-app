/**
 * Sistema visual de Vitrina — "Ámbar & Grafito" (día) / "Índigo & Luna" (noche).
 *
 * Fuente única de verdad del look & feel: color, tipografía, radios, sombras.
 * Concepto: una vitrina/escaparate iluminado. De día, neutros cálidos
 * (crema/grafito) con un acento dorado que hace de "luz"; de noche, el índigo
 * del kit de marca con trazos arena, acento terracota y brillo de luna.
 *
 * El modo sigue la hora local, igual que el logo (día 05:00–17:59, noche el
 * resto), y cambia en vivo sin reiniciar la app:
 *
 *   const { c, shadow } = useTheme();        ← colores del modo vigente
 *   const useStyles = makeStyles((c, shadow) => ({ ... }));
 *   const styles = useStyles();              ← StyleSheet del modo vigente
 *
 * Las fuentes (Sora para títulos, Inter para texto) se cargan desde
 * assets/fonts. Si por algún motivo no estuvieran instaladas, React Native cae
 * a la fuente del sistema sin romper nada.
 */
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { ModoVitrina, marca, useModoVitrina } from './components/Logo';

/** Paleta de día (tokens de color). */
const dia = {
  // Neutros cálidos
  bg: '#FAF8F4', // fondo de la app (crema cálida)
  surface: '#FFFFFF', // tarjetas, inputs
  surface2: '#F4EFE7', // fondos suaves / skeletons
  border: '#EAE3D8', // bordes y divisores
  borderStrong: '#DED5C7', // borde de inputs
  switchOff: '#D8D0C4', // riel de switches apagados
  switchThumb: '#FFFFFF', // perilla de switches

  // Texto
  textStrong: '#1F1B16', // títulos (grafito cálido casi negro)
  text: '#3D372F', // cuerpo
  muted: '#8A8175', // secundario
  mutedSoft: '#A89E90', // placeholders / muy tenue
  chevron: '#CDC3B4', // chevrons e íconos decorativos

  // Marca
  brand: '#262019', // primario: botón principal, chips activos (texto claro)
  brandSoft: '#3A332B', // presionado
  onBrand: '#FFFFFF', // texto/ícono sobre el primario
  header: '#262019', // barra superior y barra de estado
  onHeader: '#FFFFFF', // texto/ícono sobre la barra superior
  onHeaderOk: '#D8F3E0', // estado positivo sobre la barra superior ("Abierto")
  onHeaderOff: '#FBE3DF', // estado negativo sobre la barra superior ("Cerrado")
  headerTrack: '#6B6358', // riel de switch apagado sobre la barra superior

  // Acento (la "luz" de la vitrina)
  accent: '#E8A019', // resaltes, CTA de compra, foco, detalles
  accentStrong: '#C9851A', // acento presionado
  accentSoft: '#FBEED4', // fondo de chips/badges de acento
  onAccent: '#3A2A06', // texto/ícono sobre acento (contraste AA)
  goldText: '#9A6B0F', // acento legible como texto sobre superficie (precios, links)

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
};

export type Colores = typeof dia;

/** Paleta de noche: misma forma, colores del kit nocturno (como el login). */
const noche: Colores = {
  bg: marca.indigo, // #1A1F3D
  surface: '#232950',
  surface2: '#2B315C',
  border: '#313863',
  borderStrong: '#3E4675',
  switchOff: '#4A5180',
  switchThumb: marca.arena,

  textStrong: marca.arena, // #F7EBD8
  text: '#DDD5CA',
  muted: '#A0A5C2',
  mutedSoft: '#7A80A3',
  chevron: '#5A6089',

  brand: marca.arena, // botón principal claro con texto índigo (como el login)
  brandSoft: '#E6D8C2',
  onBrand: marca.indigo,
  header: '#141833',
  onHeader: marca.arena,
  onHeaderOk: '#4CC38A',
  onHeaderOff: '#FF7A6B',
  headerTrack: '#3E4675',

  accent: marca.terracota, // #E2572B
  accentStrong: '#C4461F',
  accentSoft: '#3E293A',
  onAccent: '#FFFFFF',
  goldText: '#EE7F57', // terracota aclarado: legible sobre índigo

  success: '#4CC38A',
  successSoft: '#1D3B3B',
  warning: marca.sol, // #F2A93B
  warningSoft: '#3B3236',
  danger: '#FF7A6B',
  dangerSoft: '#40263A',
  info: '#7FB2F0',
  infoSoft: '#233256',

  scrim: 'rgba(5,7,20,0.6)',
};

export const paletas: Record<ModoVitrina, Colores> = { dia, noche };

type ColorEstado = { fg: string; bg: string };

/** Color por estado del pedido (texto + fondo del chip), por modo. */
const estados: Record<ModoVitrina, Record<string, ColorEstado>> = {
  dia: {
    pendiente: { fg: '#B5740A', bg: '#FBEED4' },
    listo: { fg: '#2F6FB0', bg: '#E2EDF8' },
    tomado: { fg: '#6D54E0', bg: '#EBE7FE' },
    recogido: { fg: '#0E7C8C', bg: '#D9F1F2' },
    en_camino: { fg: '#0E7490', bg: '#D2ECEF' },
    entregado: { fg: '#1E874B', bg: '#D8F3E0' },
    cancelado: { fg: '#C0392B', bg: '#FBE3DF' },
  },
  noche: {
    pendiente: { fg: '#F2A93B', bg: '#3B3236' },
    listo: { fg: '#7FB2F0', bg: '#233256' },
    tomado: { fg: '#A797FF', bg: '#2D2A5E' },
    recogido: { fg: '#4FC9D6', bg: '#1B3A4A' },
    en_camino: { fg: '#45B8D0', bg: '#1B3648' },
    entregado: { fg: '#4CC38A', bg: '#1D3B3B' },
    cancelado: { fg: '#FF7A6B', bg: '#40263A' },
  },
};

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

export type Sombras = Record<'low' | 'soft' | 'card' | 'gold', ViewStyle>;

/** Sombras en capas (el "brillo de vitrina"): cálidas de día, profundas de noche. */
function crearSombras(base: string, opacidad: number, brillo: string): Sombras {
  return {
    low: {
      shadowColor: base,
      shadowOpacity: 0.06 * opacidad,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    soft: {
      shadowColor: base,
      shadowOpacity: 0.1 * opacidad,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    card: {
      shadowColor: base,
      shadowOpacity: 0.12 * opacidad,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    gold: {
      shadowColor: brillo,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  };
}

const sombras: Record<ModoVitrina, Sombras> = {
  dia: crearSombras('#7A5A2A', 1, dia.accent),
  noche: crearSombras('#050714', 3.5, noche.accent),
};

export type Tema = {
  modo: ModoVitrina;
  c: Colores;
  shadow: Sombras;
  estadoColor: (e?: string | null) => ColorEstado;
};

function crearTema(modo: ModoVitrina): Tema {
  const c = paletas[modo];
  return {
    modo,
    c,
    shadow: sombras[modo],
    estadoColor: e => (e && estados[modo][e]) || { fg: c.muted, bg: c.surface2 },
  };
}

const TEMAS: Record<ModoVitrina, Tema> = { dia: crearTema('dia'), noche: crearTema('noche') };

const ThemeContext = React.createContext<Tema>(TEMAS.dia);

/** Provee el tema del modo vigente (día/noche por hora) a toda la app. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const modo = useModoVitrina();
  return <ThemeContext.Provider value={TEMAS[modo]}>{children}</ThemeContext.Provider>;
}

/** Tema vigente: `c` (colores), `shadow`, `estadoColor` y `modo`. */
export function useTheme(): Tema {
  return React.useContext(ThemeContext);
}

/**
 * Declara estilos que dependen del tema. Devuelve un hook que entrega el
 * StyleSheet del modo vigente; cada modo se crea una sola vez y se cachea.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  crear: (c: Colores, shadow: Sombras) => T,
): () => T {
  const cache: Partial<Record<ModoVitrina, T>> = {};
  return function useStyles() {
    const { modo } = useTheme();
    let estilos = cache[modo];
    if (!estilos) {
      estilos = StyleSheet.create(crear(paletas[modo], sombras[modo]));
      cache[modo] = estilos;
    }
    return estilos;
  };
}
