import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  buscarProductos,
  getNegocios,
  getTiposNegocio,
  imagenUrl,
  NegocioLista,
  ProductoConNegocio,
  ResumenResenas,
  TipoNegocio,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale, Skeleton } from '../components/anim';
import Icon, { IconName } from '../components/Icon';
import { NivelBadge } from '../components/Reputacion';
import { PuntajeResenas } from '../components/Resenas';
import { RootStackParamList } from '../navTypes';
import { precioDe } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { REFRESCO_NEGOCIOS, usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

/** Espera tras dejar de teclear antes de buscar (ms). */
const ESPERA_BUSQUEDA = 350;

type Fila =
  | { tipo: 'titulo'; key: string; texto: string }
  | { tipo: 'negocio'; key: string; negocio: NegocioLista }
  | { tipo: 'negocioHallado'; key: string; negocio: NegocioLista }
  | { tipo: 'producto'; key: string; producto: ProductoConNegocio };

const titulo = (texto: string): Fila => ({ tipo: 'titulo', key: `titulo-${texto}`, texto });

/** Sin tildes ni mayúsculas: "rincon" encuentra "El Rincón Paisa". */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Lo esencial de un negocio en una sola línea. */
function metaNegocio(n: NegocioLista, mostrarPreparacion = true) {
  return [n.categoria, mostrarPreparacion && n.tiempo_preparacion ? `~${n.tiempo_preparacion} min` : null, n.barrio]
    .filter(Boolean)
    .join(' · ');
}

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
 * Resultados de una búsqueda. La API también devuelve los negocios que venden
 * lo buscado, pero esos ya salen en "Productos": aquí van solo los que
 * coinciden por su nombre o su categoría.
 */
function filasBusqueda(negocios: NegocioLista[], productos: ProductoConNegocio[], consulta: string): Fila[] {
  const texto = normalizar(consulta);
  const hallados = negocios.filter(n =>
    [n.nombre, ...n.categorias].some(valor => normalizar(valor).includes(texto)),
  );
  return [
    ...(hallados.length ? [titulo('Negocios')] : []),
    ...hallados.map((negocio): Fila => ({ tipo: 'negocioHallado', key: `h-${negocio.id}`, negocio })),
    ...(productos.length ? [titulo('Productos')] : []),
    ...productos.map((producto): Fila => ({ tipo: 'producto', key: `p-${producto.id}`, producto })),
  ];
}

export default function ExplorarScreen({ navigation, route }: Props) {
  const seccion = route.params?.seccion ?? 'productos';
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const [negocios, setNegocios] = useState<NegocioLista[]>([]);
  const [productos, setProductos] = useState<ProductoConNegocio[]>([]);
  // Texto de los resultados en pantalla; vacío = listado normal. Va aparte de
  // `busqueda`, que cambia con cada tecla antes de que lleguen los resultados.
  const [consulta, setConsulta] = useState('');
  const [tiposNegocio, setTiposNegocio] = useState<TipoNegocio[]>([]);
  const [tipoSeleccionadoId, setTipoSeleccionadoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // Paginación del listado de negocios (50 por página).
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const cargandoMasRef = useRef(false);
  const paginaRef = useRef(pagina);
  paginaRef.current = pagina;
  // Solo vale la respuesta de la última petición: una búsqueda vieja que llegue
  // tarde no puede pisar los resultados de la nueva.
  const ultimaPeticion = useRef(0);
  const ultimaBusqueda = useRef('');

  const tipoSeleccionado = tiposNegocio.find(tipo => tipo.id === tipoSeleccionadoId) ?? null;
  const filas = useMemo(
    () => (seccion === 'productos' && consulta ? filasBusqueda(negocios, productos, consulta) : filasListado(negocios)),
    [negocios, productos, consulta, seccion],
  );

  useEffect(() => {
    if (!auth?.token) return;
    let vigente = true;
    setTiposNegocio([]);
    getTiposNegocio(auth.token, seccion)
      .then(tipos => { if (vigente) setTiposNegocio(tipos); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [auth, seccion]);

  const cargar = useCallback(
    (texto: string, refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      setError(null);
      const turno = ++ultimaPeticion.current;
      const t = texto.trim();
      // Con una categoría elegida el texto filtra sus negocios; sin ella se
      // buscan negocios y productos a la vez.
      const conProductos = seccion === 'productos' && !!t && tipoSeleccionadoId == null;

      Promise.all([
        getNegocios(auth!.token, t || undefined, 1, tipoSeleccionadoId, seccion),
        conProductos ? buscarProductos(auth!.token, t) : Promise.resolve([]),
      ])
        .then(([p, hallados]) => {
          if (turno !== ultimaPeticion.current) return;
          setNegocios(p.negocios);
          setPagina(p.pagina);
          setUltimaPagina(p.ultimaPagina);
          setProductos(hallados);
          setConsulta(conProductos ? t : '');
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
    [auth, tipoSeleccionadoId, seccion],
  );

  // Carga la siguiente página de negocios al llegar al final de la lista.
  const cargarMas = useCallback(() => {
    if ((seccion === 'productos' && consulta) || cargando || refrescando) return;
    if (cargandoMasRef.current || pagina >= ultimaPagina) return;
    cargandoMasRef.current = true;
    setCargandoMas(true);
    const turno = ultimaPeticion.current;
    getNegocios(auth!.token, busqueda.trim() || undefined, pagina + 1, tipoSeleccionadoId, seccion)
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
  }, [auth, consulta, cargando, refrescando, pagina, ultimaPagina, tipoSeleccionadoId, busqueda, seccion]);

  // Trae de nuevo lo que hay en pantalla, sin indicadores ni avisos de error, para
  // que un negocio que abre o cierra cambie solo. Son todas las páginas cargadas:
  // con solo la primera, la lista se recortaría bajo el dedo del cliente.
  usePolling(() => {
    if (cargando || refrescando || cargandoMasRef.current) return;
    const turno = ultimaPeticion.current;
    const paginaVista = pagina;
    const t = busqueda.trim();
    const conProductos = seccion === 'productos' && !!t && tipoSeleccionadoId == null;
    const paginas = Array.from({ length: paginaVista }, (_, i) => i + 1);

    Promise.all([
      Promise.all(paginas.map(n => getNegocios(auth!.token, t || undefined, n, tipoSeleccionadoId, seccion))),
      conProductos ? buscarProductos(auth!.token, t) : Promise.resolve([]),
    ])
      .then(([respuestas, hallados]) => {
        // Si mientras tanto cambió la lista (búsqueda, otra página), esto ya es viejo.
        if (
          turno !== ultimaPeticion.current ||
          cargandoMasRef.current ||
          paginaRef.current !== paginaVista
        ) {
          return;
        }
        // Un negocio puede salir en dos páginas si cambió de lugar entre peticiones.
        const porId = new Map(respuestas.flatMap(p => p.negocios).map(n => [n.id, n]));
        setNegocios(Array.from(porId.values()));
        setUltimaPagina(respuestas[0].ultimaPagina);
        setProductos(hallados);
      })
      .catch(() => {});
  }, REFRESCO_NEGOCIOS);

  useEffect(() => {
    ++ultimaPeticion.current;
    setNegocios([]); setProductos([]); setConsulta(''); setPagina(1); setCargando(true);
    setTipoSeleccionadoId(null); setBusqueda('');
  }, [seccion]);

  // Solo el teclado espera a que dejen de escribir; cambiar de categoría es inmediato.
  useEffect(() => {
    const espera = busqueda === ultimaBusqueda.current ? 0 : ESPERA_BUSQUEDA;
    ultimaBusqueda.current = busqueda;
    const t = setTimeout(() => cargar(busqueda), espera);
    return () => clearTimeout(t);
  }, [busqueda, tipoSeleccionadoId, cargar]);

  function elegirTipo(id: number | null) {
    if (id === tipoSeleccionadoId) return;
    // Otra categoría es otra lista: se muestran los fantasmas, no la anterior.
    setNegocios([]);
    setProductos([]);
    setCargando(true);
    setTipoSeleccionadoId(id);
  }

  const abrirNegocio = useCallback(
    (n: NegocioLista) => navigation.navigate('Negocio', { id: n.id, nombre: n.nombre, seccion }),
    [navigation, seccion],
  );

  const texto = busqueda.trim();
  const nombre = auth?.user.name.trim().split(/\s+/)[0];

  return (
    <FlatList<Fila>
      style={styles.container}
      data={filas}
      keyExtractor={fila => fila.key}
      // Aire abajo para la barra flotante fija (Carrito / Mis pedidos).
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => cargar(busqueda, true)}
          colors={[c.accent]}
          tintColor={c.accent}
        />
      }
      ListHeaderComponent={
        <View>
          {/* Carrito y Mis pedidos viven en la barra flotante inferior; salir
              de la cuenta se hace desde "Mi perfil" (topbar). */}
          <View style={styles.cabecera}>
            {!!nombre && <Text style={styles.saludo}>Hola, {nombre}</Text>}
            <Text style={styles.titular}>¿Qué necesitas hoy?</Text>

            <View style={styles.buscadorFila}>
              <View style={styles.buscador}>
                <Icon name="lupa" size={18} color={c.muted} />
                <TextInput
                  style={styles.buscadorTexto}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder={seccion === 'servicios' ? 'Busca negocios o servicios' : 'Busca negocios o productos'}
                  placeholderTextColor={c.mutedSoft}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {busqueda.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setBusqueda('')}
                    hitSlop={10}
                    accessibilityLabel="Borrar búsqueda">
                    <Icon name="cerrar" size={16} color={c.muted} />
                  </TouchableOpacity>
                )}
              </View>
              {/* Los negocios en el mapa de Maicao. */}
              <PressableScale
                style={styles.botonMapa}
                scaleTo={0.92}
                onPress={() => navigation.navigate('Mapa')}
                accessibilityLabel="Ver negocios en el mapa">
                <Icon name="mapa" size={20} color={c.textStrong} />
              </PressableScale>
            </View>
          </View>

          {tiposNegocio.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pestanas}>
              <Pestana texto="Todos" activa={tipoSeleccionadoId == null} onPress={() => elegirTipo(null)} />
              {tiposNegocio.map(tipo => (
                <Pestana
                  key={tipo.id}
                  texto={tipo.nombre}
                  activa={tipo.id === tipoSeleccionadoId}
                  // Tocar la categoría activa vuelve a mostrar todos.
                  onPress={() => elegirTipo(tipo.id === tipoSeleccionadoId ? null : tipo.id)}
                />
              ))}
            </ScrollView>
          )}

          {cargando && filas.length === 0 && <NegociosFantasma />}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        cargandoMas ? (
          <ActivityIndicator color={c.accent} style={styles.pieCarga} />
        ) : null
      }
      ListEmptyComponent={
        !cargando && !error ? (
          <SinResultados
            titulo={
              texto
                ? `No encontramos "${texto}"`
                : tipoSeleccionado
                  ? `Aún no hay negocios en ${tipoSeleccionado.nombre}`
                  : 'Aún no hay negocios'
            }
            detalle={texto ? 'Prueba con otro nombre o producto.' : null}
            accion={tipoSeleccionado ? 'Ver todas las categorías' : null}
            onAccion={() => elegirTipo(null)}
          />
        ) : null
      }
      renderItem={({ item, index }) => {
        switch (item.tipo) {
          case 'titulo':
            return <Text style={styles.seccion}>{item.texto}</Text>;
          case 'negocio':
            return <CardNegocio item={item.negocio} index={index} onAbrir={abrirNegocio} seccion={seccion} />;
          case 'negocioHallado':
            return (
              <FilaResultado
                imagen={item.negocio.imagen}
                icono="tienda"
                nombre={item.negocio.nombre}
                linea={metaNegocio(item.negocio, seccion === 'productos')}
                detalle={item.negocio.abierto ? null : item.negocio.estado_texto ?? 'Cerrado'}
                resenas={item.negocio.resenas}
                index={index}
                onPress={() => abrirNegocio(item.negocio)}
              />
            );
          case 'producto': {
            const { negocio } = item.producto;
            return (
              <FilaResultado
                imagen={item.producto.imagen}
                icono="caja"
                nombre={item.producto.nombre}
                linea={precioDe(item.producto)}
                lineaResaltada
                detalle={negocio.abierto ? negocio.nombre : `${negocio.nombre} · ${negocio.estado_texto ?? 'Cerrado'}`}
                resenas={item.producto.resenas}
                index={index}
                onPress={() =>
                  navigation.navigate('Negocio', {
                    id: negocio.id,
                    nombre: negocio.nombre,
                    productoId: item.producto.id,
                    seccion,
                  })
                }
              />
            );
          }
        }
      }}
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
  seccion,
}: {
  item: NegocioLista;
  index: number;
  onAbrir: (n: NegocioLista) => void;
  seccion: 'productos' | 'servicios';
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const img = imagenUrl(item.imagen);
  const meta = metaNegocio(item, seccion === 'productos');
  // "Nuevo" no distingue a nadie en la lista: solo se muestra el nivel ganado.
  const conNivel = !!item.reputacion && item.reputacion.nivel !== 'nuevo';

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
          {!item.abierto && (
            <>
              <View style={styles.portadaVelo} />
              <Text style={styles.sello}>{item.estado_texto ?? 'Cerrado'}</Text>
            </>
          )}
        </View>

        <View style={styles.negocioCabecera}>
          <Text style={styles.negocioNombre} numberOfLines={1}>{item.nombre}</Text>
          {conNivel && <NivelBadge reputacion={item.reputacion} sinPuntaje />}
        </View>
        <PuntajeResenas resenas={item.resenas} style={styles.puntaje} />
        {!!meta && <Text style={styles.meta} numberOfLines={1}>{meta}</Text>}
        {/* Cerrado, lo que importa es cuándo vuelve a abrir. */}
        {!item.abierto && !!item.horario_hoy && (
          <Text style={styles.meta} numberOfLines={1}>{item.horario_hoy}</Text>
        )}
      </PressableScale>
    </FadeInView>
  );
});

/** Resultado de búsqueda, más compacto: negocio o producto. */
function FilaResultado({
  imagen,
  icono,
  nombre,
  linea,
  lineaResaltada,
  detalle,
  resenas,
  index,
  onPress,
}: {
  imagen?: string | null;
  icono: IconName;
  nombre: string;
  linea: string;
  lineaResaltada?: boolean;
  detalle?: string | null;
  resenas?: ResumenResenas;
  index: number;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(imagen);

  return (
    <FadeInView delay={Math.min(index, 6) * 35} offset={8}>
      <PressableScale style={styles.resultado} scaleTo={0.98} accessibilityRole="button" onPress={onPress}>
        <View style={styles.resultadoFoto}>
          {uri ? (
            <Image source={{ uri }} style={styles.portadaImagen} resizeMode="cover" />
          ) : (
            <Icon name={icono} size={24} color={c.mutedSoft} />
          )}
        </View>
        <View style={styles.resultadoTexto}>
          <Text style={styles.resultadoNombre} numberOfLines={1}>{nombre}</Text>
          {!!linea && (
            <Text style={lineaResaltada ? styles.resultadoPrecio : styles.meta} numberOfLines={1}>
              {linea}
            </Text>
          )}
          {!!detalle && <Text style={styles.meta} numberOfLines={1}>{detalle}</Text>}
          <PuntajeResenas resenas={resenas} size={12} style={styles.puntaje} />
        </View>
      </PressableScale>
    </FadeInView>
  );
}

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

function SinResultados({
  titulo: texto,
  detalle,
  accion,
  onAccion,
}: {
  titulo: string;
  detalle?: string | null;
  accion?: string | null;
  onAccion: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.vacio}>
      <Icon name="lupa" size={30} color={c.chevron} />
      <Text style={styles.vacioTitulo}>{texto}</Text>
      {!!detalle && <Text style={styles.vacioDetalle}>{detalle}</Text>}
      {!!accion && (
        <TouchableOpacity hitSlop={8} onPress={onAccion}>
          <Text style={styles.vacioAccion}>{accion}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { paddingBottom: 110 },
  cabecera: { paddingHorizontal: 20, paddingTop: 22 },
  saludo: { color: c.muted, fontFamily: font.medium, fontSize: 14, marginBottom: 2 },
  titular: { color: c.textStrong, fontFamily: font.display, fontSize: 26, lineHeight: 33 },
  buscadorFila: { flexDirection: 'row', gap: 10, marginTop: 16 },
  buscador: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  buscadorTexto: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 15,
    color: c.textStrong,
    fontFamily: font.regular,
  },
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
  portadaVelo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,13,10,0.5)' },
  // Sobre la foto oscurecida: va en claro en ambos modos.
  sello: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    color: '#FFFFFF',
    backgroundColor: 'rgba(15,13,10,0.62)',
    fontFamily: font.semibold,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  negocioCabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  negocioNombre: { flex: 1, color: c.textStrong, fontFamily: font.displaySemi, fontSize: 16, lineHeight: 22 },
  meta: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: 1 },
  puntaje: { marginTop: 3 },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 16 },
  resultadoFoto: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  resultadoTexto: { flex: 1 },
  resultadoNombre: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  resultadoPrecio: { color: c.text, fontFamily: font.bold, fontSize: 14, lineHeight: 20 },
  fantasmas: { paddingTop: 20 },
  fantasmaNombre: { marginTop: 12 },
  fantasmaMeta: { marginTop: 8 },
  pieCarga: { marginVertical: 16 },
  vacio: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 56 },
  vacioTitulo: {
    color: c.textStrong,
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  vacioDetalle: { color: c.muted, fontFamily: font.regular, fontSize: 14, marginTop: 4, textAlign: 'center' },
  vacioAccion: { color: c.goldText, fontFamily: font.semibold, fontSize: 14, marginTop: 14 },
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
