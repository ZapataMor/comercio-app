import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ClienteDireccion,
  DomiciliarioMapa,
  getClienteDirecciones,
  getDomiciliariosMapa,
  getNegociosMapa,
  imagenUrl,
  NegocioMapa,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import {
  abrirComoLlegar,
  haceCuanto,
  MapaRef,
  MapaVitrina,
  PinDomiciliario,
  PinEntrega,
  PinNegocio,
  ZOOM,
} from '../components/Mapa';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { Estado, ESTADOS, filtrarNegocios, tiposDe } from '../filtrosMapa';
import { useToast } from '../Toast';
import { miUbicacion, pedirPermisoUbicacion } from '../ubicacion';
import { REFRESCO_NEGOCIOS, usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'Mapa'>;

type Seleccion =
  | { tipo: 'negocio'; item: NegocioMapa }
  | { tipo: 'domiciliario'; item: DomiciliarioMapa }
  | { tipo: 'casa'; item: ClienteDireccion }
  | null;

/**
 * Mapa de Vitrina. El cliente ve los negocios que fijaron su pin (toca uno
 * para ver la tienda o cómo llegar), filtrados por tipo y por abiertos o
 * cerrados, más su casa y dónde está ahora. El administrador además ve a los
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

  const mapa = useRef<MapaRef>(null);
  const [negocios, setNegocios] = useState<NegocioMapa[]>([]);
  const [domiciliarios, setDomiciliarios] = useState<DomiciliarioMapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>('todos');
  const [casa, setCasa] = useState<ClienteDireccion | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [conPermiso, setConPermiso] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const esCliente = puedeVerTienda && !admin;

  // El cliente ve su casa (la dirección principal con punto)...
  useEffect(() => {
    if (!esCliente) return;
    getClienteDirecciones(token)
      .then(lista => {
        const conPunto = lista.filter(d => d.lat != null && d.lng != null);
        setCasa(conPunto.find(d => d.es_principal) ?? conPunto[0] ?? null);
      })
      .catch(() => {});
  }, [esCliente, token]);

  // ...y dónde está ahora: el punto azul en vivo, si da el permiso.
  useEffect(() => {
    if (!esCliente) return;
    pedirPermisoUbicacion()
      .then(si => si && setConPermiso(true))
      .catch(() => {});
  }, [esCliente]);

  useEffect(() => {
    getNegociosMapa(token)
      .then(setNegocios)
      .catch(e => toast.error('No se pudo cargar el mapa', e instanceof Error ? e.message : 'Error'))
      .finally(() => setCargando(false));
  }, [token, toast]);

  // Si un negocio abre o cierra cambian su pin y su tarjeta, si está abierta.
  usePolling(() => {
    getNegociosMapa(token)
      .then(lista => {
        setNegocios(lista);
        setSeleccion(s =>
          s?.tipo === 'negocio'
            ? { tipo: 'negocio', item: lista.find(n => n.id === s.item.id) ?? s.item }
            : s,
        );
      })
      .catch(() => {});
  }, REFRESCO_NEGOCIOS, ['negocio']);

  // Admin: los domiciliarios se mueven; se refrescan con cada posición que mandan.
  const cargarDomiciliarios = useCallback(() => {
    if (!admin) return;
    getDomiciliariosMapa(token)
      .then(setDomiciliarios)
      .catch(() => {});
  }, [admin, token]);
  useEffect(() => {
    cargarDomiciliarios();
  }, [cargarDomiciliarios]);
  usePolling(cargarDomiciliarios, 15000, admin ? ['mapa', 'pedidos', 'perfil'] : undefined);

  // Los tipos salen de los negocios que hay en el mapa: nunca un chip vacío.
  const tipos = useMemo(
    () => [...new Set(negocios.flatMap(tiposDe))].sort((a, b) => a.localeCompare(b, 'es')),
    [negocios],
  );
  const visibles = useMemo(() => filtrarNegocios(negocios, tipo, estado), [negocios, tipo, estado]);

  // Si el negocio de la tarjeta queda fuera del filtro, se cierra la tarjeta.
  useEffect(() => {
    setSeleccion(s => (s?.tipo === 'negocio' && !visibles.some(n => n.id === s.item.id) ? null : s));
  }, [visibles]);
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
      mapa.current?.irA(punto, ZOOM.zona);
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
        miUbicacion={conPermiso}
        creditos={{ bottom: abajo + (seleccion ? 170 : 0), left: 12 }}
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
        {!!casa && (
          <PinEntrega
            punto={{ lat: casa.lat!, lng: casa.lng! }}
            nombre="Mi casa"
            onPress={() => setSeleccion({ tipo: 'casa', item: casa })}
          />
        )}
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

      {/* Arriba: tipo de negocio, abiertos/cerrados y resumen. */}
      <View style={styles.arriba} pointerEvents="box-none">
        {tipos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipos}
            style={styles.tiposScroll}>
            {[null, ...tipos].map(t => {
              const activo = tipo === t;
              return (
                <TouchableOpacity
                  key={t ?? '*'}
                  style={[styles.chip, activo && styles.chipActivo]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  onPress={() => setTipo(t)}>
                  <Text style={[styles.chipTxt, activo && styles.chipTxtActivo]}>{t ?? 'Todos los tipos'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <View style={styles.filaArriba} pointerEvents="box-none">
          <View style={styles.segmentos} accessibilityRole="radiogroup">
            {ESTADOS.map(e => {
              const activo = estado === e.valor;
              return (
                <TouchableOpacity
                  key={e.valor}
                  style={[styles.segmento, activo && styles.chipActivo]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  onPress={() => setEstado(e.valor)}>
                  <Text style={[styles.chipTxt, activo && styles.chipTxtActivo]}>{e.texto}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.resumen}>
            {cargando ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <Text style={styles.resumenTxt} numberOfLines={1}>
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
        {!cargando && negocios.length > 0 && visibles.length === 0 && (
          <View style={styles.vacio}>
            <Icon name="tienda" size={20} color={c.muted} />
            <Text style={styles.vacioTxt}>
              No hay {tipo ? `negocios de tipo «${tipo}»` : 'negocios'}
              {estado === 'abiertos' ? ' abiertos' : estado === 'cerrados' ? ' cerrados' : ''} en este momento.
            </Text>
          </View>
        )}
      </View>

      {!!casa && (
        <TouchableOpacity
          style={[styles.miUbicacion, { bottom: abajo + (seleccion ? 170 : 0) + 58 }]}
          onPress={() => {
            mapa.current?.irA({ lat: casa.lat!, lng: casa.lng! }, ZOOM.barrio);
            setSeleccion({ tipo: 'casa', item: casa });
          }}
          accessibilityLabel="Ir a mi casa">
          <Icon name="casa" size={20} color={c.accent} />
        </TouchableOpacity>
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
      {seleccion?.tipo === 'casa' && (
        <FadeInView key="casa" style={[styles.tarjeta, { bottom: abajo }]}>
          <View style={styles.fila}>
            <Icon name="casa" size={22} color={c.accent} />
            <View style={styles.lleno}>
              <Text style={styles.nombre}>{seleccion.item.nombre || 'Mi casa'}</Text>
              <Text style={styles.sub} numberOfLines={2}>
                {[seleccion.item.direccion, seleccion.item.barrio].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        </FadeInView>
      )}
      {seleccion?.tipo === 'domiciliario' && (
        <FadeInView key={`d-${seleccion.item.id}`} style={[styles.tarjeta, { bottom: abajo }]}>
          <View style={styles.fila}>
            <Icon name="moto" size={22} color={c.accent} />
            <View style={styles.lleno}>
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
        <View style={styles.lleno}>
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
          {negocio.estado_texto ?? (negocio.abierto ? 'Abierto' : 'Cerrado')}
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
  arriba: { position: 'absolute', top: 12, left: 0, right: 0, gap: 8 },
  // Los chips de tipos llegan al borde al deslizar; el aire va dentro.
  tiposScroll: { flexGrow: 0 },
  tipos: { paddingHorizontal: 12, gap: 8, paddingBottom: 4 },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  segmentos: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    padding: 3,
    ...shadow.card,
  },
  segmento: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
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
    marginHorizontal: 12,
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
