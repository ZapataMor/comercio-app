import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as GradLineal,
  Path,
  Polygon,
  RadialGradient as GradRadial,
  Rect,
  Stop,
} from 'react-native-svg';
import { login } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import FieldError from '../components/FieldError';
import { marca, ModoVitrina, useModoVitrina } from '../components/Logo';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, paletas, radius } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// ─────────────────────────────────────────────────────────────
// Login — "Atardecer en Maicao"
// Port 1:1 de «Rediseño login Vitrina/Login Vitrina v2 Maicao.dc.html».
// El diseño está trazado sobre una pantalla de 396×812: las posiciones se
// escalan a la pantalla real (sx, sy) y los tamaños se respetan tal cual.
// Skyline maicaero en grafito (fachadas, minarete, cardones), sol ámbar en
// el horizonte, cenefa Wayuu que se teje sola y viento guajiro: arena en
// diagonal + telas de almacén ondeando.
//
// Igual que el logo y el splash, cambia con la hora (useModoVitrina):
//   · Día   (05:00–17:59): atardecer ámbar con sol, paleta Ámbar & Grafito.
//   · Noche (18:00–04:59): luna plateada y estrellas, paleta nocturna del kit
//     de marca (índigo, arena, luna y terracota).
// ─────────────────────────────────────────────────────────────
const c = paletas.dia; // la escena de día parte de la paleta diurna de la app
const ORO = c.accent; // #E8A019
const GRAFITO = c.brand; // #262019
const TINTA = c.textStrong; // #1F1B16

/** Colores de la pantalla en cada modo. */
const PALETA: Record<ModoVitrina, {
  fondo: string;
  barraEstado: 'dark-content' | 'light-content';
  cielo: string;
  cieloOp: [number, number, number];
  astro: string;
  astroOp: [number, number];
  crater: string | null;
  glow: string;
  glowOp: [number, number];
  suelo: string;
  sueloOp: number;
  duna: string;
  dunaOp: number;
  trazoDuna: string;
  silueta: string;
  ventanas: string;
  ventanasOp: number;
  telaAcento: string;
  particula: string;
  estrella: string | null;
  cenefaA: string;
  cenefaB: string;
  chip: string;
  chipSombra: string;
  chipBarra: string;
  chipV: string;
  nombre: string;
  textoAcento: string;
  panel: string;
  panelBorde: string;
  panelSombra: string;
  label: string;
  input: string;
  inputBorde: string;
  inputTexto: string;
  foco: string;
  focoSombra: string;
  boton: string;
  botonTexto: string;
  botonSombra: string;
  destello: string;
  destelloOp: number;
  hint: string;
  errorFondo: string;
  errorTexto: string;
}> = {
  dia: {
    fondo: c.bg, // #FAF8F4
    barraEstado: 'dark-content',
    // escena: atardecer
    cielo: ORO,
    cieloOp: [0, 0.1, 0.22],
    astro: ORO, // sol
    astroOp: [0.95, 0.55],
    crater: null,
    glow: ORO,
    glowOp: [0.42, 0.1],
    suelo: ORO,
    sueloOp: 0.08,
    duna: c.accentSoft, // #FBEED4
    dunaOp: 0.65,
    trazoDuna: GRAFITO,
    silueta: GRAFITO,
    ventanas: ORO,
    ventanasOp: 0.55,
    telaAcento: ORO,
    particula: ORO,
    estrella: null,
    // cenefa
    cenefaA: ORO,
    cenefaB: GRAFITO,
    // marca
    chip: ORO,
    chipSombra: '0px 6px 16px rgba(232,160,25,0.45)',
    chipBarra: TINTA,
    chipV: TINTA,
    nombre: TINTA,
    // contenido
    textoAcento: '#8F6410', // subtítulo y enlace
    panel: 'rgba(251,238,212,0.48)',
    panelBorde: 'rgba(232,160,25,0.28)',
    panelSombra: '0px 18px 44px rgba(232,160,25,0.22)',
    label: 'rgba(38,32,25,0.72)',
    input: c.surface,
    inputBorde: 'rgba(232,160,25,0.30)',
    inputTexto: TINTA,
    foco: ORO,
    focoSombra: '0px 0px 0px 3px rgba(232,160,25,0.16), 0px 4px 14px rgba(232,160,25,0.20)',
    boton: GRAFITO,
    botonTexto: c.bg,
    botonSombra: '0px 10px 24px rgba(38,32,25,0.28)',
    destello: ORO,
    destelloOp: 0.38,
    hint: 'rgba(38,32,25,0.35)',
    errorFondo: paletas.dia.dangerSoft,
    errorTexto: paletas.dia.danger,
  },
  noche: {
    fondo: marca.indigo, // #1A1F3D
    barraEstado: 'light-content',
    // escena: noche de luna
    cielo: marca.luna,
    cieloOp: [0, 0.05, 0.12],
    astro: marca.luna, // luna llena saliendo
    astroOp: [0.98, 0.8],
    crater: '#C9D0DF',
    glow: marca.luna,
    glowOp: [0.3, 0.07],
    suelo: '#0D1028',
    sueloOp: 0.45,
    duna: '#262C55',
    dunaOp: 0.7,
    trazoDuna: marca.arena,
    silueta: '#0D1028',
    ventanas: marca.arena, // vitrinas encendidas de noche
    ventanasOp: 0.7,
    telaAcento: marca.terracota,
    particula: marca.luna,
    estrella: marca.luna,
    // cenefa
    cenefaA: marca.terracota,
    cenefaB: marca.arena,
    // marca
    chip: marca.arena,
    chipSombra: '0px 6px 16px rgba(230,235,244,0.22)',
    chipBarra: marca.terracota,
    chipV: marca.indigo,
    nombre: marca.arena,
    // contenido
    textoAcento: '#EE7F57', // terracota aclarado: legible sobre índigo
    panel: 'rgba(247,235,216,0.06)',
    panelBorde: 'rgba(230,235,244,0.16)',
    panelSombra: '0px 18px 44px rgba(5,7,20,0.45)',
    label: 'rgba(247,235,216,0.72)',
    input: '#141833',
    inputBorde: 'rgba(230,235,244,0.18)',
    inputTexto: marca.arena,
    foco: marca.luna,
    focoSombra: '0px 0px 0px 3px rgba(230,235,244,0.14), 0px 4px 14px rgba(230,235,244,0.12)',
    boton: marca.arena,
    botonTexto: marca.indigo,
    botonSombra: '0px 10px 24px rgba(5,7,20,0.45)',
    destello: marca.terracota,
    destelloOp: 0.3,
    hint: 'rgba(247,235,216,0.35)',
    errorFondo: paletas.noche.dangerSoft,
    errorTexto: paletas.noche.danger,
  },
};
type Paleta = (typeof PALETA)[ModoVitrina];

