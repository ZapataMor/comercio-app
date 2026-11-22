import { useLectura } from '../useLectura';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { getCategoriasCatalogo, getNegocios, getTiposNegocio, imagenUrl, NegocioLista } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale, Skeleton } from '../components/anim';
import BarraCatalogo, {
  ALTO_BARRA_CATALOGO,
  MARGEN_BARRA_CATALOGO,
  ProveedorDesplazamiento,
  useDesplazarCatalogo,
} from '../components/BarraCatalogo';
import { ALTO_PILA_CLIENTE, MARGEN_BARRA_CLIENTE } from '../components/BarraCliente';
import ExplorarPropiedades from '../components/ExplorarPropiedades';
import Icon from '../components/Icon';
import { PuntajeResenas } from '../components/Resenas';
import { SinResultados } from '../components/ResultadosBusqueda';
import { avisarDesplazamiento } from '../encogerAlDesplazar';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { REFRESCO_NEGOCIOS, usePolling } from '../usePolling';
import { Objetivo } from '../tutorial/Objetivo';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

type Fila =
  | { tipo: 'titulo'; key: string; texto: string }
  | { tipo: 'negocio'; key: string; negocio: NegocioLista };

const titulo = (texto: string): Fila => ({ tipo: 'titulo', key: `titulo-${texto}`, texto });

/** Listado normal: la API trae primero los abiertos. */
function filasListado(negocios: NegocioLista[]): Fila[] {
  const fila = (negocio: NegocioLista): Fila => ({ tipo: 'negocio', key: `n-${negocio.id}`, negocio });
  const abiertos = negocios.filter(n => n.abierto);
  const almorzando = negocios.filter(n => !n.abierto && n.estado_texto === 'Almorzando');
  const cerrados = negocios.filter(n => !n.abierto && n.estado_texto !== 'Almorzando');
  return [
    ...(abiertos.length ? [titulo('Abiertos ahora')] : []),
    ...abiertos.map(fila),
    ...(almorzando.length ? [titulo('En descanso de almuerzo')] : []),
    ...almorzando.map(fila),
    ...(cerrados.length ? [titulo('Cerrados por ahora')] : []),
    ...cerrados.map(fila),
  ];
}

/**
 * Explorar del cliente: el catálogo elegido en la barra inferior.
 * Productos y Servicios listan negocios; Propiedades, casas y patios.
 */
export default function ExplorarScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const seccion = route.params?.seccion ?? 'productos';
  const abajo = insets.bottom + MARGEN_BARRA_CATALOGO;
  const desplazamiento = useMemo(
    () => ({ alDesplazar: avisarDesplazamiento, espacioAbajo: abajo + ALTO_BARRA_CATALOGO }),
    [abajo],
  );
  return (
    <ProveedorDesplazamiento value={desplazamiento}>
      <View style={styles.container}>
        {seccion === 'propiedades' ? (
          <ExplorarPropiedades navigation={navigation} />
        ) : (
          <ExplorarNegocios key={seccion} navigation={navigation} seccion={seccion} />
        )}
        <BarraCatalogo
          seccion={seccion}
          onCambiar={nueva => navigation.setParams({ seccion: nueva })}
          abajo={abajo}
        />
      </View>
    </ProveedorDesplazamiento>
  );
}

/** Una categoría para filtrar: global (Productos) o tipo de negocio (Servicios). */
type Opcion = { id: number; nombre: string };

/**
 * El catálogo de negocios con sus pestañas de categoría. La barra de búsqueda
 * de arriba no busca aquí: abre la pantalla Buscar (con filtros y resultados
 * en lista), y este catálogo no se ve mientras tanto.
 */
