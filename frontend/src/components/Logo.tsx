/**
 * Marca Vitrina — kit oficial «logo-vitrina» (concepto "Toldo": toldo de
 * mercado + V como puerta abierta), portado a react-native-svg para que
 * escale nítido en cualquier tamaño.
 *
 * La marca tiene dos modos que rotan según la hora local:
 *   · Día   (05:00–17:59): sol ámbar, chip Arena.
 *   · Noche (18:00–04:59): luna plateada, chip Índigo.
 *
 *   <VitrinaMark size={44} />     ← símbolo solo (elige modo por hora)
 *   <VitrinaLogo height={52} />   ← símbolo + nombre «vıtrına» (Sora Bold)
 *   <VitrinaHeaderLogo />         ← versión para el header oscuro de la app
 */
import React from 'react';
import { AppState, StyleProp, View, ViewStyle } from 'react-native';
import {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
  Svg,
  Text as SvgText,
} from 'react-native-svg';

/** Paleta oficial de la marca (README del kit). */
export const marca = {
  terracota: '#E2572B', // toldo y tildes ◆
  tinta: '#22264F', // V y nombre en modo día
  indigo: '#1A1F3D', // fondo modo noche
  arena: '#F7EBD8', // fondo modo día / trazos claros de noche
  cremaDia: '#F3E0BE', // franjas claras del toldo de día
  sol: '#F2A93B', // punto de día
  luna: '#E6EBF4', // punto de noche
} as const;

export type ModoVitrina = 'dia' | 'noche';

/** Día de 5:00 AM a 5:59 PM; noche el resto. */
export function modoPorHora(fecha: Date = new Date()): ModoVitrina {
  const hora = fecha.getHours();
  return hora >= 5 && hora < 18 ? 'dia' : 'noche';
}

/**
 * Modo vigente según la hora local. Se reprograma solo para el próximo
 * cambio (05:00 o 18:00) y se revalida al volver la app a primer plano.
 */