const DISENO_W = 396;
const DISENO_H = 812;
const HORIZONTE = 640; // línea del horizonte en el diseño

// Curvas CSS equivalentes.
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const RESORTE = Easing.bezier(0.2, 0.9, 0.3, 1.15);

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Arena llevada por el viento (posición, tamaño, duración y retardo del diseño).
const ARENA = [
  { x: -30, y: 180, s: 3, dur: 15000, delay: 0 },
  { x: -50, y: 300, s: 2.5, dur: 19000, delay: 2500 },
  { x: -20, y: 420, s: 4, dur: 14000, delay: 5000 },
  { x: -60, y: 520, s: 3, dur: 21000, delay: 1200 },
  { x: -35, y: 620, s: 2.5, dur: 17000, delay: 7000 },
  { x: -45, y: 100, s: 2.5, dur: 22000, delay: 9000 },
  { x: -25, y: 700, s: 3, dur: 16000, delay: 3800 },
  { x: -55, y: 250, s: 3.5, dur: 18000, delay: 11000 },
];

// Telas colgadas del riel del almacén. `puntas` = clip-path del diseño (en %).
// `acento`: la tela de color (ámbar de día, terracota de noche); el resto va en silueta.
const TELAS = [
  { left: 30, w: 30, h: 74, acento: false, op: 0.82, dur: 5600, delay: 0, puntas: [[100, 82], [78, 100], [40, 88], [0, 96]] },
  { left: 66, w: 22, h: 54, acento: true, op: 0.65, dur: 4600, delay: 800, puntas: [[100, 88], [55, 100], [0, 90]] },
  { right: 34, w: 28, h: 66, acento: false, op: 0.82, dur: 6400, delay: 1600, puntas: [[100, 90], [60, 100], [22, 86], [0, 94]] },
  { right: 70, w: 20, h: 46, acento: false, op: 0.5, dur: 5000, delay: 2400, puntas: [[100, 86], [45, 100], [0, 92]] },
];

