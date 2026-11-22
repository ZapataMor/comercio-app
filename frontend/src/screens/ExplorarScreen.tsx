import { useLectura } from '../useLectura';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
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
  FiltrosBusqueda,
  getCategoriasCatalogo,
  getNegocios,
  getTiposNegocio,
  imagenUrl,
  NegocioLista,
  NegociosPagina,
  ProductoConNegocio,
  ResumenResenas,
} from '../api';
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
import Icon, { IconName } from '../components/Icon';
import { PuntajeResenas } from '../components/Resenas';
import { avisarDesplazamiento } from '../encogerAlDesplazar';
import { RootStackParamList } from '../navTypes';
import { precioDe } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { REFRESCO_NEGOCIOS, usePolling } from '../usePolling';
import { Objetivo } from '../tutorial/Objetivo';

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
  // La API dice si coincide aun con errores de ortografía ("poyo" → "Pollos
  // Juancho"); la comparación local queda para una API sin ese dato.
  const hallados = negocios.filter(n =>
    n.coincide_nombre ?? [n.nombre, ...n.categorias].some(valor => normalizar(valor).includes(texto)),
  );
  return [
    ...(hallados.length ? [titulo('Negocios')] : []),
    ...hallados.map((negocio): Fila => ({ tipo: 'negocioHallado', key: `h-${negocio.id}`, negocio })),
    ...(productos.length ? [titulo('Productos')] : []),
    ...productos.map((producto): Fila => ({ tipo: 'producto', key: `p-${producto.id}`, producto })),
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

/** Qué se busca con los botones bajo la barra: todo, solo negocios o solo productos. */
type Modo = 'todo' | 'negocios' | 'productos';

/** Una categoría para filtrar: global (Productos) o tipo de negocio (Servicios). */
type Opcion = { id: number; nombre: string };

/**
 * Qué pedir a la API y cómo mostrarlo. `resultados` = filas compactas de
 * búsqueda; si no, el listado de negocios con foto, por páginas.
 */
function planBusqueda(seccion: 'productos' | 'servicios', modo: Modo, texto: string, filtroId: number | null) {
  if (seccion === 'servicios') {
    return { negocios: true, productos: false, porNombre: false, resultados: false, todosProductos: false };
  }
  if (modo === 'negocios') {
    return { negocios: true, productos: false, porNombre: true, resultados: !!texto, todosProductos: false };
  }
  if (modo === 'productos') {
    return { negocios: false, productos: true, porNombre: false, resultados: true, todosProductos: !texto && filtroId == null };
  }
  const conFiltro = !!texto || filtroId != null;
  return { negocios: true, productos: conFiltro, porNombre: false, resultados: conFiltro, todosProductos: false };
}

function ExplorarNegocios({ navigation, seccion }: { navigation: Props['navigation']; seccion: 'productos' | 'servicios' }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const { alDesplazar, espacioAbajo } = useDesplazarCatalogo();
  const [negocios, setNegocios] = useState<NegocioLista[]>([]);
  const [productos, setProductos] = useState<ProductoConNegocio[]>([]);
  // Cómo se muestran los resultados en pantalla. Va aparte de `busqueda`, que
  // cambia con cada tecla antes de que lleguen los resultados.
  const [vista, setVista] = useState({ resultados: false, consulta: '' });
  const [consultaAplicada, setConsultaAplicada] = useState('');
  // Categorías para filtrar: las globales en Productos, los tipos de negocio en Servicios.
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [filtroId, setFiltroId] = useState<number | null>(null);
  const [modo, setModo] = useState<Modo>('todo');
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
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
  const buscadorRef = useRef<TextInput>(null);
  // Solo vale la respuesta de la última petición: una búsqueda vieja que llegue
  // tarde no puede pisar los resultados de la nueva.
  const ultimaPeticion = useRef(0);
  const ultimaBusqueda = useRef('');

  const opcionElegida = opciones.find(o => o.id === filtroId) ?? null;
  const filas = useMemo(
    () => (vista.resultados ? filasBusqueda(negocios, productos, vista.consulta) : filasListado(negocios)),
    [negocios, productos, vista],
  );

  useLectura(() => {
    if (!auth?.token) return;
    let vigente = true;
    setOpciones([]);
    const peticion: Promise<Opcion[]> =
      seccion === 'productos' ? getCategoriasCatalogo(auth.token, 'filtro') : getTiposNegocio(auth.token, seccion);
    peticion.then(o => { if (vigente) setOpciones(o); }).catch(() => {});
    return () => { vigente = false; };
  }, [auth, seccion]);

  // Al bajar el teclado (atrás de Android) la barra suelta el foco: así se
  // esconden los filtros si no hay ninguno puesto.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => buscadorRef.current?.blur());
    return () => sub.remove();
  }, []);

  /** Lo que se le pide a la API para un texto y unas páginas, con los filtros de ahora. */
  const pedir = useCallback(
    (texto: string, paginas: number[]) => {
      const plan = planBusqueda(seccion, modo, texto, filtroId);
      const tipoId = seccion === 'servicios' ? filtroId : null;
      const filtros: FiltrosBusqueda = {
        abierto: soloAbiertos,
        categoriaCatalogoId: seccion === 'productos' ? filtroId : null,
        porNombre: plan.porNombre,
      };
      return Promise.all([
        plan.negocios
          ? Promise.all(paginas.map(n => getNegocios(auth!.token, texto || undefined, n, tipoId, seccion, filtros)))
          : Promise.resolve([] as NegociosPagina[]),
        plan.productos
          ? buscarProductos(auth!.token, texto, null, plan.todosProductos, filtros)
          : Promise.resolve([] as ProductoConNegocio[]),
      ]).then(([respuestas, hallados]) => ({ plan, respuestas, hallados }));
    },
    [auth, seccion, modo, filtroId, soloAbiertos],
  );

  const cargar = useCallback(
    (texto: string, refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      setError(null);
      const turno = ++ultimaPeticion.current;
      const t = texto.trim();

      pedir(t, [1])
        .then(({ plan, respuestas, hallados }) => {
          if (turno !== ultimaPeticion.current) return;
          const primera = respuestas[0];
          setConsultaAplicada(t);
          setNegocios(primera?.negocios ?? []);
          setPagina(primera?.pagina ?? 1);
          setUltimaPagina(primera?.ultimaPagina ?? 1);
          setProductos(hallados);
          setVista({ resultados: plan.resultados, consulta: t });
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
    [pedir],
  );

  // Carga la siguiente página de negocios al llegar al final del listado.
  const cargarMas = useCallback(() => {
    if (vista.resultados || cargando || refrescando) return;
    if (cargandoMasRef.current || pagina >= ultimaPagina) return;
    cargandoMasRef.current = true;
    setCargandoMas(true);
    const turno = ultimaPeticion.current;
    pedir(consultaAplicada, [pagina + 1])
      .then(({ respuestas }) => {
        const p = respuestas[0];
        if (turno !== ultimaPeticion.current || !p) return;
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
  }, [vista, cargando, refrescando, pagina, ultimaPagina, consultaAplicada, pedir]);

  // Trae de nuevo lo que hay en pantalla, sin indicadores ni avisos de error, para
  // que un negocio que abre o cierra cambie solo. Son todas las páginas cargadas:
  // con solo la primera, la lista se recortaría bajo el dedo del cliente.
  usePolling(() => {
    if (cargando || refrescando || cargandoMasRef.current) return;
    const turno = ultimaPeticion.current;
    const paginaVista = pagina;

    pedir(consultaAplicada, Array.from({ length: paginaVista }, (_, i) => i + 1))
      .then(({ plan, respuestas, hallados }) => {
        // Si mientras tanto cambió la lista (búsqueda, otra página), esto ya es viejo.
        if (
          turno !== ultimaPeticion.current ||
          cargandoMasRef.current ||
          paginaRef.current !== paginaVista
        ) {
          return;
        }
        if (plan.negocios) {
          // Un negocio puede salir en dos páginas si cambió de lugar entre peticiones.
          const porId = new Map(respuestas.flatMap(p => p.negocios).map(n => [n.id, n]));
          setNegocios(Array.from(porId.values()));
          setUltimaPagina(respuestas[0]?.ultimaPagina ?? 1);
        }
        setProductos(hallados);
      })
      .catch(() => {});
  }, REFRESCO_NEGOCIOS, ['negocio', 'catalogo', 'resenas']);

  useEffect(() => {
    ++ultimaPeticion.current;
    setNegocios([]); setProductos([]); setVista({ resultados: false, consulta: '' }); setPagina(1); setCargando(true);
    setFiltroId(null); setModo('todo'); setSoloAbiertos(false); setBusqueda('');
  }, [seccion]);

  // Solo el teclado espera a que dejen de escribir; los filtros son inmediatos.
  useLectura(() => {
    const espera = busqueda === ultimaBusqueda.current ? 0 : ESPERA_BUSQUEDA;
    ultimaBusqueda.current = busqueda;
    const t = setTimeout(() => cargar(busqueda), espera);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  /** Otro filtro es otra lista: se muestran los fantasmas, no la anterior. */
  function alCambiarFiltro() {
    setNegocios([]);
    setProductos([]);
    setCargando(true);
  }

  function elegirFiltro(id: number | null) {
    if (id === filtroId) return;
    alCambiarFiltro();
    setFiltroId(id);
  }

  // «Negocios» y «Productos» se prenden y apagan: ninguno = buscar todo.
  function elegirModo(nuevo: Exclude<Modo, 'todo'>) {
    alCambiarFiltro();
    setModo(actual => (actual === nuevo ? 'todo' : nuevo));
  }

  function elegirAbiertos(valor: boolean) {
    if (valor === soloAbiertos) return;
    alCambiarFiltro();
    setSoloAbiertos(valor);
  }

  function quitarFiltros() {
    alCambiarFiltro();
    setFiltroId(null);
    setModo('todo');
    setSoloAbiertos(false);
  }

  const abrirNegocio = useCallback(
    (n: NegocioLista) => navigation.navigate('Negocio', { id: n.id, nombre: n.nombre, seccion }),
    [navigation, seccion],
  );

  const texto = busqueda.trim();
  const nombre = auth?.user.name.trim().split(/\s+/)[0];
  // El tutorial señala el primer negocio de la lista.
  const primerNegocio = filas.findIndex(f => f.tipo === 'negocio');
  // Los botones de filtro aparecen al tocar la barra y se quedan mientras haya
  // algo puesto. Sin ellos, las categorías van como pestañas.
  const filtrosPuestos = modo !== 'todo' || soloAbiertos || filtroId != null;
  const mostrarFiltros = enfocado || modo !== 'todo' || soloAbiertos || texto.length > 0;

  const placeholder =
    seccion === 'servicios'
      ? 'Busca negocios o servicios'
      : modo === 'negocios'
        ? 'Busca negocios por su nombre'
        : modo === 'productos'
          ? 'Busca productos'
          : 'Busca negocios o productos';

  function textoVacio(): { titulo: string; detalle: string | null } {
    if (texto) {
      return {
        titulo: `No encontramos "${texto}"`,
        detalle: filtrosPuestos ? 'Prueba con otro nombre o quita algún filtro.' : 'Prueba con otro nombre o producto.',
      };
    }
    const que = modo === 'productos' ? 'productos' : 'negocios';
    if (soloAbiertos) {
      return { titulo: `No hay ${que} abiertos ahora${opcionElegida ? ` en ${opcionElegida.nombre}` : ''}`, detalle: null };
    }
    return { titulo: opcionElegida ? `Aún no hay ${que} en ${opcionElegida.nombre}` : `Aún no hay ${que}`, detalle: null };
  }
  const vacio = textoVacio();

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
          {/* Carrito y Mis pedidos son los botones redondos de abajo a la
              izquierda; salir de la cuenta se hace desde "Mi perfil" (topbar). */}
          <View style={styles.cabecera}>
            {!!nombre && <Text style={styles.saludo}>Hola, {nombre}</Text>}
            <Text style={styles.titular}>¿Qué necesitas hoy?</Text>

            <View style={styles.buscadorFila}>
              <Objetivo id="explorar.buscador" style={styles.buscador}>
                <Icon name="lupa" size={18} color={c.muted} />
                <TextInput
                  ref={buscadorRef}
                  style={styles.buscadorTexto}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  onFocus={() => setEnfocado(true)}
                  onBlur={() => setEnfocado(false)}
                  placeholder={placeholder}
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

          {mostrarFiltros ? (
            <FadeInView offset={6} duration={220} style={styles.filtros}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.filaChips}>
                {seccion === 'productos' && (
                  <>
                    <FiltroChip
                      texto="Negocios"
                      icono="tienda"
                      activo={modo === 'negocios'}
                      ayuda="Solo negocios con ese nombre o parecido"
                      onPress={() => elegirModo('negocios')}
                    />
                    <FiltroChip
                      texto="Productos"
                      icono="caja"
                      activo={modo === 'productos'}
                      ayuda="Solo productos"
                      onPress={() => elegirModo('productos')}
                    />
                    <View style={styles.separadorChips} />
                  </>
                )}
                <FiltroChip
                  texto="Abierto ahora"
                  icono="reloj"
                  activo={soloAbiertos}
                  onPress={() => elegirAbiertos(true)}
                />
                <FiltroChip
                  texto="Todos"
                  activo={!soloAbiertos}
                  ayuda="Abiertos y cerrados"
                  onPress={() => elegirAbiertos(false)}
                />
              </ScrollView>
              {opciones.length > 0 && (
                <>
                  <Text style={styles.filtrosTitulo}>Categorías</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.filaChips}>
                    {opciones.map(o => (
                      <FiltroChip
                        key={o.id}
                        texto={o.nombre}
                        activo={o.id === filtroId}
                        // Tocar la categoría activa vuelve a mostrar todas.
                        onPress={() => elegirFiltro(o.id === filtroId ? null : o.id)}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </FadeInView>
          ) : opciones.length > 0 ? (
            <Objetivo id="explorar.tipos">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pestanas}>
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
          ) : null}

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
            titulo={vacio.titulo}
            detalle={vacio.detalle}
            accion={filtrosPuestos ? 'Quitar filtros' : null}
            onAccion={quitarFiltros}
          />
        ) : null
      }
      renderItem={({ item, index }) => {
        switch (item.tipo) {
          case 'titulo':
            return <Text style={styles.seccion}>{item.texto}</Text>;
          case 'negocio':
            return index === primerNegocio ? (
              <Objetivo id="explorar.negocio">
                <CardNegocio item={item.negocio} index={index} onAbrir={abrirNegocio} />
              </Objetivo>
            ) : (
              <CardNegocio item={item.negocio} index={index} onAbrir={abrirNegocio} />
            );
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

/**
 * Botón de filtro bajo la barra de búsqueda. El fondo va en una vista siempre
 * montada que solo cambia de opacidad: Android dibuja sin esquinas un fondo
 * que se le agrega a una vista ya en pantalla.
 */
function FiltroChip({
  texto,
  activo,
  icono,
  ayuda,
  onPress,
}: {
  texto: string;
  activo: boolean;
  icono?: IconName;
  ayuda?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={[styles.chip, { borderColor: activo ? c.brand : c.borderStrong }]}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={ayuda ? `${texto}: ${ayuda}` : texto}
      onPress={onPress}>
      <View pointerEvents="none" style={[styles.chipFondo, { opacity: activo ? 1 : 0 }]} />
      {!!icono && <Icon name={icono} size={15} color={activo ? c.onBrand : c.muted} />}
      <Text style={[styles.chipTxt, { color: activo ? c.onBrand : c.text }]}>{texto}</Text>
    </Pressable>
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
  // Botones de filtro bajo la barra de búsqueda.
  filtros: { marginTop: 14 },
  filaChips: { gap: 8, paddingHorizontal: 20, alignItems: 'center' },
  filtrosTitulo: {
    color: c.muted,
    fontFamily: font.medium,
    fontSize: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  separadorChips: { width: 1, height: 22, backgroundColor: c.border, marginHorizontal: 4 },
  // Alto fijo y radio de la mitad: ver FiltroChip.
  chip: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  chipFondo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 18,
    backgroundColor: c.brand,
  },
  chipTxt: { fontFamily: font.medium, fontSize: 14 },
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
