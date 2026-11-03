/**
 * Piezas del mapa de Vitrina (Google Maps en Android, Apple Maps en iOS).
 *
 *  - <MapaVitrina>: el mapa con el estilo del modo (día/noche), centrado en
 *    Maicao por defecto.
 *  - <PinNegocio> / <PinDomiciliario>: marcadores con el look de la app.
 *  - abrirComoLlegar(): abre la ruta en la app de Google Maps (gratis: no
 *    usa la API de rutas, solo un enlace).
 *  - haceCuanto(): "ahora mismo" / "hace 40 s" / "hace 2 min".
 */
import React, { Ref, useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Text, View } from 'react-native';
import MapView, { MapStyleElement, MapViewProps, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Coordenadas, imagenUrl, UbicacionEnVivo } from '../api';
import { Colores, font, makeStyles, paletas, radius, useTheme } from '../theme';
import Icon from './Icon';

/** Centro de Maicao, con el casco urbano a la vista. */
export const MAICAO: Region = {
  latitude: 11.3826,
  longitude: -72.2432,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/** Región ajustada a un punto (zoom de barrio). */
export function regionDe(p: Coordenadas, delta = 0.008): Region {
  return { latitude: p.lat, longitude: p.lng, latitudeDelta: delta, longitudeDelta: delta };
}

/** Sin los negocios de Google: que resalten los de Vitrina. */
const SIN_NEGOCIOS_DE_GOOGLE: MapStyleElement[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

/** Estilo nocturno con la paleta índigo/arena del kit de marca. */
function estiloNoche(c: Colores): MapStyleElement[] {
  return [
    ...SIN_NEGOCIOS_DE_GOOGLE,
    { elementType: 'geometry', stylers: [{ color: c.bg }] },
    { elementType: 'labels.text.fill', stylers: [{ color: c.muted }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: c.header }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: c.border }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: c.surface }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1E2A45' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: c.surface2 }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: c.header }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: c.borderStrong }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: c.text }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: c.surface }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: c.header }] },
  ];
}

const ESTILOS = { dia: SIN_NEGOCIOS_DE_GOOGLE, noche: estiloNoche(paletas.noche) };

type MapaProps = MapViewProps & { ref?: Ref<MapView> };

/** El mapa con el estilo del modo vigente; por defecto, Maicao. */
export function MapaVitrina({ ref, ...props }: MapaProps) {
  const { modo } = useTheme();
  return (
    <MapView
      ref={ref}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      customMapStyle={ESTILOS[modo]}
      userInterfaceStyle={modo === 'noche' ? 'dark' : 'light'}
      initialRegion={MAICAO}
      toolbarEnabled={false}
      showsMyLocationButton={false}
      {...props}
    />
  );
}

/**
 * En Android el marcador personalizado es una "foto" de la vista: se vuelve a
 * tomar un momento cada vez que cambia algo (selección, modo, la imagen cargó).
 */
function useRedibujar(...deps: unknown[]): boolean {
  const [redibujar, setRedibujar] = useState(true);
  useEffect(() => {
    setRedibujar(true);
    const t = setTimeout(() => setRedibujar(false), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return redibujar;
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
  const { c, modo } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(imagen);
  const [cargada, setCargada] = useState(false);
  const redibujar = useRedibujar(seleccionado, modo, abierto, cargada, uri);
  const color = seleccionado ? c.accent : abierto ? c.brand : c.mutedSoft;

  return (
    <Marker
      coordinate={{ latitude: punto.lat, longitude: punto.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={redibujar}
      zIndex={seleccionado ? 10 : abierto ? 2 : 1}
      onPress={onPress}
      accessibilityLabel={nombre}>
      <View style={styles.pin}>
        <View style={[styles.gota, seleccionado && styles.gotaGrande, { borderColor: color }]}>
          {uri ? (
            <Image
              source={{ uri }}
              style={[styles.foto, !abierto && styles.fotoCerrado]}
              onLoadEnd={() => setCargada(true)}
            />
          ) : (
            <Icon name="tienda" size={seleccionado ? 22 : 18} color={color} />
          )}
        </View>
        <View style={[styles.punta, { borderTopColor: color }]} />
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
  const { c, modo } = useTheme();
  const styles = useStyles();
  const redibujar = useRedibujar(modo, apagado);

  return (
    <Marker
      coordinate={{ latitude: punto.lat, longitude: punto.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={redibujar}
      zIndex={20}
      onPress={onPress}
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

/**
 * Mapa pequeño del seguimiento: el domiciliario (en vivo) y el negocio.
 * Encuadra a los dos cada vez que llega una posición nueva, hasta que la
 * persona mueve el mapa con el dedo.
 */
export function MapaSeguimiento({
  domiciliario,
  negocio,
  alto = 220,
}: {
  domiciliario?: UbicacionEnVivo | null;
  negocio?: { punto: Coordenadas; nombre: string; imagen?: string | null } | null;
  alto?: number;
}) {
  const styles = useStyles();
  const mapa = useRef<MapView>(null);
  const tocado = useRef(false);
  const puntos = [domiciliario, negocio?.punto].filter((p): p is Coordenadas => !!p);
  const clave = puntos.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  useEffect(() => {
    if (tocado.current || puntos.length === 0) return;
    if (puntos.length === 1) {
      mapa.current?.animateToRegion(regionDe(puntos[0], 0.012), 600);
    } else {
      mapa.current?.fitToCoordinates(
        puntos.map(p => ({ latitude: p.lat, longitude: p.lng })),
        { edgePadding: { top: 70, right: 60, bottom: 50, left: 60 }, animated: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const inicial = puntos[0] ? regionDe(puntos[0], 0.012) : MAICAO;

  return (
    <View style={[styles.marco, { height: alto }]}>
      <MapaVitrina
        ref={mapa}
        style={styles.lleno}
        initialRegion={inicial}
        onPanDrag={() => {
          tocado.current = true;
        }}>
        {!!negocio && <PinNegocio punto={negocio.punto} nombre={negocio.nombre} imagen={negocio.imagen} />}
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
