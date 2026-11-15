/**
 * Catálogo de Propiedades del cliente (Explorar → «Propiedades»): casas en
 * venta, casas en alquiler y patios para eventos, con búsqueda, pestañas por
 * tipo y el botón de su propio mapa. Un toque abre el detalle.
 */
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getPropiedades, imagenUrl, PropiedadResumen, TipoPropiedad } from '../api';
import { useAuth } from '../AuthContext';
import { RootStackParamList } from '../navTypes';
import { datosClave, haceCuantoPublicada, periodoPrecio, pesos, TIPOS_PROPIEDAD, tipoPropiedad } from '../propiedades';
import { font, makeStyles, radius, useTheme } from '../theme';
import { usePolling } from '../usePolling';
import { FadeInView, PressableScale, Skeleton } from './anim';
import Icon from './Icon';
import { colorPropiedad } from './Mapa';

/** Espera tras dejar de teclear antes de buscar (ms). */
const ESPERA_BUSQUEDA = 350;

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

export default function ExplorarPropiedades({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const [propiedades, setPropiedades] = useState<PropiedadResumen[]>([]);
  const [tipo, setTipo] = useState<TipoPropiedad | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  // Solo vale la respuesta de la última petición (una búsqueda vieja no pisa la nueva).
  const turnoRef = useRef(0);
  const ultimaBusqueda = useRef('');

  const cargar = useCallback(
    (refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      setError(null);
      const turno = ++turnoRef.current;
      getPropiedades(token, { tipo, buscar: busqueda })
        .then(p => {
          if (turno !== turnoRef.current) return;
          setPropiedades(p.propiedades);
          setPagina(p.pagina);
          setUltimaPagina(p.ultimaPagina);
        })
        .catch(e => turno === turnoRef.current && setError(e.message))
        .finally(() => {
          if (turno !== turnoRef.current) return;
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token, tipo, busqueda],
  );

  // El teclado espera a que dejen de escribir; cambiar de pestaña es inmediato.
  useEffect(() => {
    const espera = busqueda === ultimaBusqueda.current ? 0 : ESPERA_BUSQUEDA;
    ultimaBusqueda.current = busqueda;
    const t = setTimeout(() => cargar(), espera);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  // Alguien publicó, vendió o cambió una: se ve sin tocar nada.
  usePolling(() => {
    if (cargando || refrescando || cargandoMas) return;
    const turno = turnoRef.current;
    Promise.all(Array.from({ length: pagina }, (_, i) => getPropiedades(token, { tipo, buscar: busqueda }, i + 1)))
      .then(respuestas => {
        if (turno !== turnoRef.current) return;
        const porId = new Map(respuestas.flatMap(r => r.propiedades).map(p => [p.id, p]));
        setPropiedades(Array.from(porId.values()));
        setUltimaPagina(respuestas[0].ultimaPagina);
      })
      .catch(() => {});
  }, 30000, ['propiedades']);

  function cargarMas() {
    if (cargando || refrescando || cargandoMas || pagina >= ultimaPagina) return;
    setCargandoMas(true);
    const turno = turnoRef.current;
    getPropiedades(token, { tipo, buscar: busqueda }, pagina + 1)
      .then(p => {
        if (turno !== turnoRef.current) return;
        setPropiedades(prev => {
          const vistas = new Set(prev.map(x => x.id));
          return [...prev, ...p.propiedades.filter(x => !vistas.has(x.id))];
        });
        setPagina(p.pagina);
        setUltimaPagina(p.ultimaPagina);
      })
      .catch(e => setError(e.message))
      .finally(() => setCargandoMas(false));
  }

  function elegirTipo(nuevo: TipoPropiedad | null) {
    if (nuevo === tipo) return;
    setPropiedades([]);
    setCargando(true);
    setTipo(nuevo);
  }

  const texto = busqueda.trim();
  const nombreTipo = tipo ? tipoPropiedad(tipo).texto.toLowerCase().replace('casa ', 'casas ').replace('patio ', 'patios ') : null;

  return (
    <FlatList
      style={styles.container}
      data={propiedades}
      keyExtractor={p => String(p.id)}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
      }
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View>
          <View style={styles.cabecera}>
            <Text style={styles.saludo}>Propiedades en Maicao</Text>
            <Text style={styles.titular}>¿Buscas casa o un patio para tu evento?</Text>
            <View style={styles.buscadorFila}>
              <View style={styles.buscador}>
                <Icon name="lupa" size={18} color={c.muted} />
                <TextInput
                  style={styles.buscadorTexto}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Busca por barrio o calle"
                  placeholderTextColor={c.mutedSoft}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {busqueda.length > 0 && (
                  <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
                    <Icon name="cerrar" size={16} color={c.muted} />
                  </TouchableOpacity>
                )}
              </View>
              <PressableScale
                style={styles.botonMapa}
                scaleTo={0.92}
                onPress={() => navigation.navigate('MapaPropiedades')}
                accessibilityLabel="Ver propiedades en el mapa">
                <Icon name="mapa" size={20} color={c.textStrong} />
              </PressableScale>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pestanas}>
            <Pestana texto="Todas" activa={tipo == null} onPress={() => elegirTipo(null)} />
            {TIPOS_PROPIEDAD.map(t => (
              <Pestana key={t.valor} texto={t.corto} activa={tipo === t.valor} onPress={() => elegirTipo(tipo === t.valor ? null : t.valor)} />
            ))}
          </ScrollView>

          <PressableScale style={styles.publicar} scaleTo={0.98} onPress={() => navigation.navigate('MisPropiedades')}>
            <View style={styles.publicarIcono}>
              <Icon name="casa" size={20} color={c.accent} strokeWidth={2} />
            </View>
            <View style={styles.lleno}>
              <Text style={styles.publicarTitulo}>¿Vendes, alquilas o tienes un patio?</Text>
              <Text style={styles.publicarSub}>Publícalo gratis y te escriben por WhatsApp.</Text>
            </View>
            <Icon name="chevron" size={18} color={c.chevron} />
          </PressableScale>

          {cargando && propiedades.length === 0 && <Fantasmas />}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={
        !cargando && !error ? (
          <View style={styles.vacio}>
            <Icon name="casa" size={30} color={c.chevron} />
            <Text style={styles.vacioTitulo}>
              {texto ? `No encontramos "${texto}"` : nombreTipo ? `Aún no hay ${nombreTipo}` : 'Aún no hay propiedades publicadas'}
            </Text>
            {(!!texto || !!tipo) && (
              <TouchableOpacity hitSlop={8} onPress={() => { setBusqueda(''); elegirTipo(null); }}>
                <Text style={styles.vacioAccion}>Ver todas</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null
      }
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={styles.pieCarga} /> : null}
      renderItem={({ item, index }) => (
        <TarjetaPropiedad
          propiedad={item}
          index={index}
          onPress={() => navigation.navigate('Propiedad', { id: item.id, titulo: item.titulo })}
        />
      )}
    />
  );
}

function Pestana({ texto, activa, onPress }: { texto: string; activa: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable style={styles.pestana} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="tab" accessibilityState={{ selected: activa }} onPress={onPress}>
      <Text style={[styles.pestanaTxt, activa && styles.pestanaTxtActiva]}>{texto}</Text>
      <View style={[styles.pestanaMarca, activa && styles.pestanaMarcaActiva]} />
    </Pressable>
  );
}

/** Tarjeta del listado: la foto manda, con el tipo y el precio a la vista. */
export const TarjetaPropiedad = React.memo(function TarjetaPropiedad({
  propiedad: p,
  index,
  onPress,
}: {
  propiedad: PropiedadResumen;
  index: number;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(p.foto);
  const tipo = tipoPropiedad(p.tipo);
  const datos = datosClave(p);

  return (
    <FadeInView delay={Math.min(index, 6) * 45} style={styles.tarjeta}>
      <PressableScale scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${tipo.texto}: ${p.titulo}, ${pesos(p.precio)}`} onPress={onPress}>
        <View style={styles.portada}>
          {uri ? (
            <Image source={{ uri }} style={styles.portadaImagen} resizeMode="cover" />
          ) : (
            <Icon name={tipo.icono} size={40} color={c.mutedSoft} />
          )}
          <View style={styles.sello}>
            <Icon name={tipo.icono} size={13} color={colorPropiedad(c, p.tipo)} strokeWidth={2.4} />
            <Text style={styles.selloTxt}>{tipo.texto}</Text>
          </View>
        </View>
        <View style={styles.fila}>
          <Text style={styles.precio}>
            {pesos(p.precio)}
            <Text style={styles.periodo}>{periodoPrecio(p.tipo)}</Text>
          </Text>
          {p.negociable && <Text style={styles.negociable}>Negociable</Text>}
        </View>
        <Text style={styles.titulo} numberOfLines={1}>{p.titulo}</Text>
        {!!datos && <Text style={styles.meta} numberOfLines={1}>{datos}</Text>}
        <Text style={styles.meta} numberOfLines={1}>
          {[p.barrio, p.publicada_at ? `Publicada ${haceCuantoPublicada(p.publicada_at)}` : null].filter(Boolean).join(' · ')}
        </Text>
      </PressableScale>
    </FadeInView>
  );
});

function Fantasmas() {
  const styles = useStyles();
  return (
    <View style={styles.fantasmas}>
      {[0, 1].map(i => (
        <View key={i} style={styles.tarjeta}>
          <Skeleton height={190} r={radius.lg} />
          <Skeleton width="40%" height={18} style={styles.fantasma} />
          <Skeleton width="65%" height={14} style={styles.fantasma} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { paddingBottom: 40 },
  lleno: { flex: 1 },
  cabecera: { paddingHorizontal: 20, paddingTop: 22 },
  saludo: { color: c.muted, fontFamily: font.medium, fontSize: 14, marginBottom: 2 },
  titular: { color: c.textStrong, fontFamily: font.display, fontSize: 26, lineHeight: 33 },
  buscadorFila: { flexDirection: 'row', gap: 10, marginTop: 16 },
  buscador: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
    borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  buscadorTexto: { flex: 1, height: '100%', paddingVertical: 0, fontSize: 15, color: c.textStrong, fontFamily: font.regular },
  botonMapa: {
    width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  pestanas: { gap: 22, paddingHorizontal: 20, marginTop: 14 },
  pestana: { paddingTop: 8 },
  pestanaTxt: { color: c.muted, fontFamily: font.medium, fontSize: 14 },
  pestanaTxtActiva: { color: c.textStrong, fontFamily: font.semibold },
  pestanaMarca: { height: 2, marginTop: 7, borderRadius: radius.pill },
  pestanaMarcaActiva: { backgroundColor: c.accent },
  publicar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 18, marginBottom: 6,
    padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, ...shadow.soft,
  },
  publicarIcono: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  publicarTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 14 },
  publicarSub: { color: c.muted, fontFamily: font.regular, fontSize: 12.5, marginTop: 1 },
  tarjeta: { marginHorizontal: 20, marginTop: 20 },
  portada: {
    aspectRatio: 1.7, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  portadaImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  sello: {
    position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.surface, ...shadow.soft,
  },
  selloTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  precio: { color: c.textStrong, fontFamily: font.display, fontSize: 19 },
  periodo: { color: c.muted, fontFamily: font.medium, fontSize: 13 },
  negociable: {
    color: c.goldText, backgroundColor: c.accentSoft, fontFamily: font.semibold, fontSize: 11,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden',
  },
  titulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15, marginTop: 2 },
  meta: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: 1 },
  fantasmas: { paddingTop: 4 },
  fantasma: { marginTop: 10 },
  pieCarga: { marginVertical: 16 },
  vacio: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48 },
  vacioTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  vacioAccion: { color: c.goldText, fontFamily: font.semibold, fontSize: 14, marginTop: 14 },
  error: {
    color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm,
    marginHorizontal: 20, marginTop: 16, fontFamily: font.medium,
  },
}));
