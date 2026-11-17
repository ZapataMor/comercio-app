import Geolocation from '@react-native-community/geolocation';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calcularRuta, Coordenadas, IconoPaso, ModoRuta, Ruta } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import Icon, { IconName } from '../components/Icon';
import { abrirEnGoogleMaps, MapaRef, MapaVitrina, PinEntrega, PinNegocio, vistaDe, ZOOM } from '../components/Mapa';
import { RootStackParamList } from '../navTypes';
import { estadoRuta, hayQueRecalcular, puntosDe, textoDistancia, textoMinutos } from '../ruta';
import { font, makeStyles, radius, useTheme } from '../theme';
import { miUbicacion, pedirPermisoUbicacion } from '../ubicacion';

/**
 * «Cómo llegar» sin salir de la app: la ruta por calles desde donde está la
 * persona hasta el negocio, la casa del cliente o la propiedad.
 *
 * Arriba va la próxima indicación ("En 120 m · Gira a la derecha por la
 * Carrera 15"), abajo cuánto falta. El mapa va detrás de la persona (si lo
 * mueve con el dedo deja de seguirla y aparece «Seguirme»). Si se sale del
 * camino, se pide una ruta nueva desde donde va. Google Maps queda como
 * opción por si la ruta no carga o la persona lo prefiere.
 */
type Props = NativeStackScreenProps<RootStackParamList, 'Ruta'>;

const ICONO_PASO: Record<IconoPaso, IconName> = {
  salida: 'recto',
  llegada: 'bandera',
  derecha: 'girar-derecha',
  izquierda: 'girar-izquierda',
  recto: 'recto',
  vuelta: 'vuelta-u',
  glorieta: 'glorieta',
};

/** Al cargar la ruta se ve completa este rato antes de ir detrás de la persona. */
const VER_RUTA_MS = 1800;
/** Cuánto tarda la cámara en ir a cada posición nueva (el GPS lee cada ~2 s). */
const SEGUIR_MS = 1000;
/** Más cerca que esto, la indicación es "Ahora". */
const AHORA_M = 15;