// Estrellas que titilan (solo de noche), en coordenadas del diseño.
const ESTRELLAS = [
  { x: 112, y: 28, s: 2, dur: 3200, delay: 0 },
  { x: 158, y: 58, s: 1.5, dur: 2600, delay: 900 },
  { x: 204, y: 20, s: 2.5, dur: 3800, delay: 400 },
  { x: 248, y: 46, s: 1.5, dur: 2900, delay: 1600 },
  { x: 284, y: 24, s: 2, dur: 3400, delay: 2200 },
  { x: 132, y: 92, s: 1.5, dur: 3000, delay: 1200 },
  { x: 272, y: 96, s: 1.5, dur: 2700, delay: 300 },
  { x: 18, y: 150, s: 2, dur: 3600, delay: 1900 },
  { x: 378, y: 160, s: 1.5, dur: 3100, delay: 700 },
  { x: 12, y: 360, s: 1.5, dur: 2800, delay: 2500 },
  { x: 384, y: 420, s: 2, dur: 3300, delay: 1400 },
];

// Largo exacto del zigzag kanaasü (20 tramos de 16×16) para strokeDash.
const CENEFA_LARGO = 20 * Math.hypot(16, 16);

// ── Cenefa kanaasü: dos zigzags que forman rombos y se tejen solos ──
function CenefaKanaasu({ p, progresoA, progresoB }: { p: Paleta; progresoA: Animated.Value; progresoB: Animated.Value }) {
  const zigzagAbajo =
    'M0 20 L16 4 L32 20 L48 4 L64 20 L80 4 L96 20 L112 4 L128 20 L144 4 L160 20 L176 4 L192 20 L208 4 L224 20 L240 4 L256 20 L272 4 L288 20 L304 4 L320 20';
  const zigzagArriba =
    'M0 4 L16 20 L32 4 L48 20 L64 4 L80 20 L96 4 L112 20 L128 4 L144 20 L160 4 L176 20 L192 4 L208 20 L224 4 L240 20 L256 4 L272 20 L288 4 L304 20 L320 4';
  const offA = progresoA.interpolate({ inputRange: [0, 1], outputRange: [CENEFA_LARGO, 0] });
  const offB = progresoB.interpolate({ inputRange: [0, 1], outputRange: [CENEFA_LARGO, 0] });
  return (
    <Svg width="100%" height={24} viewBox="0 0 320 24" preserveAspectRatio="none">
      <AnimatedPath
        d={zigzagAbajo}
        stroke={p.cenefaA}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeDasharray={[CENEFA_LARGO, CENEFA_LARGO]}
        strokeDashoffset={offA}
        fill="none"
      />
      <AnimatedPath
        d={zigzagArriba}
        stroke={p.cenefaB}
        strokeWidth={1.4}
        strokeLinejoin="round"
        opacity={0.45}
        strokeDasharray={[CENEFA_LARGO, CENEFA_LARGO]}
        strokeDashoffset={offB}
        fill="none"
      />
    </Svg>
  );
}

// ── Cielo que se aclara hacia el horizonte (va debajo del glow y del skyline) ──
function Cielo({ p, w, hz }: { p: Paleta; w: number; hz: number }) {
  return (
    <Svg width={w} height={340} style={{ position: 'absolute', left: 0, top: hz - 340 }}>
      <Defs>
        <GradLineal id="cielo" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.cielo} stopOpacity={p.cieloOp[0]} />
          <Stop offset="0.55" stopColor={p.cielo} stopOpacity={p.cieloOp[1]} />
          <Stop offset="1" stopColor={p.cielo} stopOpacity={p.cieloOp[2]} />
        </GradLineal>
      </Defs>
      <Rect x={0} y={0} width={w} height={340} fill="url(#cielo)" />
    </Svg>
  );
}

