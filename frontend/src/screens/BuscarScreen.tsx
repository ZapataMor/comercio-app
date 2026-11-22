import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buscarProductos,
  FiltrosBusqueda,
  getCategoriasCatalogo,
  getNegocios,
  getTiposNegocio,
  NegocioLista,
  ProductoConNegocio,
} from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import { useTecladoPropio } from '../components/EspacioTeclado';
import Icon from '../components/Icon';
import { FilaResultado, FiltroChip, metaNegocio, normalizar, SinResultados } from '../components/ResultadosBusqueda';
import { RootStackParamList } from '../navTypes';
import { precioDe } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useLectura } from '../useLectura';
import { REFRESCO_NEGOCIOS, usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'Buscar'>;

/** Espera tras dejar de teclear antes de buscar (ms). */
const ESPERA_BUSQUEDA = 350;

/** Qué se busca con los botones bajo la barra: todo, solo negocios o solo productos. */
type Modo = 'todo' | 'negocios' | 'productos';

/** Una categoría para filtrar: global (Productos) o tipo de negocio (Servicios). */
type Opcion = { id: number; nombre: string };

type Fila =
  | { tipo: 'titulo'; key: string; texto: string }
  | { tipo: 'negocio'; key: string; negocio: NegocioLista }
  | { tipo: 'producto'; key: string; producto: ProductoConNegocio };

type Plan = { negocios: boolean; productos: boolean; porNombre: boolean; todosProductos: boolean };

/** Qué pedir a la API. null = nada escrito ni elegido: se muestra una pista. */
function planBusqueda(
  seccion: 'productos' | 'servicios',
  modo: Modo,
  texto: string,
  filtroId: number | null,
  soloAbiertos: boolean,
): Plan | null {
  if (!texto && filtroId == null && !soloAbiertos && modo === 'todo') return null;
  if (seccion === 'servicios') return { negocios: true, productos: false, porNombre: false, todosProductos: false };
  if (modo === 'negocios') return { negocios: true, productos: false, porNombre: true, todosProductos: false };
  if (modo === 'productos') {
    return { negocios: false, productos: true, porNombre: false, todosProductos: !texto && filtroId == null };
  }
  return { negocios: true, productos: !!texto || filtroId != null, porNombre: false, todosProductos: false };
}

/**
 * Filas de resultados. La API también devuelve los negocios que venden lo
 * buscado, pero esos ya salen en "Productos": en "Negocios" van solo los que
 * coinciden por su nombre o su tipo. Con «Negocios» elegido, o en Servicios
 * (lo buscado puede ser un servicio), van todos los que llegaron.
 */
function filasResultados(
  negocios: NegocioLista[],
  productos: ProductoConNegocio[],
  consulta: string,
  todosLosNegocios: boolean,
): Fila[] {
  const texto = normalizar(consulta);
  // La API dice si coincide aun con errores de ortografía ("poyo" → "Pollos
  // Juancho"); la comparación local queda para una API sin ese dato.
  const hallados = todosLosNegocios
    ? negocios
    : negocios.filter(n => n.coincide_nombre ?? [n.nombre, ...n.categorias].some(v => normalizar(v).includes(texto)));
  const titulo = (t: string): Fila => ({ tipo: 'titulo', key: `titulo-${t}`, texto: t });
  return [
    ...(hallados.length ? [titulo('Negocios')] : []),
    ...hallados.map((negocio): Fila => ({ tipo: 'negocio', key: `n-${negocio.id}`, negocio })),
    ...(productos.length ? [titulo('Productos')] : []),
    ...productos.map((producto): Fila => ({ tipo: 'producto', key: `p-${producto.id}`, producto })),
  ];
}

/**
 * Búsqueda del cliente, en una pantalla aparte: arriba la flecha para volver y
 * la barra; debajo los filtros (Negocios / Productos, Abierto ahora / Todos y
 * las categorías) y los resultados en lista. El catálogo de Explorar no se ve.
 */
export default function BuscarScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const seccion = route.params?.seccion ?? 'productos';

  const [busqueda, setBusqueda] = useState('');
  const [negocios, setNegocios] = useState<NegocioLista[]>([]);
  const [productos, setProductos] = useState<ProductoConNegocio[]>([]);
  // Lo que está en pantalla: con qué texto y plan se pidió. Va aparte de
  // `busqueda`, que cambia con cada tecla antes de que lleguen los resultados.
  const [vista, setVista] = useState<{ consulta: string; plan: Plan | null }>({ consulta: '', plan: null });
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  // La categoría elegida en Explorar llega ya puesta.
  const [filtroId, setFiltroId] = useState<number | null>(route.params?.filtroId ?? null);
  const [modo, setModo] = useState<Modo>('todo');
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buscadorRef = useRef<TextInput>(null);
  // El teclado lo maneja esta pantalla: solo la lista deja su espacio abajo.
  useTecladoPropio();
  const [altoTeclado, setAltoTeclado] = useState(0);
  useEffect(() => {
    const abre = Keyboard.addListener('keyboardDidShow', e => setAltoTeclado(e.endCoordinates.height));
    const cierra = Keyboard.addListener('keyboardDidHide', () => setAltoTeclado(0));
    return () => {
      abre.remove();
      cierra.remove();
    };
  }, []);
  // Solo vale la respuesta de la última petición: una búsqueda vieja que llegue
  // tarde no puede pisar los resultados de la nueva.
  const ultimaPeticion = useRef(0);
  const ultimaBusqueda = useRef('');

  const filas = useMemo(
    () =>
      vista.plan
        ? filasResultados(negocios, productos, vista.consulta, seccion === 'servicios' || vista.plan.porNombre)
        : [],
    [negocios, productos, vista, seccion],
  );

  useLectura(() => {
    if (!auth?.token) return;
    let vigente = true;
    const peticion: Promise<Opcion[]> =
      seccion === 'productos' ? getCategoriasCatalogo(auth.token, 'filtro') : getTiposNegocio(auth.token, seccion);
    peticion.then(o => { if (vigente) setOpciones(o); }).catch(() => {});
    return () => { vigente = false; };
  }, [auth, seccion]);

  // El teclado sale cuando la pantalla ya está puesta: abrirlo mientras se
  // monta cambia el alto de toda la app a la vez y se trababa.
  useEffect(() => {
    const t = setTimeout(() => buscadorRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  /** Salir: primero baja el teclado y luego vuelve, para no hacer las dos cosas a la vez. */
  const salir = useCallback(() => {
    if (!Keyboard.isVisible()) {
      navigation.goBack();
      return;
    }
    let salio = false;
    const volver = () => {
      if (salio) return;
      salio = true;
      sub.remove();
      clearTimeout(respaldo);
      navigation.goBack();
    };
    const sub = Keyboard.addListener('keyboardDidHide', volver);
    // Si el aviso no llega, no se queda trabada la flecha.
    const respaldo = setTimeout(volver, 400);
    Keyboard.dismiss();
  }, [navigation]);

  // El botón atrás de Android hace lo mismo que la flecha. Con el teclado
  // abierto, Android lo usa primero para bajarlo.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      salir();
      return true;
    });
    return () => sub.remove();
  }, [salir]);

  /** Lo que se le pide a la API para un texto, con los filtros de ahora. */
  const pedir = useCallback(
    (texto: string) => {
      const plan = planBusqueda(seccion, modo, texto, filtroId, soloAbiertos);
      if (!plan) return Promise.resolve({ plan, negocios: [] as NegocioLista[], hallados: [] as ProductoConNegocio[] });
      const filtros: FiltrosBusqueda = {
        abierto: soloAbiertos,
        categoriaCatalogoId: seccion === 'productos' ? filtroId : null,
        porNombre: plan.porNombre,
      };
      const tipoId = seccion === 'servicios' ? filtroId : null;
      return Promise.all([
        plan.negocios
          ? getNegocios(auth!.token, texto || undefined, 1, tipoId, seccion, filtros).then(p => p.negocios)
          : Promise.resolve([] as NegocioLista[]),
        plan.productos
          ? buscarProductos(auth!.token, texto, null, plan.todosProductos, filtros)
          : Promise.resolve([] as ProductoConNegocio[]),
      ]).then(([halladosNegocios, hallados]) => ({ plan, negocios: halladosNegocios, hallados }));
    },
    [auth, seccion, modo, filtroId, soloAbiertos],
  );

  const cargar = useCallback(
    (texto: string, refresco = false) => {
      const t = texto.trim();
      const turno = ++ultimaPeticion.current;
      refresco ? setRefrescando(true) : setCargando(true);
      setError(null);
      pedir(t)
        .then(r => {
          if (turno !== ultimaPeticion.current) return;
          setNegocios(r.negocios);
          setProductos(r.hallados);
          setVista({ consulta: t, plan: r.plan });
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

  // Trae de nuevo los resultados en pantalla, sin indicadores ni avisos de
  // error, para que un negocio que abre o cierra cambie solo.
  usePolling(() => {
    if (cargando || refrescando || !vista.plan) return;
    const turno = ultimaPeticion.current;
    pedir(vista.consulta)
      .then(r => {
        if (turno !== ultimaPeticion.current) return;
        setNegocios(r.negocios);
        setProductos(r.hallados);
      })
      .catch(() => {});
  }, REFRESCO_NEGOCIOS, ['negocio', 'catalogo', 'resenas']);

  // Solo el teclado espera a que dejen de escribir; los filtros son inmediatos.
  useLectura(() => {
    const espera = busqueda === ultimaBusqueda.current ? 0 : ESPERA_BUSQUEDA;
    ultimaBusqueda.current = busqueda;
    const t = setTimeout(() => cargar(busqueda), espera);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  /** Otro filtro es otra lista: no se deja ver la anterior mientras llega. */
  function alCambiarFiltro() {
    setNegocios([]);
    setProductos([]);
  }

  function elegirFiltro(id: number | null) {
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

  const abrirNegocio = (n: { id: number; nombre: string }, productoId?: number) => {
    // La tienda no maneja el teclado como esta pantalla: se baja antes de ir.
    Keyboard.dismiss();
    navigation.navigate('Negocio', { id: n.id, nombre: n.nombre, seccion, ...(productoId ? { productoId } : {}) });
  };

  const filtrosPuestos = modo !== 'todo' || soloAbiertos || filtroId != null;
  const opcionElegida = opciones.find(o => o.id === filtroId) ?? null;
  const placeholder =
    seccion === 'servicios'
      ? 'Busca negocios o servicios'
      : modo === 'negocios'
        ? 'Busca negocios por su nombre'
        : modo === 'productos'
          ? 'Busca productos'
          : 'Busca negocios o productos';

  function vacio() {
    if (!vista.plan) {
      return {
        titulo: '¿Qué buscas?',
        detalle: seccion === 'servicios'
          ? 'Escribe el nombre de un negocio o un servicio, o elige un filtro.'
          : 'Escribe el nombre de un negocio o un producto, o elige un filtro.',
      };
    }
    if (vista.consulta) {
      return {
        titulo: `No encontramos "${vista.consulta}"`,
        detalle: filtrosPuestos ? 'Prueba con otro nombre o quita algún filtro.' : 'Prueba con otro nombre o producto.',
      };
    }
    const que = modo === 'productos' ? 'productos' : 'negocios';
    if (soloAbiertos) {
      return { titulo: `No hay ${que} abiertos ahora${opcionElegida ? ` en ${opcionElegida.nombre}` : ''}`, detalle: null };
    }
    return { titulo: opcionElegida ? `Aún no hay ${que} en ${opcionElegida.nombre}` : `Aún no hay ${que}`, detalle: null };
  }
  const aviso = vacio();

  return (
    <View style={styles.container}>
      {/* Bajo la hora y la batería, el color de la barra de la app: así los
          íconos claros se leen también de día. */}
      <View style={[styles.franjaEstado, { height: insets.top }]} />

      <View style={styles.cabecera}>
        <PressableScale
          style={styles.atras}
          scaleTo={0.9}
          onPress={salir}
          accessibilityRole="button"
          accessibilityLabel="Volver">
          <Icon name="atras" size={22} color={c.textStrong} />
        </PressableScale>
        <View style={styles.buscador}>
          <Icon name="lupa" size={18} color={c.muted} />
          <TextInput
            ref={buscadorRef}
            style={styles.buscadorTexto}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder={placeholder}
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
      </View>

      <FlatList<Fila>
        style={styles.lista}
        data={filas}
        keyExtractor={fila => fila.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Lo que tapa el teclado, menos la barra de navegación que la
        // pantalla ya deja libre.
        contentContainerStyle={{ paddingBottom: 24 + Math.max(0, altoTeclado - insets.bottom) }}
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
              <FiltroChip texto="Abierto ahora" icono="reloj" activo={soloAbiertos} onPress={() => elegirAbiertos(true)} />
              <FiltroChip texto="Todos" activo={!soloAbiertos} ayuda="Abiertos y cerrados" onPress={() => elegirAbiertos(false)} />
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
                      // Tocar la categoría activa la quita.
                      onPress={() => elegirFiltro(o.id === filtroId ? null : o.id)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
            {cargando && filas.length === 0 && <ActivityIndicator color={c.accent} style={styles.cargando} />}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !cargando && !error ? (
            <SinResultados
              titulo={aviso.titulo}
              detalle={aviso.detalle}
              accion={vista.plan && filtrosPuestos ? 'Quitar filtros' : null}
              onAccion={quitarFiltros}
            />
          ) : null
        }
        renderItem={({ item, index }) => {
          switch (item.tipo) {
            case 'titulo':
              return <Text style={styles.seccion}>{item.texto}</Text>;
            case 'negocio':
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
                  onPress={() => abrirNegocio(negocio, item.producto.id)}
                />
              );
            }
          }
        }}
      />
    </View>
  );
}

const useStyles = makeStyles(c => ({
  container: { flex: 1, backgroundColor: c.bg },
  franjaEstado: { backgroundColor: c.header },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: 20, paddingVertical: 12 },
  atras: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  buscador: {
    flex: 1,
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
  buscadorTexto: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 15,
    color: c.textStrong,
    fontFamily: font.regular,
  },
  lista: { flex: 1 },
  filaChips: { gap: 8, paddingHorizontal: 20, alignItems: 'center' },
  separadorChips: { width: 1, height: 22, backgroundColor: c.border, marginHorizontal: 4 },
  filtrosTitulo: {
    color: c.muted,
    fontFamily: font.medium,
    fontSize: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  seccion: {
    color: c.textStrong,
    fontFamily: font.displaySemi,
    fontSize: 17,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 14,
  },
  cargando: { marginTop: 40 },
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