function ExplorarNegocios({ navigation, seccion }: { navigation: Props['navigation']; seccion: 'productos' | 'servicios' }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const { alDesplazar, espacioAbajo } = useDesplazarCatalogo();
  const [negocios, setNegocios] = useState<NegocioLista[]>([]);
  // Categorías de las pestañas: las globales en Productos, los tipos de negocio en Servicios.
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [filtroId, setFiltroId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Paginación del listado de negocios (50 por página).
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const cargandoMasRef = useRef(false);
  const paginaRef = useRef(pagina);
  paginaRef.current = pagina;
  // Solo vale la respuesta de la última petición: una lista vieja que llegue
  // tarde no puede pisar la nueva.
  const ultimaPeticion = useRef(0);

  const opcionElegida = opciones.find(o => o.id === filtroId) ?? null;
  const filas = useMemo(() => filasListado(negocios), [negocios]);

  useLectura(() => {
    if (!auth?.token) return;
    let vigente = true;
    setOpciones([]);
    const peticion: Promise<Opcion[]> =
      seccion === 'productos' ? getCategoriasCatalogo(auth.token, 'filtro') : getTiposNegocio(auth.token, seccion);
    peticion.then(o => { if (vigente) setOpciones(o); }).catch(() => {});
    return () => { vigente = false; };
  }, [auth, seccion]);

  /** Una página del catálogo con la pestaña elegida. */
  const pedirPagina = useCallback(
    (n: number) =>
      getNegocios(
        auth!.token,
        undefined,
        n,
        seccion === 'servicios' ? filtroId : null,
        seccion,
        { abierto: false, categoriaCatalogoId: seccion === 'productos' ? filtroId : null, porNombre: false },
      ),
    [auth, seccion, filtroId],
  );

  const cargar = useCallback(
    (refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      setError(null);
      const turno = ++ultimaPeticion.current;
      pedirPagina(1)
        .then(p => {
          if (turno !== ultimaPeticion.current) return;
          setNegocios(p.negocios);
          setPagina(p.pagina);
          setUltimaPagina(p.ultimaPagina);
        })
        .catch(e => {
          if (turno === ultimaPeticion.current) setError(e.message);
        })
        .finally(() => {
          if (turno !== ultimaPeticion.current) return;
          setCargando(false);
          setRefrescando(false);
        });
    },
    [pedirPagina],
  );

  // Carga la siguiente página de negocios al llegar al final del listado.
  const cargarMas = useCallback(() => {
    if (cargando || refrescando || cargandoMasRef.current || pagina >= ultimaPagina) return;
    cargandoMasRef.current = true;
    setCargandoMas(true);
    const turno = ultimaPeticion.current;
    pedirPagina(pagina + 1)
      .then(p => {
        if (turno !== ultimaPeticion.current) return;
        setNegocios(prev => {
          // Evita duplicados si una página se repite (p. ej. tras un refresco).
          const vistos = new Set(prev.map(n => n.id));
          return [...prev, ...p.negocios.filter(n => !vistos.has(n.id))];
        });
        setPagina(p.pagina);
        setUltimaPagina(p.ultimaPagina);
      })
      .catch(e => setError(e.message))
      .finally(() => {
        cargandoMasRef.current = false;
        setCargandoMas(false);
      });
  }, [cargando, refrescando, pagina, ultimaPagina, pedirPagina]);

  // Trae de nuevo lo que hay en pantalla, sin indicadores ni avisos de error, para
  // que un negocio que abre o cierra cambie solo. Son todas las páginas cargadas:
  // con solo la primera, la lista se recortaría bajo el dedo del cliente.
  usePolling(() => {
    if (cargando || refrescando || cargandoMasRef.current) return;
    const turno = ultimaPeticion.current;
    const paginaVista = pagina;
    Promise.all(Array.from({ length: paginaVista }, (_, i) => pedirPagina(i + 1)))
      .then(respuestas => {
        // Si mientras tanto cambió la lista (otra pestaña, otra página), esto ya es viejo.
        if (turno !== ultimaPeticion.current || cargandoMasRef.current || paginaRef.current !== paginaVista) return;
        // Un negocio puede salir en dos páginas si cambió de lugar entre peticiones.
        const porId = new Map(respuestas.flatMap(p => p.negocios).map(n => [n.id, n]));
        setNegocios(Array.from(porId.values()));
        setUltimaPagina(respuestas[0]?.ultimaPagina ?? 1);
      })
      .catch(() => {});
  }, REFRESCO_NEGOCIOS, ['negocio', 'catalogo', 'resenas']);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function elegirFiltro(id: number | null) {
    if (id === filtroId) return;
    // Otra pestaña es otra lista: se muestran los fantasmas, no la anterior.
    setNegocios([]);
    setCargando(true);
    setFiltroId(id);
  }

  const abrirNegocio = useCallback(
    (n: NegocioLista) => navigation.navigate('Negocio', { id: n.id, nombre: n.nombre, seccion }),
    [navigation, seccion],
  );

  const nombre = auth?.user.name.trim().split(/\s+/)[0];
  // El tutorial señala el primer negocio de la lista.
  const primerNegocio = filas.findIndex(f => f.tipo === 'negocio');
  const placeholder = seccion === 'servicios' ? 'Busca negocios o servicios' : 'Busca negocios o productos';

  return (
    <FlatList<Fila>
      style={styles.container}
      data={filas}
      keyExtractor={fila => fila.key}
      // Aire abajo para la barra de catálogos y, encima, los botones
      // flotantes (Carrito / Mis pedidos).
      contentContainerStyle={{ paddingBottom: espacioAbajo + MARGEN_BARRA_CLIENTE + ALTO_PILA_CLIENTE + 16 }}
      onScroll={alDesplazar}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
      }
      ListHeaderComponent={
        <View>
          {/* Carrito y Mis pedidos son los botones redondos de abajo; salir de
              la cuenta se hace desde "Mi perfil". */}
          <View style={styles.cabecera}>
            {!!nombre && <Text style={styles.saludo}>Hola, {nombre}</Text>}
            <Text style={styles.titular}>¿Qué necesitas hoy?</Text>

            <View style={styles.buscadorFila}>
              {/* Se ve como la barra, pero abre la pantalla de búsqueda. */}
              <Objetivo id="explorar.buscador" style={styles.buscadorObjetivo}>
                <Pressable
                  style={styles.buscador}
                  accessibilityRole="search"
                  accessibilityLabel={placeholder}
                  onPress={() => navigation.navigate('Buscar', { seccion, filtroId })}>
                  <Icon name="lupa" size={18} color={c.muted} />
                  <Text style={styles.buscadorTexto} numberOfLines={1}>{placeholder}</Text>
                </Pressable>
              </Objetivo>
              {/* Los negocios en el mapa de Maicao. */}
              <Objetivo id="explorar.mapa">
              <PressableScale
                style={styles.botonMapa}
                scaleTo={0.92}
                onPress={() => navigation.navigate('Mapa')}
                accessibilityLabel="Ver negocios en el mapa">
                <Icon name="mapa" size={20} color={c.textStrong} />
              </PressableScale>
              </Objetivo>
            </View>
          </View>

          {opciones.length > 0 && (
            <Objetivo id="explorar.tipos">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pestanas}>
              <Pestana texto="Todos" activa={filtroId == null} onPress={() => elegirFiltro(null)} />
              {opciones.map(o => (
                <Pestana
                  key={o.id}
                  texto={o.nombre}
                  activa={o.id === filtroId}
                  // Tocar la categoría activa vuelve a mostrar todos.
                  onPress={() => elegirFiltro(o.id === filtroId ? null : o.id)}
                />
              ))}
            </ScrollView>
            </Objetivo>
          )}

          {cargando && filas.length === 0 && <NegociosFantasma />}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={styles.pieCarga} /> : null}
      ListEmptyComponent={
        !cargando && !error ? (
          <SinResultados
            titulo={opcionElegida ? `Aún no hay negocios en ${opcionElegida.nombre}` : 'Aún no hay negocios'}
            accion={opcionElegida ? 'Ver todas las categorías' : null}
            onAccion={() => elegirFiltro(null)}
          />
        ) : null
      }
      renderItem={({ item, index }) =>
        item.tipo === 'titulo' ? (
          <Text style={styles.seccion}>{item.texto}</Text>
        ) : index === primerNegocio ? (
          <Objetivo id="explorar.negocio">
            <CardNegocio item={item.negocio} index={index} onAbrir={abrirNegocio} />
          </Objetivo>
        ) : (
          <CardNegocio item={item.negocio} index={index} onAbrir={abrirNegocio} />
        )
      }
    />
  );
}

