import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DomiciliarioMapa, getDomiciliariosMapa, getNegociosMapa, imagenUrl, NegocioMapa } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { abrirComoLlegar, haceCuanto, MapaVitrina, PinDomiciliario, PinNegocio, regionDe } from '../components/Mapa';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { miUbicacion, pedirPermisoUbicacion } from '../ubicacion';
import { usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'Mapa'>;

type Seleccion = { tipo: 'negocio'; item: NegocioMapa } | { tipo: 'domiciliario'; item: DomiciliarioMapa } | null;

/**
 * Mapa de Vitrina. El cliente ve los negocios que fijaron su pin (toca uno
 * para ver la tienda o cómo llegar). El administrador además ve a los
 * domiciliarios que reportaron su posición hace poco, en vivo.
 */
export default function MapaScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const token = auth!.token;
  const admin = !!route.params?.admin;
  // Solo el cliente tiene la pantalla de la tienda (catálogo y carrito).
  const puedeVerTienda = auth!.user.roles.includes('usuario');

  const mapa = useRef<MapView>(null);
  const [negocios, setNegocios] = useState<NegocioMapa[]>([]);
  const [domiciliarios, setDomiciliarios] = useState<DomiciliarioMapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [conPermiso, setConPermiso] = useState(false);
  const [ubicando, setUbicando] = useState(false);

  useEffect(() => {
    getNegociosMapa(token)
      .then(setNegocios)
      .catch(e => toast.error('No se pudo cargar el mapa', e instanceof Error ? e.message : 'Error'))
      .finally(() => setCargando(false));
  }, [token, toast]);

  // Admin: los domiciliarios se mueven; se refrescan cada 15 s.
  const cargarDomiciliarios = useCallback(() => {
    if (!admin) return;
    getDomiciliariosMapa(token)
      .then(setDomiciliarios)
      .catch(() => {});
  }, [admin, token]);
  useEffect(() => {
    cargarDomiciliarios();
  }, [cargarDomiciliarios]);
  usePolling(cargarDomiciliarios);

  const visibles = useMemo(
    () => (soloAbiertos ? negocios.filter(n => n.abierto) : negocios),
    [negocios, soloAbiertos],
  );
  const enEntrega = domiciliarios.filter(d => d.en_entrega).length;

  async function centrarEnMi() {
    setUbicando(true);
    try {
      if (!(await pedirPermisoUbicacion())) {
        toast.error('Sin permiso', 'Activa la ubicación de Vitrina en los ajustes del celular.');
        return;
      }
      setConPermiso(true);
      const punto = await miUbicacion();
      mapa.current?.animateToRegion(regionDe(punto, 0.012), 600);
    } catch (e) {
      toast.error('No se pudo ubicar', e instanceof Error ? e.message : 'Error');
    } finally {
      setUbicando(false);
    }
  }

  // Aire abajo: la barra flotante del cliente (Carrito / Mis pedidos).
  const abajo = insets.bottom + (puedeVerTienda && !admin ? 96 : 20);

  return (
    <View style={styles.container}>
      <MapaVitrina
        ref={mapa}
        style={styles.lleno}
        showsUserLocation={conPermiso}
        onPress={() => setSeleccion(null)}>
        {visibles.map(n => (
          <PinNegocio
            key={`n-${n.id}`}
            punto={n}
            nombre={n.nombre}
            imagen={n.imagen}
            abierto={n.abierto}
            seleccionado={seleccion?.tipo === 'negocio' && seleccion.item.id === n.id}
            onPress={() => setSeleccion({ tipo: 'negocio', item: n })}
          />
        ))}
        {domiciliarios.map(d => (
          <PinDomiciliario
            key={`d-${d.id}`}
            punto={d.ubicacion}
            nombre={d.nombre}
            apagado={!d.en_entrega}
            onPress={() => setSeleccion({ tipo: 'domiciliario', item: d })}
          />
        ))}
      </MapaVitrina>

      {/* Arriba: filtro y resumen. */}
      <View style={styles.arriba} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.chip, soloAbiertos && styles.chipActivo]}
          onPress={() => setSoloAbiertos(v => !v)}>
          <Text style={[styles.chipTxt, soloAbiertos && styles.chipTxtActivo]}>Solo abiertos</Text>
        </TouchableOpacity>
        <View style={styles.resumen}>
          {cargando ? (
            <ActivityIndicator size="small" color={c.accent} />
          ) : (
            <Text style={styles.resumenTxt}>
              {visibles.length} {visibles.length === 1 ? 'negocio' : 'negocios'}
              {admin ? ` · ${domiciliarios.length} domiciliarios (${enEntrega} en entrega)` : ''}
            </Text>
          )}
        </View>
      </View>

      {!cargando && negocios.length === 0 && (
        <View style={styles.vacio}>
          <Icon name="ubicacion" size={20} color={c.muted} />
          <Text style={styles.vacioTxt}>Aún no hay negocios en el mapa. Cada negocio fija su ubicación en Mi Tienda.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.miUbicacion, { bottom: abajo + (seleccion ? 170 : 0) }]}
        onPress={centrarEnMi}
        disabled={ubicando}
        accessibilityLabel="Ir a mi ubicación">
        {ubicando ? <ActivityIndicator color={c.accent} /> : <Icon name="ubicacion" size={20} color={c.accent} />}
      </TouchableOpacity>

      {seleccion?.tipo === 'negocio' && (
        <FadeInView key={`n-${seleccion.item.id}`} style={[styles.tarjeta, { bottom: abajo }]}>
          <TarjetaNegocio
            negocio={seleccion.item}
            onVerTienda={
              puedeVerTienda
                ? () => navigation.navigate('Negocio', { id: seleccion.item.id, nombre: seleccion.item.nombre })
                : undefined
            }
          />
        </FadeInView>
      )}
      {seleccion?.tipo === 'domiciliario' && (
        <FadeInView key={`d-${seleccion.item.id}`} style={[styles.tarjeta, { bottom: abajo }]}>
          <View style={styles.fila}>
            <Icon name="moto" size={22} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{seleccion.item.nombre}</Text>
              <Text style={styles.sub}>
                {seleccion.item.en_entrega ? 'Llevando un pedido' : 'En turno, libre'} · posición{' '}
                {haceCuanto(seleccion.item.ubicacion.hace_segundos)}
              </Text>
            </View>
          </View>
        </FadeInView>
      )}
    </View>
  );
}

