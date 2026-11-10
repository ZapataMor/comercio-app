/**
 * Piezas del mapa de Vitrina: MapLibre con las calles de OpenStreetMap (sin
 * clave ni cuenta de Google; el estilo vive en estiloMapa.ts).
 *
 *  - <MapaVitrina>: el mapa con el estilo del modo (día/noche), centrado en
 *    Maicao por defecto. Se mueve con su ref: irA() y encuadrar().
 *  - <PinNegocio> / <PinDomiciliario>: marcadores con el look de la app.
 *  - abrirComoLlegar(): abre la ruta en la app de Google Maps (gratis: no
 *    usa la API de rutas, solo un enlace).
 *  - haceCuanto(): "ahora mismo" / "hace 40 s" / "hace 2 min".
 */
import {
  Camera,
  CameraRef,
  LogManager,
  Map as MapaNativo,
  MapProps,
  Marker,
  NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import React, { ReactNode, Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { Image, Linking, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Coordenadas, imagenUrl, UbicacionEnVivo } from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';
import { ESTILOS_MAPA } from './estiloMapa';
import Icon from './Icon';

// Al mover el mapa se cancelan las descargas de lo que ya no se ve: no es un
// fallo y no debe salir como advertencia.
LogManager.onLog(e => e.tag === 'Mbgl-HttpRequest' && /cancel/i.test(e.message));

/** Qué se ve del mapa: el punto del centro y qué tan cerca. */
export type Vista = { centro: Coordenadas; zoom: number };

/** Niveles de zoom con nombre (MapLibre: uno menos que el de Google). */
export const ZOOM = { ciudad: 12.4, zona: 14, barrio: 15, cuadra: 16, puerta: 16.5 };

/** Centro de Maicao, con el casco urbano a la vista. */
export const MAICAO: Vista = { centro: { lat: 11.3826, lng: -72.2432 }, zoom: ZOOM.ciudad };

/** Vista centrada en un punto (por defecto, zoom de barrio). */
export function vistaDe(p: Coordenadas, zoom = ZOOM.barrio): Vista {
  return { centro: p, zoom };
}

type Margen = { top: number; right: number; bottom: number; left: number };
type Esquina = NonNullable<MapProps['attributionPosition']>;

/** Lo que las pantallas pueden pedirle al mapa. */
export type MapaRef = {
  /** Lleva el centro a un punto, con animación. */
  irA(p: Coordenadas, zoom?: number): void;
  /** Encuadra varios puntos a la vez. */
  encuadrar(puntos: Coordenadas[], margen?: Margen): void;
};

const lngLat = (p: Coordenadas): [number, number] => [p.lng, p.lat];

/** Caja [oeste, sur, este, norte] que contiene los puntos. */
function limitesDe(puntos: Coordenadas[]): [number, number, number, number] {
  const lats = puntos.map(p => p.lat);
  const lngs = puntos.map(p => p.lng);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

type MapaProps = {
  ref?: Ref<MapaRef>;
  style?: StyleProp<ViewStyle>;
  /** Dónde arranca el mapa (por defecto, Maicao). */
  vistaInicial?: Vista;
  /** Si arranca encuadrando varios puntos, en vez de vistaInicial. */
  encuadreInicial?: { puntos: Coordenadas[]; margen: Margen };
  /** Vista fija: el mapa la sigue cada vez que cambia (vista previa). */
  vista?: Vista;
  /** Sin gestos: ni mover ni acercar. */
  quieto?: boolean;
  /** Muestra el punto de la persona (ya con el permiso concedido). */
  miUbicacion?: boolean;
  /** Mapa pequeño con esquinas redondeadas: se recorta al marco. */
  recortado?: boolean;
  /** Dónde va el botón de créditos del mapa (OpenStreetMap). */
  creditos?: Esquina;
  onPress?: () => void;
  /** El mapa terminó de moverse: su nuevo centro. */
  onMover?: (centro: Coordenadas) => void;
  /** La persona empezó a mover el mapa con el dedo. */
  onArrastrar?: () => void;
  children?: ReactNode;
};

/** El mapa con el estilo del modo vigente; por defecto, Maicao. */
export function MapaVitrina({
  ref,
  style,
  vistaInicial = MAICAO,
  encuadreInicial,
  vista,
  quieto,
  miUbicacion,
  recortado,
  creditos = { bottom: 8, left: 8 },
  onPress,
  onMover,
  onArrastrar,
  children,
}: MapaProps) {
  const { modo } = useTheme();
  const camara = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    irA: (p, zoom) => camara.current?.easeTo({ center: lngLat(p), zoom, duration: 600 }),
    encuadrar: (puntos, margen) => {
      if (puntos.length === 0) return;
      camara.current?.fitBounds(limitesDe(puntos), { padding: margen, duration: 600, easing: 'ease' });
    },
  }));

  const inicial = encuadreInicial
    ? { bounds: limitesDe(encuadreInicial.puntos), padding: encuadreInicial.margen }
    : { center: lngLat(vistaInicial.centro), zoom: vistaInicial.zoom };

  return (
    <MapaNativo
      style={style}
      mapStyle={ESTILOS_MAPA[modo]}
      androidView={recortado ? 'texture' : 'surface'}
      dragPan={!quieto}
      touchZoom={!quieto}
      doubleTapZoom={!quieto}
      doubleTapHoldZoom={!quieto}
      // Siempre con el norte arriba y visto desde arriba: no hay brújula para volver.
      touchRotate={false}
      touchPitch={false}
      logo={false}
      compass={false}
      attribution
      attributionPosition={creditos}
      onPress={onPress && (() => onPress())}
      onRegionWillChange={onArrastrar && (e => e.nativeEvent.userInteraction && onArrastrar())}
      onRegionDidChange={
        onMover && (e => onMover({ lat: e.nativeEvent.center[1], lng: e.nativeEvent.center[0] }))
      }>
      <Camera
        ref={camara}
        initialViewState={inicial}
        minZoom={5}
        maxZoom={18.5}
        {...(vista ? { center: lngLat(vista.centro), zoom: vista.zoom, duration: 0 } : null)}
      />
      {miUbicacion && <NativeUserLocation />}
      {children}
    </MapaNativo>
  );
}