export default function RutaScreen({ route, navigation }: Props) {
  const { destino, elegirModo } = route.params;
  const { auth } = useAuth();
  const token = auth!.token;
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const mapa = useRef<MapaRef>(null);

  const [modo, setModo] = useState<ModoRuta>(route.params.modo ?? 'moto');
  const [permiso, setPermiso] = useState<'pidiendo' | 'si' | 'no'>('pidiendo');
  const [yo, setYo] = useState<Coordenadas | null>(null);
  const [sinGps, setSinGps] = useState(false);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siguiendo, setSiguiendo] = useState(true);

  const siguiendoRef = useRef(true);
  const pidiendo = useRef(false);
  const ultimaRutaAt = useRef(0);
  // Se encuadra la ruta solo la primera vez que llega (o al cambiar de modo).
  const yaEncuadro = useRef(false);
  const yaSeAcerco = useRef(false);
  const yoRef = useRef<Coordenadas | null>(null);
  yoRef.current = yo;
  // Una ruta que llega tarde de un modo que ya no está elegido se descarta.
  const modoRef = useRef(modo);
  modoRef.current = modo;
  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  // Permiso y GPS: una primera lectura rápida y luego cada ~2 s.
  const intento = useRef(0);
  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    const este = ++intento.current;
    let watchId: number | null = null;
    pedirPermisoUbicacion()
      .then(si => {
        if (!montado.current || este !== intento.current) return;
        setPermiso(si ? 'si' : 'no');
        if (!si) return;
        miUbicacion()
          .then(p => montado.current && setYo(p))
          .catch(() => montado.current && setSinGps(true));
        watchId = Geolocation.watchPosition(
          p => {
            if (!montado.current) return;
            setSinGps(false);
            setYo({ lat: p.coords.latitude, lng: p.coords.longitude });
          },
          e => {
            if (!montado.current) return;
            if (e.code === 1) setPermiso('no');
            else setSinGps(true);
          },
          { enableHighAccuracy: true, distanceFilter: 0, interval: 2000, fastestInterval: 1000 },
        );
      })
      .catch(() => montado.current && setPermiso('no'));
    return () => {
      if (watchId !== null) Geolocation.clearWatch(watchId);
    };
  }, [reintento]);

  const pedirRuta = useCallback(
    (desde: Coordenadas, conModo: ModoRuta) => {
      if (pidiendo.current) return;
      pidiendo.current = true;
      setCargando(true);
      calcularRuta(token, desde, destino.punto, conModo)
        .then(r => {
          if (!montado.current || conModo !== modoRef.current) return;
          ultimaRutaAt.current = Date.now();
          setRuta(r);
          setError(null);
        })
        .catch(e => {
          if (!montado.current || conModo !== modoRef.current) return;
          // Con una ruta ya dibujada, un recálculo fallido no estorba: se reintenta luego.
          ultimaRutaAt.current = Date.now();
          setError(e instanceof Error ? e.message : 'No pudimos trazar la ruta.');
        })
        .finally(() => {
          pidiendo.current = false;
          if (montado.current) setCargando(false);
        });
    },
    [token, destino.punto],
  );

  const estado = useMemo(() => (ruta && yo ? estadoRuta(ruta, yo) : null), [ruta, yo]);

  // Con cada posición: la primera ruta, o una nueva si la persona se salió del camino.
  useEffect(() => {
    if (!yo) return;
    if (!ruta) {
      // Tras un error se espera a «Reintentar» (no se insiste solo).
      if (!error) pedirRuta(yo, modo);
      return;
    }
    if (estado && !estado.llegado && hayQueRecalcular(estado.desvio, Date.now() - ultimaRutaAt.current)) {
      pedirRuta(yo, modo);
    }
  }, [yo, ruta, modo, error, estado, pedirRuta]);

  // Cámara: al llegar la ruta se ve completa; después, detrás de la persona.
  const margen = useMemo(() => ({ top: 150, right: 50, bottom: 250 + insets.bottom, left: 50 }), [insets.bottom]);
  const verRutaCompleta = useCallback(() => {
    if (!ruta) return;
    const puntos = puntosDe(ruta.linea);
    if (yoRef.current) puntos.push(yoRef.current);
    mapa.current?.encuadrar(puntos, margen);
  }, [ruta, margen]);

  useEffect(() => {
    if (!ruta || yaEncuadro.current) return;
    yaEncuadro.current = true;
    verRutaCompleta();
    const t = setTimeout(() => {
      if (!montado.current || !siguiendoRef.current || !yoRef.current) return;
      yaSeAcerco.current = true;
      mapa.current?.irA(yoRef.current, ZOOM.cuadra);
    }, VER_RUTA_MS);
    return () => clearTimeout(t);
  }, [ruta, verRutaCompleta]);

  useEffect(() => {
    if (yo && siguiendoRef.current && yaSeAcerco.current) mapa.current?.seguir(yo, SEGUIR_MS);
  }, [yo]);

  const seguirme = () => {
    siguiendoRef.current = true;
    setSiguiendo(true);
    if (yoRef.current) {
      yaSeAcerco.current = true;
      mapa.current?.irA(yoRef.current, ZOOM.cuadra);
    }
  };

  const dejarDeSeguir = () => {
    siguiendoRef.current = false;
    setSiguiendo(false);
  };

  const cambiarModo = (nuevo: ModoRuta) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    setRuta(null);
    setError(null);
    yaEncuadro.current = false;
  };

  const reintentar = () => {
    setError(null);
    if (permiso === 'no') setReintento(n => n + 1);
    else if (yoRef.current) pedirRuta(yoRef.current, modo);
  };

  const linea = useMemo(
    () =>
      ruta && ruta.linea.length > 1
        ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: ruta.linea } }
        : null,
    [ruta],
  );

  const minutos = estado ? estado.minutos : ruta ? Math.max(1, Math.ceil(ruta.duracion_s / 60)) : null;
  const metros = estado ? estado.restante : ruta?.distancia_m ?? null;

  return (
    <View style={styles.container}>
      <MapaVitrina
        ref={mapa}
        style={styles.lleno}
        vistaInicial={vistaDe(destino.punto, ZOOM.zona)}
        miUbicacion={permiso === 'si'}
        creditos={{ bottom: 240 + insets.bottom, left: 8 }}
        onArrastrar={dejarDeSeguir}>
        {!!linea && (
          <GeoJSONSource id="ruta" data={linea}>
            <Layer
              id="ruta-borde"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': c.surface, 'line-width': 10 }}
            />
            <Layer
              id="ruta-linea"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': c.info,
                'line-width': 6,
                // A pie, punteada: se distingue de la de moto de un vistazo.
                ...(modo === 'pie' ? { 'line-dasharray': [1, 1.6] } : null),
              }}
            />
          </GeoJSONSource>
        )}
        {destino.tipo === 'negocio' ? (
          <PinNegocio punto={destino.punto} nombre={destino.nombre} imagen={destino.imagen} seleccionado />
        ) : (
          <PinEntrega punto={destino.punto} nombre={destino.nombre} />
        )}
      </MapaVitrina>

      {/* Arriba: la próxima indicación (o por qué no hay ruta). */}
      <View style={styles.arriba} pointerEvents="box-none">
        <Indicacion
          permiso={permiso}
          sinGps={sinGps && !yo}
          ruta={ruta}
          error={error}
          cargando={cargando}
          estado={estado}
          nombre={destino.nombre}
          onReintentar={reintentar}
        />
      </View>

      {/* Ver toda la ruta / volver a seguirme. */}
      {!!ruta && (
        <PressableScale
          style={[styles.redondo, { bottom: 250 + insets.bottom }]}
          onPress={() => {
            dejarDeSeguir();
            verRutaCompleta();
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver toda la ruta">
          <Icon name="mapa" size={20} color={c.text} />
        </PressableScale>
      )}
      {!siguiendo && !!yo && (
        <View style={[styles.seguirFila, { bottom: 252 + insets.bottom }]} pointerEvents="box-none">
          <PressableScale onPress={seguirme} style={styles.seguir} accessibilityRole="button" accessibilityLabel="Seguirme">
            <Icon name="ubicacion" size={16} color={c.onBrand} />
            <Text style={styles.seguirTxt}>Seguirme</Text>
          </PressableScale>
        </View>
      )}

      {/* Abajo: a dónde voy, cuánto falta, el modo y Google Maps. */}
      <View style={[styles.hoja, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.destinoFila}>
          <View style={styles.destinoIcono}>
            <Icon name={destino.tipo === 'negocio' ? 'tienda' : 'casa'} size={20} color={c.goldText} />
          </View>
          <View style={styles.lleno}>
            <Text style={styles.destinoNombre} numberOfLines={1}>
              {destino.nombre}
            </Text>
            {!!destino.detalle && (
              <Text style={styles.destinoDetalle} numberOfLines={1}>
                {destino.detalle}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.resumen}>
          {estado?.llegado ? (
            <Text style={styles.resumenMin}>Llegaste</Text>
          ) : minutos != null && metros != null ? (
            <>
              <Text style={styles.resumenMin}>{textoMinutos(minutos)}</Text>
              <Text style={styles.resumenKm}>· {textoDistancia(metros)}</Text>
            </>
          ) : (
            <Text style={styles.resumenKm}>Calculando…</Text>
          )}
          {cargando && !!ruta && <ActivityIndicator size="small" color={c.muted} style={styles.recalculando} />}
        </View>

        {!!elegirModo && (
          <View style={styles.modos} accessibilityRole="radiogroup">
            {(['moto', 'pie'] as const).map(m => {
              const activo = m === modo;
              return (
                <PressableScale
                  key={m}
                  style={[styles.modo, activo && styles.modoActivo]}
                  onPress={() => cambiarModo(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}>
                  <Icon name={m === 'moto' ? 'moto' : 'usuario'} size={15} color={activo ? c.onBrand : c.text} />
                  <Text style={[styles.modoTxt, activo && styles.modoTxtActivo]}>{m === 'moto' ? 'En moto' : 'A pie'}</Text>
                </PressableScale>
              );
            })}
          </View>
        )}

        <View style={styles.botones}>
          <PressableScale style={styles.secundario} onPress={() => abrirEnGoogleMaps(destino.punto, modo)}>
            <Icon name="mapa" size={15} color={c.text} />
            <Text style={styles.secundarioTxt}>Abrir en Google Maps</Text>
          </PressableScale>
          {estado?.llegado && (
            <PressableScale style={styles.primario} onPress={() => navigation.goBack()}>
              <Icon name="check" size={15} color={c.onBrand} />
              <Text style={styles.primarioTxt}>Listo</Text>
            </PressableScale>
          )}
        </View>
      </View>
    </View>
  );
}

/** La tarjeta de arriba: la próxima maniobra, o qué falta para tener ruta. */
function Indicacion({
  permiso,
  sinGps,
  ruta,
  error,
  cargando,
  estado,
  nombre,
  onReintentar,
}: {
  permiso: 'pidiendo' | 'si' | 'no';
  sinGps: boolean;
  ruta: Ruta | null;
  error: string | null;
  cargando: boolean;
  estado: ReturnType<typeof estadoRuta> | null;
  nombre: string;
  onReintentar: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();

  const aviso = (icono: IconName, titulo: string, texto: string, boton?: string) => (
    <View style={styles.tarjeta}>
      <View style={[styles.pasoIcono, styles.pasoIconoAviso]}>
        <Icon name={icono} size={24} color={c.warning} />
      </View>
      <View style={styles.lleno}>
        <Text style={styles.avisoTitulo}>{titulo}</Text>
        <Text style={styles.pasoTexto}>{texto}</Text>
        {!!boton && (
          <PressableScale onPress={onReintentar} style={styles.reintentar} accessibilityRole="button">
            <Text style={styles.reintentarTxt}>{boton}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );

  if (permiso === 'no') {
    return aviso('ubicacion', 'Activa tu ubicación', 'Para trazar la ruta necesitamos saber dónde estás.', 'Dar permiso');
  }
  if (!ruta && error) return aviso('alerta', 'Sin ruta', error, 'Reintentar');
  if (sinGps) return aviso('ubicacion', 'Buscando tu ubicación', 'No llega señal del GPS. ¿Está encendido?');
  if (!ruta || !estado) {
    return (
      <View style={styles.tarjeta}>
        <ActivityIndicator color={c.accent} />
        <Text style={styles.pasoTexto}>{cargando || permiso === 'si' ? 'Buscando la ruta…' : 'Pidiendo tu ubicación…'}</Text>
      </View>
    );
  }
  if (estado.llegado) {
    return (
      <View style={styles.tarjeta}>
        <View style={[styles.pasoIcono, styles.pasoIconoLlegada]}>
          <Icon name="bandera" size={26} color={c.onAccent} />
        </View>
        <View style={styles.lleno}>
          <Text style={styles.pasoDistancia}>Llegaste</Text>
          <Text style={styles.pasoTexto} numberOfLines={2}>
            {nombre}
          </Text>
        </View>
      </View>
    );
  }

  const paso = estado.paso;
  return (
    <View style={styles.tarjeta} accessibilityLiveRegion="polite">
      <View style={styles.pasoIcono}>
        <Icon name={paso ? ICONO_PASO[paso.icono] : 'recto'} size={28} color={c.onBrand} strokeWidth={2.4} />
      </View>
      <View style={styles.lleno}>
        <Text style={styles.pasoDistancia}>
          {estado.hastaPaso < AHORA_M ? 'Ahora' : `En ${textoDistancia(estado.hastaPaso)}`}
        </Text>
        <Text style={styles.pasoTexto} numberOfLines={2}>
          {paso?.texto ?? 'Sigue por la ruta'}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  lleno: { flex: 1 },
  arriba: { position: 'absolute', top: 12, left: 12, right: 12 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  pasoIcono: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoIconoAviso: { backgroundColor: c.warningSoft },
  pasoIconoLlegada: { backgroundColor: c.accent },
  pasoDistancia: { color: c.textStrong, fontFamily: font.display, fontSize: 22 },
  pasoTexto: { color: c.text, fontFamily: font.medium, fontSize: 14, marginTop: 2, flexShrink: 1 },
  avisoTitulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 16 },
  reintentar: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.brand,
  },
  reintentarTxt: { color: c.onBrand, fontFamily: font.semibold, fontSize: 13 },
  redondo: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  seguirFila: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  seguir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    ...shadow.card,
  },
  seguirTxt: { color: c.onBrand, fontFamily: font.semibold, fontSize: 14 },
  hoja: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 16,
    paddingTop: 16,
    ...shadow.card,
  },
  destinoFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destinoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinoNombre: { color: c.textStrong, fontFamily: font.bold, fontSize: 16 },
  destinoDetalle: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  resumen: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12 },
  resumenMin: { color: c.success, fontFamily: font.display, fontSize: 22 },
  resumenKm: { color: c.muted, fontFamily: font.semibold, fontSize: 15 },
  recalculando: { marginLeft: 6, alignSelf: 'center' },
  modos: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  modoActivo: { backgroundColor: c.brand, borderColor: c.brand },
  modoTxt: { color: c.text, fontFamily: font.semibold, fontSize: 13 },
  modoTxtActivo: { color: c.onBrand },
  botones: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secundario: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  secundarioTxt: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  primario: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.brand,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  primarioTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 14 },
}));