function TarjetaNegocio({ negocio, onVerTienda }: { negocio: NegocioMapa; onVerTienda?: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(negocio.imagen);

  return (
    <>
      <View style={styles.fila}>
        {uri ? (
          <Image source={{ uri }} style={styles.foto} />
        ) : (
          <View style={[styles.foto, styles.fotoVacia]}>
            <Icon name="tienda" size={22} color={c.muted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre} numberOfLines={1}>
            {negocio.nombre}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[negocio.categoria, negocio.horario_hoy].filter(Boolean).join(' · ') || 'Negocio en Vitrina'}
          </Text>
          {!!negocio.direccion && (
            <Text style={styles.sub} numberOfLines={1}>
              {negocio.direccion}
            </Text>
          )}
        </View>
        <Text style={[styles.estado, negocio.abierto ? styles.abierto : styles.cerrado]}>
          {negocio.abierto ? 'Abierto' : 'Cerrado'}
        </Text>
      </View>
      <View style={styles.botones}>
        <PressableScale style={styles.secundario} onPress={() => abrirComoLlegar(negocio)}>
          <Icon name="ubicacion" size={15} color={c.text} />
          <Text style={styles.secundarioTxt}>Cómo llegar</Text>
        </PressableScale>
        {!!onVerTienda && (
          <PressableScale style={styles.primario} onPress={onVerTienda}>
            <Icon name="tienda" size={15} color={c.onBrand} />
            <Text style={styles.primarioTxt}>Ver tienda</Text>
          </PressableScale>
        )}
      </View>
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  lleno: { flex: 1 },
  arriba: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadow.card,
  },
  chipActivo: { backgroundColor: c.brand },
  chipTxt: { color: c.text, fontFamily: font.semibold, fontSize: 13 },
  chipTxtActivo: { color: c.onBrand },
  resumen: {
    flexShrink: 1,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadow.card,
  },
  resumenTxt: { color: c.muted, fontFamily: font.medium, fontSize: 12 },
  vacio: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: 14,
    ...shadow.card,
  },
  vacioTxt: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 13 },
  miUbicacion: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  tarjeta: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: c.surface2 },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  nombre: { color: c.textStrong, fontFamily: font.bold, fontSize: 16 },
  sub: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  estado: {
    fontSize: 11,
    fontFamily: font.bold,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  abierto: { backgroundColor: c.successSoft, color: c.success },
  cerrado: { backgroundColor: c.dangerSoft, color: c.danger },
  botones: { flexDirection: 'row', gap: 10, marginTop: 12 },
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