/**
 * El toque en un pin también le llega al mapa (el evento sube): se corta
 * aquí, o el mapa lo tomaría como un toque en vacío y quitaría la selección.
 */
function alTocarPin(onPress: () => void) {
  return (e: { stopPropagation(): void }) => {
    e.stopPropagation();
    onPress();
  };
}

type PinNegocioProps = {
  punto: Coordenadas;
  nombre: string;
  imagen?: string | null;
  abierto?: boolean;
  seleccionado?: boolean;
  onPress?: () => void;
};

/** Marcador de un negocio: su foto (o una tienda) en una gota con punta. */
export function PinNegocio({ punto, nombre, imagen, abierto = true, seleccionado, onPress }: PinNegocioProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(imagen);
  const color = seleccionado ? c.accent : abierto ? c.brand : c.mutedSoft;

  return (
    <Marker
      lngLat={lngLat(punto)}
      anchor="bottom"
      style={seleccionado ? styles.encima : abierto ? styles.medio : styles.debajo}
      onPress={onPress && alTocarPin(onPress)}
      accessibilityLabel={nombre}>
      <View style={styles.pin}>
        <View style={[styles.gota, seleccionado && styles.gotaGrande, { borderColor: color }]}>
          {uri ? (
            <Image source={{ uri }} style={[styles.foto, !abierto && styles.fotoCerrado]} />
          ) : (
            <Icon name="tienda" size={seleccionado ? 22 : 18} color={color} />
          )}
        </View>
        <View style={[styles.punta, { borderTopColor: color }]} />
      </View>
    </Marker>
  );
}

/** Marcador del punto de entrega: una casa en el color de acento. */
export function PinEntrega({ punto, nombre = 'Punto de entrega' }: { punto: Coordenadas; nombre?: string }) {
  const { c } = useTheme();
  const styles = useStyles();

  return (
    <Marker lngLat={lngLat(punto)} anchor="bottom" style={styles.encima} accessibilityLabel={nombre}>
      <View style={styles.pin}>
        <View style={[styles.gota, styles.gotaEntrega]}>
          <Icon name="casa" size={18} color={c.onAccent} />
        </View>
        <View style={[styles.punta, { borderTopColor: c.accent }]} />
      </View>
    </Marker>
  );
}

