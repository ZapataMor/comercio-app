/**
 * Piezas del mapa de Vitrina: MapLibre con las calles de OpenStreetMap (sin
 * clave ni cuenta de Google; el estilo vive en estiloMapa.ts).
 *
 *  - <MapaVitrina>: el mapa con el estilo del modo (día/noche), centrado en
 *    Maicao por defecto. Se mueve con su ref: irA() y encuadrar().
 *  - <PinNegocio> / <PinDomiciliario>: marcadores con el look de la app.
 *  - <PinPropiedad>: el precio de una casa o un patio en una píldora.
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
import React, { ReactNode, Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Coordenadas, imagenUrl, TipoPropiedad, UbicacionEnVivo } from '../api';
import { precioCorto, tipoPropiedad } from '../propiedades';
import { Colores, font, makeStyles, radius, useTheme } from '../theme';
import { distanciaMetros } from '../ubicacion';
import { PressableScale } from './anim';
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

/** Marcador del punto de entrega (o de la casa del cliente): una casa en el color de acento. */
export function PinEntrega({
  punto,
  nombre = 'Punto de entrega',
  onPress,
}: {
  punto: Coordenadas;
  nombre?: string;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();

  return (
    <Marker
      lngLat={lngLat(punto)}
      anchor="bottom"
      style={styles.encima}
      onPress={onPress && alTocarPin(onPress)}
      accessibilityLabel={nombre}>
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

/** Color de cada tipo de propiedad en el mapa (legible en los dos modos). */
export function colorPropiedad(c: Colores, tipo: TipoPropiedad): string {
  return tipo === 'venta' ? c.success : tipo === 'alquiler' ? c.info : c.accent;
}

/**
 * Marcador de una propiedad: su precio corto en una píldora con el ícono y
 * el borde del color de su tipo. Seleccionada, se rellena y queda encima.
 */
export function PinPropiedad({
  punto,
  tipo,
  precio,
  nombre,
  seleccionado,
  onPress,
}: {
  punto: Coordenadas;
  tipo: TipoPropiedad;
  precio: number;
  nombre: string;
  seleccionado?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const color = colorPropiedad(c, tipo);
  const fondo = seleccionado ? c.brand : c.surface;
  const texto = seleccionado ? c.onBrand : c.textStrong;

  return (
    <Marker
      lngLat={lngLat(punto)}
      anchor="bottom"
      style={seleccionado ? styles.encima : styles.medio}
      onPress={onPress && alTocarPin(onPress)}
      accessibilityLabel={`${tipoPropiedad(tipo).texto}: ${nombre}, ${precioCorto(precio)}`}>
      <View style={styles.pin}>
        <View style={[styles.precio, { backgroundColor: fondo, borderColor: color }, seleccionado && styles.precioGrande]}>
          <Icon name={tipoPropiedad(tipo).icono} size={seleccionado ? 15 : 13} color={seleccionado ? c.onBrand : color} strokeWidth={2.2} />
          <Text style={[styles.precioTxt, { color: texto }, seleccionado && styles.precioTxtGrande]}>{precioCorto(precio)}</Text>
        </View>
        <View style={[styles.punta, { borderTopColor: color }]} />
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

/** Lo mínimo que gira el botón de refrescar, para que se note que hizo algo. */
const REFRESCO_MIN_MS = 600;

/**
 * Cuánto tarda la moto en deslizarse hasta su nueva posición: lo que tarda en
 * llegar la siguiente (el domiciliario envía cada ~2 s moviéndose), así se ve
 * avanzar seguida en vez de a saltos.
 */
const DESLIZAR_MS = 2000;
/** Un salto mayor (o la primera posición) se pone de una: deslizarlo engañaría. */
const SALTO_MAX_M = 1000;
/** La cámara se reencuadra solo cuando algo se movió esto: si no, el mapa no pararía. */
const REENCUADRAR_M = 120;

/**
 * Posición que se va deslizando hacia `destino` (en línea recta, a velocidad
 * pareja). Si llega otra antes de terminar, sigue desde donde va.
 */
export function usePuntoSuave(destino: Coordenadas | null | undefined, duracionMs = DESLIZAR_MS): Coordenadas | null {
  const [visible, setVisible] = useState<Coordenadas | null>(destino ? { lat: destino.lat, lng: destino.lng } : null);
  const actual = useRef<Coordenadas | null>(visible);
  const lat = destino?.lat;
  const lng = destino?.lng;

  useEffect(() => {
    if (lat == null || lng == null) {
      actual.current = null;
      setVisible(null);
      return;
    }
    const hasta = { lat, lng };
    const desde = actual.current;
    if (desde && desde.lat === lat && desde.lng === lng) return;
    if (!desde || distanciaMetros(desde, hasta) > SALTO_MAX_M) {
      actual.current = hasta;
      setVisible(hasta);
      return;
    }
    const inicio = Date.now();
    let cuadro: ReturnType<typeof requestAnimationFrame> | null = null;
    let pintado = 0;
    const paso = () => {
      const t = Math.min(1, (Date.now() - inicio) / duracionMs);
      const punto = { lat: desde.lat + (hasta.lat - desde.lat) * t, lng: desde.lng + (hasta.lng - desde.lng) * t };
      actual.current = punto;
      // ~30 cuadros por segundo bastan y no recargan el mapa.
      if (t === 1 || Date.now() - pintado >= 33) {
        pintado = Date.now();
        setVisible(punto);
      }
      cuadro = t < 1 ? requestAnimationFrame(paso) : null;
    };
    cuadro = requestAnimationFrame(paso);
    return () => {
      if (cuadro !== null) cancelAnimationFrame(cuadro);
    };
  }, [lat, lng, duracionMs]);

  return visible;
}

/** La moto del seguimiento, deslizándose entre posiciones (solo ella se repinta). */
function PinDomiciliarioSuave({ punto }: { punto: Coordenadas }) {
  const suave = usePuntoSuave(punto);
  return suave ? <PinDomiciliario punto={suave} /> : null;
}

/**
 * Mapa pequeño del seguimiento: el domiciliario (en vivo, deslizándose entre
 * posiciones), el negocio y, si se conoce, la puerta de la entrega. Encuadra a
 * todos cuando alguno se movió más de REENCUADRAR_M, hasta que la persona mueve
 * el mapa con el dedo.
 *
 * Con `onRefrescar` muestra un botón encima del mapa: pide la posición más
 * reciente y vuelve a encuadrar a todos (aunque la persona haya movido el mapa).
 */
export function MapaSeguimiento({
  domiciliario,
  negocio,
  entrega,
  alto = 220,
  onRefrescar,
}: {
  domiciliario?: UbicacionEnVivo | null;
  /** A dónde va el pedido. */
  entrega?: Coordenadas | null;
  negocio?: { punto: Coordenadas; nombre: string; imagen?: string | null } | null;
  alto?: number;
  onRefrescar?: () => Promise<unknown> | void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const mapa = useRef<MapaRef>(null);
  const tocado = useRef(false);
  const [refrescando, setRefrescando] = useState(false);
  const puntos = [domiciliario, negocio?.punto, entrega].filter((p): p is Coordenadas => !!p);
  const clave = puntos.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  // Tras refrescar se encuadra con los puntos nuevos, no con los de antes del toque.
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );
  // Con lo que se encuadró la última vez: ver REENCUADRAR_M.
  const encuadrados = useRef<Coordenadas[] | null>(null);

  const encuadrar = (lista: Coordenadas[]) => {
    if (lista.length === 0) return;
    encuadrados.current = lista;
    if (lista.length === 1) mapa.current?.irA(lista[0], ZOOM.zona);
    else mapa.current?.encuadrar(lista, MARGEN_SEGUIMIENTO);
  };

  useEffect(() => {
    if (tocado.current) return;
    const antes = encuadrados.current;
    const movido =
      !antes || antes.length !== puntos.length || puntos.some((p, i) => distanciaMetros(p, antes[i]) > REENCUADRAR_M);
    if (movido) encuadrar(puntos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  async function refrescar() {
    if (!onRefrescar || refrescando) return;
    setRefrescando(true);
    tocado.current = false;
    const desde = Date.now();
    try {
      await onRefrescar();
    } finally {
      const falta = REFRESCO_MIN_MS - (Date.now() - desde);
      if (falta > 0) await new Promise<void>(r => setTimeout(r, falta));
      if (montado.current) {
        setRefrescando(false);
        encuadrar(puntosRef.current);
      }
    }
  }

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
        {!!domiciliario && <PinDomiciliarioSuave punto={domiciliario} />}
      </MapaVitrina>
      {!!onRefrescar && (
        <PressableScale
          onPress={refrescar}
          disabled={refrescando}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Actualizar ubicación del domiciliario"
          accessibilityState={{ busy: refrescando }}
          style={styles.refrescar}>
          {refrescando ? (
            <ActivityIndicator size="small" color={c.accent} />
          ) : (
            <Icon name="refrescar" size={20} color={c.text} />
          )}
        </PressableScale>
      )}
    </View>
  );
}

/**
 * Nota bajo el mapa en vivo: cuándo se actualizó la posición. `vieja`: hace
 * rato no llega una nueva (sin señal o sin datos): el punto pasa a amarillo.
 */
export function NotaEnVivo({ texto, vieja = false }: { texto: string; vieja?: boolean }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.notaFila}>
      <View style={[styles.punto, { backgroundColor: vieja ? c.warning : c.success }]} />
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
  precio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 2,
    ...shadow.soft,
  },
  precioGrande: { paddingHorizontal: 12, paddingVertical: 7 },
  precioTxt: { fontFamily: font.bold, fontSize: 12 },
  precioTxtGrande: { fontSize: 14 },
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
  refrescar: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  notaFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  nota: { color: c.muted, fontSize: 12, fontFamily: font.medium },
}));