// ── Escena estática: sol (o luna), desierto y skyline maicaero ──
function EscenaMaicao({ p, w, h, hz, sx }: { p: Paleta; w: number; h: number; hz: number; sx: number }) {
  const X = (v: number) => v * sx;
  const astro = X(130);
  const centro = X(216); // fachadas centro-derecha
  const minarete = X(316);
  const cardon = X(150);
  const cardon2 = X(368);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <GradLineal id="astro" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.astro} stopOpacity={p.astroOp[0]} />
          <Stop offset="1" stopColor={p.astro} stopOpacity={p.astroOp[1]} />
        </GradLineal>
      </Defs>

      {/* sol bajo, medio puesto (de noche, luna llena saliendo) */}
      <Circle cx={astro} cy={hz} r={46} fill="url(#astro)" />
      {p.crater ? (
        <G fill={p.crater} opacity={0.6}>
          <Circle cx={astro - 16} cy={hz - 22} r={7} />
          <Circle cx={astro + 14} cy={hz - 30} r={4} />
          <Circle cx={astro + 20} cy={hz - 10} r={5.5} />
          <Circle cx={astro - 2} cy={hz - 8} r={3} />
        </G>
      ) : null}

      {/* desierto: suelo y dunas */}
      <Rect x={0} y={hz} width={w} height={h - hz} fill={p.suelo} opacity={p.sueloOp} />
      <Path d={`M0 ${hz} Q ${X(120)} ${hz - 14} ${X(240)} ${hz} T ${w} ${hz} L${w} ${h} L0 ${h} Z`} fill={p.duna} opacity={p.dunaOp} />
      <Path d={`M0 ${hz + 50} Q ${X(150)} ${hz + 36} ${X(300)} ${hz + 50} T ${w} ${hz + 48}`} stroke={p.trazoDuna} strokeWidth={1} opacity={0.08} />
      <Path d={`M${X(40)} ${hz + 90} Q ${X(180)} ${hz + 78} ${X(340)} ${hz + 90}`} stroke={p.trazoDuna} strokeWidth={1} opacity={0.06} />

      {/* skyline maicaero en silueta: fachadas comerciales, minarete, cardones */}
      <G fill={p.silueta}>
        {/* fachadas comerciales (izquierda) */}
        <Rect x={-4} y={hz - 48} width={46} height={48} />
        <Rect x={42} y={hz - 36} width={38} height={36} />
        <Rect x={80} y={hz - 44} width={12} height={44} />
        {/* toldos de almacén */}
        <Polygon points={`42,${hz - 36} 80,${hz - 36} 76,${hz - 44} 46,${hz - 44}`} />
        {/* fachadas (centro-derecha) */}
        <Rect x={centro} y={hz - 40} width={44} height={40} />
        <Polygon points={`${centro},${hz - 40} ${centro + 44},${hz - 40} ${centro + 39},${hz - 49} ${centro + 5},${hz - 49}`} />
        <Rect x={centro + 44} y={hz - 32} width={30} height={32} />
        {/* minarete de la mezquita Omar Ibn Al-Jattab */}
        <Rect x={minarete} y={hz - 56} width={16} height={56} />
        <Rect x={minarete - 5} y={hz - 42} width={26} height={6} rx={2} />
        <Path d={`M${minarete} ${hz - 56} Q ${minarete + 8} ${hz - 70} ${minarete + 16} ${hz - 56} Z`} />
        <Circle cx={minarete + 8} cy={hz - 74} r={2} />
        {/* cardones del desierto */}
        <Rect x={cardon} y={hz - 54} width={9} height={54} rx={4.5} />
        <Rect x={cardon - 9} y={hz - 44} width={7} height={22} rx={3.5} />
        <Rect x={cardon - 6} y={hz - 26} width={8} height={5} />
        <Rect x={cardon + 11} y={hz - 50} width={7} height={26} rx={3.5} />
        <Rect x={cardon + 7} y={hz - 28} width={8} height={5} />
        <Rect x={cardon2} y={hz - 34} width={8} height={34} rx={4} />
        <Rect x={cardon2 - 7} y={hz - 26} width={6} height={16} rx={3} />
        <Rect x={cardon2 - 5} y={hz - 14} width={7} height={4} />
      </G>
      {/* ventanas y vitrinas encendidas */}
      <G fill={p.ventanas} opacity={p.ventanasOp}>
        <Rect x={8} y={hz - 34} width={8} height={10} rx={1} />
        <Rect x={24} y={hz - 34} width={8} height={10} rx={1} />
        <Rect x={52} y={hz - 28} width={18} height={14} rx={1.5} />
        <Rect x={centro + 10} y={hz - 30} width={10} height={12} rx={1} />
        <Rect x={centro + 28} y={hz - 30} width={10} height={12} rx={1} />
        <Rect x={centro + 50} y={hz - 24} width={8} height={10} rx={1} />
        <Rect x={minarete + 5} y={hz - 32} width={6} height={9} rx={1} />
      </G>
    </Svg>
  );
}