/** Marcador del domiciliario: la moto en un círculo del color de acento. */
export function PinDomiciliario({
  punto,
  nombre,
  apagado,
  onPress,
}: {
  punto: Coordenadas;
  nombre?: string;
  /** En turno pero sin entrega: más tenue. */
  apagado?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();

  return (
    <Marker
      lngLat={lngLat(punto)}
      anchor="center"
      style={styles.arribaDeTodo}
      onPress={onPress && alTocarPin(onPress)}
      accessibilityLabel={nombre ?? 'Domiciliario'}>
      <View style={[styles.moto, apagado && styles.motoApagada]}>
        <Icon name="moto" size={20} color={apagado ? c.text : c.onAccent} />
      </View>
    </Marker>
  );
}

/** "ahora mismo" / "hace 40 s" / "hace 2 min". */
export function haceCuanto(segundos: number): string {
  if (segundos < 15) return 'ahora mismo';
  if (segundos < 60) return `hace ${segundos} s`;
  return `hace ${Math.round(segundos / 60)} min`;
}

/**
 * Abre la ruta hasta `destino` en Google Maps (o en el navegador si no está
 * instalada). Con texto, Google busca la dirección por su cuenta.
 */
export function abrirComoLlegar(destino: Coordenadas | string) {
  const valor = typeof destino === 'string' ? encodeURIComponent(destino) : `${destino.lat},${destino.lng}`;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${valor}&travelmode=driving`).catch(() => {});
}

/** Aire alrededor de los pines al encuadrarlos (el de arriba mide más). */
const MARGEN_SEGUIMIENTO: Margen = { top: 70, right: 60, bottom: 50, left: 60 };

/**
 * Mapa pequeño del seguimiento: el domiciliario (en vivo), el negocio y, si
 * se conoce, la puerta de la entrega. Encuadra a todos cada vez que llega una posición nueva, hasta que la
 * persona mueve el mapa con el dedo.
 */
export function MapaSeguimiento({
  domiciliario,
  negocio,
  entrega,
  alto = 220,
}: {
  domiciliario?: UbicacionEnVivo | null;
  /** A dónde va el pedido. */
  entrega?: Coordenadas | null;
  negocio?: { punto: Coordenadas; nombre: string; imagen?: string | null } | null;
  alto?: number;
}) {
  const styles = useStyles();
  const mapa = useRef<MapaRef>(null);
  const tocado = useRef(false);
  const puntos = [domiciliario, negocio?.punto, entrega].filter((p): p is Coordenadas => !!p);
  const clave = puntos.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  useEffect(() => {
    if (tocado.current || puntos.length === 0) return;
    if (puntos.length === 1) mapa.current?.irA(puntos[0], ZOOM.zona);
    else mapa.current?.encuadrar(puntos, MARGEN_SEGUIMIENTO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return (
    <View style={[styles.marco, { height: alto }]}>
      <MapaVitrina
        ref={mapa}
        style={styles.lleno}
        recortado
        vistaInicial={puntos[0] ? vistaDe(puntos[0], ZOOM.zona) : MAICAO}
        encuadreInicial={puntos.length > 1 ? { puntos, margen: MARGEN_SEGUIMIENTO } : undefined}
        onArrastrar={() => {
          tocado.current = true;
        }}>
        {!!negocio && <PinNegocio punto={negocio.punto} nombre={negocio.nombre} imagen={negocio.imagen} />}
        {!!entrega && <PinEntrega punto={entrega} />}
        {!!domiciliario && <PinDomiciliario punto={domiciliario} />}
      </MapaVitrina>
    </View>
  );
}

/** Nota bajo el mapa en vivo: cuándo se actualizó la posición. */
export function NotaEnVivo({ texto }: { texto: string }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.notaFila}>
      <View style={[styles.punto, { backgroundColor: c.success }]} />
      <Text style={styles.nota}>{texto}</Text>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  // Qué pin tapa a cuál: cerrado < abierto < seleccionado < domiciliario.
  debajo: { zIndex: 1 },
  medio: { zIndex: 2 },
  encima: { zIndex: 10 },
  arribaDeTodo: { zIndex: 20 },
  pin: { alignItems: 'center' },
  gota: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.soft,
  },
  gotaGrande: { width: 50, height: 50, borderRadius: 25 },
  gotaEntrega: { backgroundColor: c.accent, borderColor: c.surface },
  foto: { width: '100%', height: '100%' },
  fotoCerrado: { opacity: 0.5 },
  punta: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  moto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accent,
    borderWidth: 3,
    borderColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  motoApagada: { backgroundColor: c.surface2 },
  marco: { borderRadius: radius.md, overflow: 'hidden', marginTop: 4, backgroundColor: c.surface2 },
  lleno: { flex: 1 },
  notaFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  nota: { color: c.muted, fontSize: 12, fontFamily: font.medium },
}));