function Pestana({ texto, activa, onPress }: { texto: string; activa: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      style={styles.pestana}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="tab"
      accessibilityLabel={texto}
      accessibilityState={{ selected: activa }}
      onPress={onPress}>
      <Text style={[styles.pestanaTxt, activa && styles.pestanaTxtActiva]}>{texto}</Text>
      <View style={[styles.pestanaMarca, activa && styles.pestanaMarcaActiva]} />
    </Pressable>
  );
}

/** Negocio del listado: la foto manda y un toque lleva a su catálogo. */
const CardNegocio = React.memo(function CardNegocio({
  item,
  index,
  onAbrir,
}: {
  item: NegocioLista;
  index: number;
  onAbrir: (n: NegocioLista) => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const img = imagenUrl(item.imagen);

  return (
    <FadeInView delay={Math.min(index, 6) * 45} style={styles.negocio}>
      <PressableScale
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={item.abierto ? item.nombre : `${item.nombre}, ${(item.estado_texto ?? 'Cerrado').toLowerCase()}`}
        onPress={() => onAbrir(item)}>
        <View style={styles.portada}>
          {img ? (
            <Image source={{ uri: img }} style={styles.portadaImagen} resizeMode="cover" />
          ) : (
            <Icon name="tienda" size={38} color={c.mutedSoft} />
          )}
        </View>

        <View style={styles.negocioCabecera}>
          <Text style={styles.negocioNombre} numberOfLines={1}>{item.nombre}</Text>
        </View>
        <PuntajeResenas resenas={item.resenas} style={styles.puntaje} />
      </PressableScale>
    </FadeInView>
  );
});

/** Resultado de búsqueda, más compacto: negocio o producto. */
function NegociosFantasma() {
  const styles = useStyles();
  return (
    <View style={styles.fantasmas}>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.negocio}>
          <Skeleton height={172} r={radius.lg} />
          <Skeleton width="55%" height={16} style={styles.fantasmaNombre} />
          <Skeleton width="38%" height={12} style={styles.fantasmaMeta} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  container: { flex: 1, backgroundColor: c.bg },
  cabecera: { paddingHorizontal: 20, paddingTop: 22 },
  saludo: { color: c.muted, fontFamily: font.medium, fontSize: 14, marginBottom: 2 },
  titular: { color: c.textStrong, fontFamily: font.display, fontSize: 26, lineHeight: 33 },
  buscadorFila: { flexDirection: 'row', gap: 10, marginTop: 16 },
  buscadorObjetivo: { flex: 1 },
  buscador: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  buscadorTexto: { flex: 1, fontSize: 15, color: c.mutedSoft, fontFamily: font.regular },
  botonMapa: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  // De borde a borde: las categorías se deslizan por debajo del margen.
  pestanas: { gap: 22, paddingHorizontal: 20, marginTop: 14 },
  pestana: { paddingTop: 8 },
  pestanaTxt: { color: c.muted, fontFamily: font.medium, fontSize: 14 },
  pestanaTxtActiva: { color: c.textStrong, fontFamily: font.semibold },
  pestanaMarca: { height: 2, marginTop: 7, borderRadius: radius.pill },
  pestanaMarcaActiva: { backgroundColor: c.accent },
  seccion: {
    color: c.textStrong,
    fontFamily: font.displaySemi,
    fontSize: 17,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 14,
  },
  negocio: { marginHorizontal: 20, marginBottom: 24 },
  portada: {
    aspectRatio: 2,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  portadaImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  negocioCabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  negocioNombre: { flex: 1, color: c.textStrong, fontFamily: font.displaySemi, fontSize: 16, lineHeight: 22 },
  puntaje: { marginTop: 3 },
  fantasmas: { paddingTop: 20 },
  fantasmaNombre: { marginTop: 12 },
  fantasmaMeta: { marginTop: 8 },
  pieCarga: { marginVertical: 16 },
  error: {
    color: c.danger,
    backgroundColor: c.dangerSoft,
    padding: 12,
    borderRadius: radius.sm,
    marginHorizontal: 20,
    marginTop: 16,
    fontFamily: font.medium,
  },
}));