// ── Glow del sol (o la luna) que respira ──────────────────────
function GlowAstro({ p }: { p: Paleta }) {
  return (
    <Svg width={340} height={340}>
      <Defs>
        <GradRadial id="glowAstro" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={p.glow} stopOpacity={p.glowOp[0]} />
          <Stop offset="0.62" stopColor={p.glow} stopOpacity={p.glowOp[1]} />
          <Stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </GradRadial>
      </Defs>
      <Rect x={0} y={0} width={340} height={340} fill="url(#glowAstro)" />
    </Svg>
  );
}

// ── Tela colgada: rectángulo con las puntas irregulares del diseño ──
function Tela({ w, h, color, puntas }: { w: number; h: number; color: string; puntas: number[][] }) {
  const pts = [[0, 0], [100, 0], ...puntas].map(([px, py]) => `${(px / 100) * w},${(py / 100) * h}`).join(' ');
  return (
    <Svg width={w} height={h}>
      <Polygon points={pts} fill={color} />
    </Svg>
  );
}

// ── Marca: chip con la «V» + nombre «Vitrina» (Sora 800) ──
function Marca({ p }: { p: Paleta }) {
  return (
    <View style={styles.marcaFila}>
      <View style={[styles.marcaChip, { backgroundColor: p.chip, boxShadow: p.chipSombra }]}>
        <View style={[styles.marcaBarra, { backgroundColor: p.chipBarra }]} />
        <Text style={[styles.marcaV, { color: p.chipV }]}>V</Text>
      </View>
      <Text style={[styles.marcaNombre, { color: p.nombre }]}>Vitrina</Text>
    </View>
  );
}