export function useModoVitrina(): ModoVitrina {
  const [modo, setModo] = React.useState<ModoVitrina>(modoPorHora);

  React.useEffect(() => {
    const revisar = () => setModo(modoPorHora());

    const ahora = new Date();
    const limite = new Date(ahora);
    const hora = ahora.getHours();
    if (hora < 5) {
      limite.setHours(5, 0, 0, 0);
    } else if (hora < 18) {
      limite.setHours(18, 0, 0, 0);
    } else {
      limite.setDate(limite.getDate() + 1);
      limite.setHours(5, 0, 0, 0);
    }
    const timer = setTimeout(revisar, limite.getTime() - ahora.getTime() + 1000);

    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') revisar();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [modo]);

  return modo;
}

/** Colores del símbolo según el modo (README del kit). */
export function coloresModo(modo: ModoVitrina) {
  const noche = modo === 'noche';
  return {
    crema: noche ? marca.arena : marca.cremaDia, // franjas claras del toldo
    trazoV: noche ? marca.arena : marca.tinta,
    punto: noche ? marca.luna : marca.sol, // sol de día, luna de noche
    chip: noche ? marca.indigo : marca.arena,
  };
}

/*
 * Glifos del símbolo por separado (coordenadas del SVG oficial, caja
 * 200×200). El splash los anima de forma independiente.
 */

export function ToldoGlifo({ crema }: { crema: string }) {
  return (
    <G>
      <Defs>
        <ClipPath id="toldo">
          <Path d="M42 30 L158 30 L158 72 A14.5 14.5 0 0 1 129 72 A14.5 14.5 0 0 1 100 72 A14.5 14.5 0 0 1 71 72 A14.5 14.5 0 0 1 42 72 Z" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#toldo)">
        <Rect x={42} y={30} width={29} height={60} fill={marca.terracota} />
        <Rect x={71} y={30} width={29} height={60} fill={crema} />
        <Rect x={100} y={30} width={29} height={60} fill={marca.terracota} />
        <Rect x={129} y={30} width={29} height={60} fill={crema} />
      </G>
    </G>
  );
}

export function UveGlifo({ color }: { color: string }) {
  return (
    <Path
      d="M58 108 L100 170 L142 108"
      fill="none"
      stroke={color}
      strokeWidth={24}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function PuntoGlifo({ color }: { color: string }) {
  return <Circle cx={100} cy={104} r={9} fill={color} />;
}

function Simbolo({ modo }: { modo: ModoVitrina }) {
  const col = coloresModo(modo);
  return (
    <G>
      <ToldoGlifo crema={col.crema} />
      <UveGlifo color={col.trazoV} />
      <PuntoGlifo color={col.punto} />
    </G>
  );
}

type MarkProps = {
  size?: number;
  /** Fuerza un modo; si se omite, se elige por la hora local. */
  modo?: ModoVitrina;
  /** Chip de fondo redondeado (Arena de día, Índigo de noche). */
  chip?: boolean;
};

/** Símbolo solo, como el ícono de la app. */
export function VitrinaMark({ size = 44, modo, chip = true }: MarkProps) {
  const modoHora = useModoVitrina();
  const m = modo ?? modoHora;
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {chip && (
        <Rect
          x={0}
          y={0}
          width={200}
          height={200}
          rx={44}
          fill={m === 'noche' ? marca.indigo : marca.arena}
        />
      )}
      <Simbolo modo={m} />
    </Svg>
  );
}

/**
 * Nombre «vıtrına» (Sora Bold, ı sin punto, tildes ◆ terracota) en las
 * coordenadas del vector oficial 512×160. Fragmento para incrustar en un Svg.
 */
function NombreGlifos({ color }: { color: string }) {
  return (
    <G>
      <SvgText
        x={180}
        y={119.5}
        fontFamily="Sora_700Bold"
        fontSize={100}
        letterSpacing={-1.5}
        fill={color}>
        vıtrına
      </SvgText>
      <Rect
        x={246.65}
        y={42.5}
        width={15}
        height={15}
        fill={marca.terracota}
        rotation={45}
        origin="254.15, 50"
      />
      <Rect
        x={361.07}
        y={42.5}
        width={15}
        height={15}
        fill={marca.terracota}
        rotation={45}
        origin="368.57, 50"
      />
    </G>
  );
}

/** Nombre solo, como Svg independiente (lo usa el splash animado). */
export function VitrinaNombre({
  fontSize = 44,
  color = marca.tinta,
}: {
  fontSize?: number;
  color?: string;
}) {
  // Recorte del vector oficial alrededor del texto (x 175–512, y 15–140).
  const escala = fontSize / 100;
  return (
    <Svg width={337 * escala} height={125 * escala} viewBox="175 15 337 125">
      <NombreGlifos color={color} />
    </Svg>
  );
}

type LogoProps = {
  /** Alto en px; el ancho se deriva de la proporción oficial (512:160). */
  height?: number;
  modo?: ModoVitrina;
  /**
   * Color del nombre. Por defecto tinta (para superficies claras); en fondos
   * oscuros pásale un tono claro (p. ej. marca.arena).
   */
  textColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Logo completo: símbolo sobre su chip + nombre «vıtrına» en Sora Bold con
 * las tildes ◆ terracota, según el vector oficial (caja 512×160).
 */
export function VitrinaLogo({ height = 48, modo, textColor, style }: LogoProps) {
  const modoHora = useModoVitrina();
  const m = modo ?? modoHora;
  const width = (height * 512) / 160;
  const texto = textColor ?? marca.tinta;
  return (
    <View style={style}>
      <Svg width={width} height={height} viewBox="0 0 512 160">
        {/* Chip del símbolo: mantiene el contraste día/noche en cualquier fondo. */}
        <Rect
          x={0}
          y={5}
          width={150}
          height={150}
          rx={33}
          fill={m === 'noche' ? marca.indigo : marca.arena}
        />
        <G transform="translate(0,5) scale(0.75)">
          <Simbolo modo={m} />
        </G>
        <NombreGlifos color={texto} />
      </Svg>
    </View>
  );
}

/** Logo para el header de navegación (fondo grafito oscuro). */
export function VitrinaHeaderLogo() {
  return <VitrinaLogo height={28} textColor={marca.arena} />;
}