export default function LoginScreen({ navigation }: Props) {
  const { entrar: guardarSesion } = useAuth();
  const insets = useSafeAreaInsets();
  const modo = useModoVitrina();
  const p = PALETA[modo];
  const e = ESTILOS[modo];
  // Prellenado con el usuario demo para probar rápido.
  const [email, setEmail] = useState('comerciante@demo.co');
  const [password, setPassword] = useState('password123');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});
  // Tamaño de la pantalla. La escena guarda el alto completo: al abrir el
  // teclado la pantalla se encoge y el skyline queda oculto debajo (como en
  // el diseño), en vez de subir.
  const [lienzo, setLienzo] = useState<{ w: number; h: number } | null>(null);

  function medir(ev: LayoutChangeEvent) {
    const { width, height } = ev.nativeEvent.layout;
    setLienzo(prev => (prev && prev.w === width && prev.h >= height ? prev : { w: width, h: height }));
  }

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  // Todos los valores animados viven en un ref: cero re-renders por frame.
  const anim = useRef({
    logoBaja: new Animated.Value(0),
    logoAsienta: new Animated.Value(0),
    // tarjeta, campos, botón, enlaces
    bloques: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    astro: new Animated.Value(0),
    destello: new Animated.Value(0),
    escena: new Animated.Value(1),
    arena: ARENA.map(() => new Animated.Value(0)),
    telas: TELAS.map(() => new Animated.Value(0)),
    estrellas: ESTRELLAS.map(() => new Animated.Value(0)),
    cenefaA: new Animated.Value(0),
    cenefaB: new Animated.Value(0),
    focoEmail: new Animated.Value(0),
    focoPass: new Animated.Value(0),
  }).current;

  // Entrada + animaciones en bucle (el retardo de cada una solo aplica al
  // arrancar, igual que animation-delay en CSS).
  useEffect(() => {
    const vaiven = (v: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: dur / 2, easing: EASE_IN_OUT, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: dur / 2, easing: EASE_IN_OUT, useNativeDriver: true }),
        ]),
      );
    const animaciones = [
      // Logo baja con rebote: -46 → +6 (60%) → 0, en 0.8s.
      Animated.sequence([
        Animated.timing(anim.logoBaja, { toValue: 1, duration: 480, easing: RESORTE, useNativeDriver: true }),
        Animated.timing(anim.logoAsienta, { toValue: 1, duration: 320, easing: RESORTE, useNativeDriver: true }),
      ]),
      // Bloques suben: tarjeta (0.55s, +0.18s), campos (+0.30s), botón (+0.42s), enlaces (+0.52s).
      Animated.parallel(
        [
          { dur: 550, delay: 180 },
          { dur: 500, delay: 300 },
          { dur: 500, delay: 420 },
          { dur: 500, delay: 520 },
        ].map((b, i) =>
          Animated.timing(anim.bloques[i], { toValue: 1, duration: b.dur, delay: b.delay, easing: EASE_OUT, useNativeDriver: true }),
        ),
      ),
      // Cenefa que se teje (strokeDashoffset es prop de SVG: sin native driver).
      Animated.timing(anim.cenefaA, { toValue: 1, duration: 2400, delay: 500, easing: EASE_OUT, useNativeDriver: false }),
      Animated.timing(anim.cenefaB, { toValue: 1, duration: 2400, delay: 1000, easing: EASE_OUT, useNativeDriver: false }),
      // El sol (o la luna) respira: 4.2s por ciclo.
      vaiven(anim.astro, 4200),
      // Destello del botón: cruza en el 24% de 4.6s y espera el resto.
      Animated.sequence([
        Animated.delay(1400),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim.destello, { toValue: 1, duration: 1104, easing: EASE_IN_OUT, useNativeDriver: true }),
            Animated.delay(3496),
          ]),
        ),
      ]),
      // Arena en el viento (diagonal, lineal).
      ...anim.arena.map((v, i) =>
        Animated.sequence([
          Animated.delay(ARENA[i].delay),
          Animated.loop(Animated.timing(v, { toValue: 1, duration: ARENA[i].dur, easing: Easing.linear, useNativeDriver: true })),
        ]),
      ),
      // Telas ondeando (vaivén).
      ...anim.telas.map((v, i) => Animated.sequence([Animated.delay(TELAS[i].delay), vaiven(v, TELAS[i].dur)])),
      // Estrellas titilando (solo se dibujan de noche).
      ...anim.estrellas.map((v, i) => Animated.sequence([Animated.delay(ESTRELLAS[i].delay), vaiven(v, ESTRELLAS[i].dur)])),
    ];
    animaciones.forEach(a => a.start());
    return () => animaciones.forEach(a => a.stop());
  }, [anim]);

  // Con el teclado abierto la escena se atenúa (0.3s).
  useEffect(() => {
    const atenuar = (valor: number) =>
      Animated.timing(anim.escena, { toValue: valor, duration: 300, easing: EASE, useNativeDriver: true }).start();
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => atenuar(0.3));
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => atenuar(1));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, [anim]);

  function enfocar(v: Animated.Value, encendido: boolean) {
    Animated.timing(v, { toValue: encendido ? 1 : 0, duration: 180, easing: EASE, useNativeDriver: true }).start();
  }

  async function entrar() {
    setError(null);
    setErrores({});
    const nuevosErrores: FieldErrors = {};
    if (!email.trim()) nuevosErrores.email = 'El campo correo es obligatorio.';
    if (!password) nuevosErrores.password = 'El campo contrasena es obligatorio.';
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setCargando(true);
    try {
      const { token, user } = await login(email.trim(), password);
      guardarSesion(token, user);
    } catch (err) {
      const campos = fieldErrorsFromError(err);
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        setError(messageFromError(err));
      }
    } finally {
      setCargando(false);
    }
  }

  const w = lienzo?.w ?? DISENO_W;
  const h = lienzo?.h ?? DISENO_H;
  const sx = w / DISENO_W;
  const sy = h / DISENO_H;
  const hz = HORIZONTE * sy;
  const estrella = p.estrella;

  const logoTy = Animated.add(
    anim.logoBaja.interpolate({ inputRange: [0, 1], outputRange: [-46, 6] }),
    anim.logoAsienta.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
  );
  const logoOp = anim.logoBaja.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const astroOp = anim.astro.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const astroEsc = anim.astro.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const destelloTx = anim.destello.interpolate({ inputRange: [0, 1], outputRange: [-90, 340 * sx] });
  const bloque = (i: number) => ({
    opacity: anim.bloques[i],
    transform: [{ translateY: anim.bloques[i].interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  });

  return (
    <View style={[styles.raiz, { paddingTop: insets.top, backgroundColor: p.fondo }]}>
      <StatusBar barStyle={p.barraEstado} backgroundColor={p.fondo} />
      <View style={styles.pantalla} onLayout={medir}>
        {/* ══ Escena: atardecer (o noche) en Maicao; se atenúa con el teclado ══ */}
        {lienzo ? (
          <Animated.View pointerEvents="none" style={[styles.escena, { height: h, opacity: anim.escena }]}>
            <Cielo p={p} w={w} hz={hz} />

            {/* estrellas que titilan (solo de noche) */}
            {estrella
              ? ESTRELLAS.map((st, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.punto,
                      {
                        left: st.x * sx,
                        top: st.y * sy,
                        width: st.s,
                        height: st.s,
                        borderRadius: st.s / 2,
                        backgroundColor: estrella,
                        opacity: anim.estrellas[i].interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }),
                      },
                    ]}
                  />
                ))
              : null}

            {/* glow del sol (o la luna) que respira */}
            <View style={{ position: 'absolute', left: 130 * sx - 170, top: hz - 170, opacity: 0.85 }}>
              <Animated.View style={{ opacity: astroOp, transform: [{ scale: astroEsc }] }}>
                <GlowAstro p={p} />
              </Animated.View>
            </View>

            <EscenaMaicao p={p} w={w} h={h} hz={hz} sx={sx} />

            {/* telas de almacén colgadas, mecidas por el viento */}
            <View style={[styles.riel, { backgroundColor: p.silueta }]} />
            {TELAS.map((t, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  top: 6,
                  left: t.left,
                  right: t.right,
                  opacity: t.op,
                  transformOrigin: '50% 0%',
                  transform: [
                    { rotate: anim.telas[i].interpolate({ inputRange: [0, 1], outputRange: ['-2.2deg', '2.2deg'] }) },
                    { skewX: anim.telas[i].interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) },
                  ],
                }}>
                <Tela w={t.w} h={t.h} color={t.acento ? p.telaAcento : p.silueta} puntas={t.puntas} />
              </Animated.View>
            ))}

            {/* arena dorada (de noche, polvo plateado) llevada por el viento */}
            {ARENA.map((m, i) => {
              const v = anim.arena[i];
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.punto,
                    {
                      left: m.x,
                      top: m.y * sy,
                      width: m.s,
                      height: m.s,
                      borderRadius: m.s / 2,
                      backgroundColor: p.particula,
                      opacity: v.interpolate({ inputRange: [0, 0.08, 0.78, 1], outputRange: [0, 0.8, 0.35, 0] }),
                      transform: [
                        { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 470 * sx] }) },
                        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 130] }) },
                      ],
                    },
                  ]}
                />
              );
            })}
          </Animated.View>
        ) : null}

        {/* ══ Contenido ══ */}
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.contenido}>
            {/* marca, bajando con rebote */}
            <Animated.View style={[styles.marca, { opacity: logoOp, transform: [{ translateY: logoTy }] }]}>
              <Marca p={p} />
              <Text style={[styles.subtitulo, e.textoAcento]}>Desde la vitrina comercial de Colombia</Text>
            </Animated.View>

            {/* tarjeta enmarcada por la cenefa kanaasü */}
            <Animated.View style={[styles.panel, e.panel, bloque(0)]}>
              {/* cenefa Wayuu que se teje a sí misma */}
              <View style={styles.cenefa}>
                <CenefaKanaasu p={p} progresoA={anim.cenefaA} progresoB={anim.cenefaB} />
              </View>

              {error ? <Text style={[styles.error, e.error]}>{error}</Text> : null}

              <Animated.View style={bloque(1)}>
                <Text style={[styles.label, e.label]}>CORREO</Text>
                <View style={styles.inputWrapEmail}>
                  <TextInput
                    style={[styles.input, e.input]}
                    cursorColor={p.inputTexto}
                    value={email}
                    onChangeText={valor => {
                      setEmail(valor);
                      limpiarError('email');
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!cargando}
                    onFocus={() => enfocar(anim.focoEmail, true)}
                    onBlur={() => enfocar(anim.focoEmail, false)}
                  />
                  <Animated.View pointerEvents="none" style={[styles.inputFoco, e.inputFoco, { opacity: anim.focoEmail }]} />
                </View>
                <FieldError mensaje={errores.email} />

                <Text style={[styles.label, e.label]}>CONTRASEÑA</Text>
                <View style={styles.inputWrapPass}>
                  <TextInput
                    style={[styles.input, e.input]}
                    cursorColor={p.inputTexto}
                    value={password}
                    onChangeText={valor => {
                      setPassword(valor);
                      limpiarError('password');
                    }}
                    secureTextEntry
                    editable={!cargando}
                    onFocus={() => enfocar(anim.focoPass, true)}
                    onBlur={() => enfocar(anim.focoPass, false)}
                  />
                  <Animated.View pointerEvents="none" style={[styles.inputFoco, e.inputFoco, { opacity: anim.focoPass }]} />
                </View>
                <FieldError mensaje={errores.password} />
              </Animated.View>

              <Animated.View style={bloque(2)}>
                <PressableScale
                  style={[styles.boton, e.boton, cargando && styles.botonDisabled]}
                  scaleTo={0.97}
                  onPress={entrar}
                  disabled={cargando}>
                  <View style={styles.botonInterior}>
                    {cargando ? (
                      <ActivityIndicator size="small" color={p.botonTexto} style={styles.botonCargando} />
                    ) : (
                      <Text style={[styles.botonTexto, e.botonTexto]}>Entrar</Text>
                    )}
                    {/* destello que recorre el botón */}
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.destello, { transform: [{ translateX: destelloTx }, { skewX: '-18deg' }] }]}>
                      <Svg width={70} height="100%" viewBox="0 0 70 1" preserveAspectRatio="none">
                        <Defs>
                          <GradLineal id="destelloMaicao" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={p.destello} stopOpacity="0" />
                            <Stop offset="0.5" stopColor={p.destello} stopOpacity={p.destelloOp} />
                            <Stop offset="1" stopColor={p.destello} stopOpacity="0" />
                          </GradLineal>
                        </Defs>
                        <Rect x={0} y={0} width={70} height={1} fill="url(#destelloMaicao)" />
                      </Svg>
                    </Animated.View>
                  </View>
                </PressableScale>
              </Animated.View>

              <Animated.View style={bloque(3)}>
                <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={cargando}>
                  <Text style={[styles.registro, e.textoAcento]}>¿No tienes cuenta? Regístrate</Text>
                </TouchableOpacity>
                <Text style={[styles.hint, e.hint]}>Demo · comerciante@demo.co · password123</Text>
              </Animated.View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  pantalla: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  escena: { position: 'absolute', left: 0, right: 0, top: 0 },
  punto: { position: 'absolute' },
  riel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 8,
    opacity: 0.9,
  },
  contenido: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 170, // deja respirar el skyline bajo la tarjeta
  },
  marca: { alignItems: 'center', marginBottom: 20 },
  marcaFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marcaChip: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaBarra: { width: 16, height: 3, borderRadius: 2, marginBottom: 1 },
  marcaV: {
    fontFamily: font.displayExtra,
    fontSize: 19,
    lineHeight: 19,
    includeFontPadding: false,
  },
  marcaNombre: {
    fontFamily: font.displayExtra,
    fontSize: 27,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  subtitulo: {
    marginTop: 9,
    fontFamily: font.medium,
    fontSize: 13.5,
    letterSpacing: 0.4,
  },
  // Cristal translúcido de la vitrina (colores por modo en crearEstilos).
  panel: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
  },
  cenefa: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontFamily: font.bold,
    letterSpacing: 1.3,
    marginBottom: 6,
  },
  inputWrapEmail: { marginBottom: 14 },
  inputWrapPass: { marginBottom: 18 },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 15,
    fontFamily: font.regular,
  },
  // Foco: borde de acento + anillo de 3px + resplandor (box-shadow del diseño).
  inputFoco: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 12,
  },
  boton: { borderRadius: 12 },
  botonInterior: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    overflow: 'hidden',
  },
  botonDisabled: { opacity: 0.7 },
  botonTexto: {
    fontFamily: font.bold,
    fontSize: 15.5,
    lineHeight: 19,
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  botonCargando: { height: 19 },
  destello: { position: 'absolute', top: -8, bottom: -8, left: 0, width: 70 },
  error: {
    fontFamily: font.medium,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: 16,
    fontSize: 13,
  },
  registro: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 16,
    fontFamily: font.semibold,
  },
  hint: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 10,
    fontFamily: font.regular,
  },
});

/** Estilos que dependen del modo (día/noche), creados una sola vez. */
function crearEstilos(p: Paleta) {
  return StyleSheet.create({
    textoAcento: { color: p.textoAcento },
    panel: { backgroundColor: p.panel, borderColor: p.panelBorde, boxShadow: p.panelSombra },
    label: { color: p.label },
    input: { backgroundColor: p.input, borderColor: p.inputBorde, color: p.inputTexto },
    inputFoco: { borderColor: p.foco, boxShadow: p.focoSombra },
    boton: { backgroundColor: p.boton, boxShadow: p.botonSombra },
    botonTexto: { color: p.botonTexto },
    hint: { color: p.hint },
    error: { backgroundColor: p.errorFondo, color: p.errorTexto },
  });
}

const ESTILOS: Record<ModoVitrina, ReturnType<typeof crearEstilos>> = {
  dia: crearEstilos(PALETA.dia),
  noche: crearEstilos(PALETA.noche),
};
