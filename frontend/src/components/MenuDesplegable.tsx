/**
 * Botón redondo de la topbar que, al tocarlo, despliega justo debajo un menú
 * en recuadros pequeños, sin cambiar de pantalla. Lo usan "Mi perfil"
 * (HeaderPerfil) y "Mis negocios" (HeaderNegocios).
 *
 * La caja entra suave (fundido + escala desde la esquina del ícono) y se
 * despliega hacia abajo mientras sus renglones caen en cascada, uno tras
 * otro; detrás, la app se pone borrosa menos el botón, que queda nítido. Se
 * recoge con la misma animación al revés (tocar fuera, el botón, "atrás" o
 * elegir una opción, que se abre cuando el menú termina de recogerse).
 *
 * Los menús se pintan en CapaMenus, encima de toda la app. En cuanto uno
 * empieza a recogerse deja pasar los toques: se puede tocar enseguida otro
 * botón de la topbar sin esperar a que termine la animación.
 *
 * Con `texto` el botón es una píldora con nombre (los filtros del Mapa), y
 * con OpcionCheck el menú sirve para marcar varias opciones sin cerrarse.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import { desenfocarApp } from './Desenfoque';
import Icon, { IconName } from './Icon';

/** Recoge el menú y, cuando termina, corre la acción de la opción elegida. */
export type Elegir = (accion: () => void) => void;

type Props = {
  icono: IconName;
  /** Sin texto visible: el lector de pantalla anuncia esta etiqueta. */
  etiqueta: string;
  /**
   * Renglones del menú, de arriba abajo. Se arman al abrirlo y quedan fijos
   * mientras está abierto (cada uno tiene su valor de cascada).
   */
  renglones: (elegir: Elegir) => React.ReactNode[];
  ancho?: number;
  /** Con texto: píldora clara con nombre y flecha (sobre el mapa), no un ícono de la topbar. */
  texto?: string;
  /** Hacia dónde crece el menú desde el botón (por defecto, hacia la izquierda: bordes derechos alineados). */
  alinear?: 'derecha' | 'izquierda';
};

/**
 * Posición del botón en la ventana: el menú se ancla debajo de él. `n`
 * distingue cada apertura (si se reabre mientras se recoge, es otro menú).
 */
type Ancla = { x: number; y: number; w: number; h: number; n: number };

type Capa = {
  mostrar: (n: number, menu: React.ReactNode) => void;
  quitar: (n: number) => void;
  /** Esquina de la capa en la ventana (las medidas de los botones son de la ventana). */
  origen: React.MutableRefObject<{ x: number; y: number }>;
};

const CapaContext = createContext<Capa | null>(null);

let aperturas = 0;

/**
 * Capa sobre toda la app donde se pintan los menús abiertos. Va FUERA de la
 * parte que se desenfoca (AppDesenfocable, en App.tsx), así el menú queda
 * nítido. No es un Modal a propósito: el Modal es otra ventana y se traga
 * los toques hasta que el menú termina de recogerse.
 */
export function CapaMenus({ children }: { children: React.ReactNode }) {
  const [menus, setMenus] = useState<{ n: number; menu: React.ReactNode }[]>([]);
  const capa = useRef<View>(null);
  const origen = useRef({ x: 0, y: 0 });
  const api = useMemo<Capa>(
    () => ({
      mostrar: (n, menu) => setMenus(lista => [...lista, { n, menu }]),
      quitar: n => setMenus(lista => lista.filter(m => m.n !== n)),
      origen,
    }),
    [],
  );

  function medir() {
    capa.current?.measureInWindow((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        origen.current = { x, y };
      }
    });
  }

  return (
    <CapaContext.Provider value={api}>
      {children}
      <View ref={capa} style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false} onLayout={medir}>
        {menus.map(m => (
          <React.Fragment key={m.n}>{m.menu}</React.Fragment>
        ))}
      </View>
    </CapaContext.Provider>
  );
}

export default function MenuDesplegable(props: Props) {
  const { icono, etiqueta } = props;
  const { width } = useWindowDimensions();
  const capa = useContext(CapaContext);
  const boton = useRef<View>(null);
  const [ancla, setAncla] = useState<Ancla | null>(null);
  // Los renglones se arman al abrir, con los datos de ese momento.
  const ultimas = useRef(props);
  ultimas.current = props;

  function abrir() {
    const n = ++aperturas;
    const nodo = boton.current;
    // Sin medida (p. ej. en pruebas): esquina superior derecha.
    const respaldo = { x: width - 46, y: 10, w: 34, h: 34, n };
    if (!nodo) {
      setAncla(respaldo);
      return;
    }
    nodo.measureInWindow((x, y, w, h) =>
      setAncla(Number.isFinite(x) && Number.isFinite(y) && w > 0 ? { x, y, w, h, n } : respaldo),
    );
  }

  // El menú abierto vive en la capa mientras haya ancla.
  useEffect(() => {
    if (!ancla || !capa) {
      return;
    }
    const actuales = ultimas.current;
    capa.mostrar(
      ancla.n,
      <Menu
        ancla={ancla}
        icono={actuales.icono}
        etiqueta={actuales.etiqueta}
        renglones={actuales.renglones}
        ancho={actuales.ancho ?? 240}
        texto={actuales.texto}
        alinear={actuales.alinear}
        // Solo si sigue siendo este menú (no otro abierto mientras se recogía).
        onCerrado={() => setAncla(a => (a === ancla ? null : a))}
      />,
    );
    return () => capa.quitar(ancla.n);
  }, [ancla, capa]);

  return (
    // PressableScale no reenvía la ref: este View es el que se mide.
    <View ref={boton} collapsable={false}>
      <BotonMenu icono={icono} etiqueta={etiqueta} texto={props.texto} abierto={!!ancla} onPress={abrir} />
    </View>
  );
}

/** El botón que abre el menú: ícono redondo de la topbar, o píldora con texto. */
function BotonMenu({
  icono,
  etiqueta,
  texto,
  abierto,
  onPress,
}: {
  icono: IconName;
  etiqueta: string;
  texto?: string;
  abierto: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  if (texto) {
    return (
      <PressableScale
        style={styles.pildora}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityState={{ expanded: abierto }}
        onPress={onPress}>
        <Icon name={icono} size={16} color={c.accent} strokeWidth={2} />
        <Text style={styles.pildoraTxt} numberOfLines={1}>
          {texto}
        </Text>
        <View style={abierto ? styles.flechaArriba : styles.flechaAbajo}>
          <Icon name="chevron" size={14} color={c.muted} strokeWidth={2.2} />
        </View>
      </PressableScale>
    );
  }
  return (
    <PressableScale
      style={styles.boton}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ expanded: abierto }}
      onPress={onPress}>
      <Icon name={icono} size={18} color={c.onHeader} strokeWidth={2} />
    </PressableScale>
  );
}

type MenuProps = Omit<Props, 'ancho'> & { ancho: number; ancla: Ancla; onCerrado: () => void };

function Menu({ ancla, icono, etiqueta, renglones, ancho, texto, alinear, onCerrado }: MenuProps) {
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const capa = useContext(CapaContext);
  // Fijos mientras el menú está abierto.
  const [contenido] = useState(() => renglones(elegir).filter(Boolean));
  const a = useRef(new Animated.Value(0)).current;
  // Alto real de la lista (medido) y cuánto lleva desplegada la caja.
  const [alto, setAlto] = useState(0);
  const despliegue = useRef(new Animated.Value(0)).current;
  // Un valor por renglón para la cascada.
  const filas = useRef(contenido.map(() => new Animated.Value(0))).current;
  const empezado = useRef(false);
  const cerrando = useRef(false);
  // Al recogerse deja pasar los toques a la app (y a los otros botones).
  const [saliendo, setSaliendo] = useState(false);

  // Si el menú desaparece de golpe (p. ej. al cerrar sesión), la app no
  // queda borrosa. Si ya se estaba recogiendo no se toca: quizá ya se abrió
  // otro menú, que es el que la tiene borrosa.
  useEffect(
    () => () => {
      if (!cerrando.current) {
        desenfocarApp(false);
      }
    },
    [],
  );

  // "Atrás" recoge el menú; si ya se está recogiendo, sigue la navegación.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cerrando.current) {
        return false;
      }
      cerrar();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Entrada: arranca cuando ya se conoce el alto, para desplegar sin saltos. */
  function entrar() {
    const suave = Easing.out(Easing.cubic);
    desenfocarApp(true);
    Animated.parallel([
      // La caja asoma rápido, aún pequeña, y luego se despliega hacia abajo
      // al ritmo de los renglones. `height` no admite el driver nativo.
      Animated.timing(a, { toValue: 1, duration: 160, easing: suave, useNativeDriver: true }),
      Animated.timing(despliegue, {
        toValue: 1,
        duration: 500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      // Los renglones arrancan cuando la caja ya asoma, cada uno 60 ms después.
      Animated.sequence([
        Animated.delay(80),
        Animated.stagger(
          60,
          filas.map(v =>
            Animated.timing(v, { toValue: 1, duration: 300, easing: suave, useNativeDriver: true }),
          ),
        ),
      ]),
    ]).start();
  }

  /**
   * Salida: la entrada al revés y algo más rápida. Los renglones suben y se
   * desvanecen de abajo hacia arriba mientras la caja se recoge hacia el
   * ícono, y al final se desvanece la franja que queda. Luego corre `despues`.
   * Desde el primer momento deja pasar los toques.
   */
  function cerrar(despues?: () => void) {
    if (cerrando.current) return;
    cerrando.current = true;
    setSaliendo(true);
    desenfocarApp(false);
    const rapido = Easing.in(Easing.cubic);
    Animated.parallel([
      Animated.stagger(
        40,
        [...filas].reverse().map(v =>
          Animated.timing(v, { toValue: 0, duration: 200, easing: rapido, useNativeDriver: true }),
        ),
      ),
      Animated.timing(despliegue, {
        toValue: 0,
        duration: 400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(a, { toValue: 0, duration: 120, easing: rapido, useNativeDriver: true }),
      ]),
    ]).start(() => {
      onCerrado();
      despues?.();
    });
  }

  /** Recoge el menú y, al terminar, abre la opción. */
  function elegir(accion: () => void) {
    if (cerrando.current || !navigationRef.isReady()) return;
    cerrar(accion);
  }

  // Del botón medido en la ventana a la capa.
  const origen = capa?.origen.current ?? { x: 0, y: 0 };
  const x = ancla.x - origen.x;
  const y = ancla.y - origen.y;
  const anchoMenu = Math.min(ancho, width - 24);
  // Un borde del menú alineado con el del botón; el pico apunta a su centro.
  let borde: { left: number } | { right: number };
  let pico: { left: number } | { right: number };
  if (alinear === 'izquierda') {
    const izquierda = Math.max(12, Math.min(x, width - 12 - anchoMenu));
    borde = { left: izquierda };
    pico = { left: Math.max(14, x + ancla.w / 2 - izquierda - 7) };
  } else {
    const derecha = Math.max(12, width - (x + ancla.w));
    borde = { right: derecha };
    pico = { right: Math.max(14, width - (x + ancla.w / 2) - derecha - 7) };
  }
  const top = y + ancla.h + 10;
  // Una lista larga (los tipos de negocio) no se sale de la pantalla: se desliza.
  const altoMax = Math.max(120, height - top - 40);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const altoVisible = despliegue.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(alto, altoMax)] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={saliendo ? 'none' : 'box-none'}>
      {/* Tocar fuera del menú lo cierra (el fondo no se oscurece: se desenfoca). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => cerrar()} accessibilityLabel="Cerrar menú" />
      {/* El desenfoque alcanza toda la app, botón incluido: encima va una
          copia nítida en el mismo sitio, sobre un círculo del color de la
          topbar que tapa al original (su fondo es translúcido). */}
      <View
        style={[
          styles.botonNitido,
          texto ? styles.sinFondo : null,
          { left: x, top: y, width: ancla.w, height: ancla.h },
        ]}>
        <BotonMenu icono={icono} etiqueta={etiqueta} texto={texto} abierto onPress={() => cerrar()} />
      </View>
      <Animated.View
        style={[
          styles.menu,
          alinear === 'izquierda' && styles.menuIzquierda,
          {
            top,
            ...borde,
            width: anchoMenu,
            opacity: a,
            transform: [{ translateY }, { scale }],
          },
        ]}>
        <View style={[styles.pico, pico]} />
        <View style={styles.caja}>
          {/* La lista se mide en una capa absoluta y la caja crece hasta su
              alto (o hasta altoMax: entonces se desliza). */}
          <Animated.View style={[styles.lista, { height: altoVisible }]}>
            <ScrollView
              style={[styles.listaScroll, { maxHeight: altoMax }]}
              contentContainerStyle={styles.listaContenido}
              scrollEnabled={alto > altoMax}
              showsVerticalScrollIndicator={alto > altoMax}
              onContentSizeChange={(_, h) => {
                setAlto(h);
                // Si se cerró antes de medirse, ya no entra.
                if (h > 0 && !empezado.current && !cerrando.current) {
                  empezado.current = true;
                  entrar();
                }
              }}>
              {contenido.map((renglon, i) => (
                <Cascada key={i} v={filas[i]}>
                  {renglon}
                </Cascada>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

/** Renglón del menú que cae a su lugar con un fundido (entrada en cascada). */
function Cascada({ v, children }: { v: Animated.Value; children: React.ReactNode }) {
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });
  return <Animated.View style={{ opacity: v, transform: [{ translateY }] }}>{children}</Animated.View>;
}

type OpcionProps = {
  icono: IconName;
  titulo: string;
  /** Línea pequeña bajo el título. */
  detalle?: string;
  /**
   * `destacado`: una invitación, en el color de la marca ("Ser domiciliario").
   * `peligro`: cierra la lista, en rojo ("Cerrar sesión").
   */
  variante?: 'destacado' | 'peligro';
  /** La opción vigente (p. ej. el negocio que se gestiona): borde y check. */
  activa?: boolean;
  onPress: () => void;
};

/** Un recuadro del menú: ícono, título y, si hace falta, una línea de detalle. */
export function OpcionMenu({ icono, titulo, detalle, variante, activa, onPress }: OpcionProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const destacado = variante === 'destacado';
  const peligro = variante === 'peligro';
  return (
    <PressableScale
      style={[styles.opcion, destacado && styles.destacado, peligro && styles.peligro, activa && styles.activa]}
      accessibilityRole="button"
      accessibilityHint={detalle}
      accessibilityState={{ selected: !!activa }}
      onPress={onPress}>
      <View style={[styles.opcionIcono, destacado && styles.destacadoIcono, peligro && styles.peligroIcono]}>
        <Icon
          name={icono}
          size={18}
          color={peligro ? c.danger : destacado ? c.onAccent : c.accent}
          strokeWidth={2}
        />
      </View>
      <View style={styles.opcionTexto}>
        <Text style={[styles.opcionTxt, peligro && styles.peligroTxt]} numberOfLines={1}>
          {titulo}
        </Text>
        {!!detalle && <Text style={styles.opcionDetalle}>{detalle}</Text>}
      </View>
      {activa && <Icon name="check" size={18} color={c.success} strokeWidth={2} />}
    </PressableScale>
  );
}

/**
 * Valor compartido entre la pantalla y un menú abierto. Los renglones se
 * arman una sola vez al abrir: los que cambian mientras está abierto (los
 * checks) leen de aquí con useAlmacen.
 */
export type Almacen<T> = { get(): T; set(v: T): void; subscribe(f: () => void): () => void };

export function crearAlmacen<T>(inicial: T): Almacen<T> {
  let valor = inicial;
  const oyentes = new Set<() => void>();
  return {
    get: () => valor,
    set: v => {
      valor = v;
      oyentes.forEach(f => f());
    },
    subscribe: f => {
      oyentes.add(f);
      return () => {
        oyentes.delete(f);
      };
    },
  };
}

export function useAlmacen<T>(almacen: Almacen<T>): T {
  return useSyncExternalStore(almacen.subscribe, almacen.get);
}

/** Renglón con casilla: se marca y desmarca sin cerrar el menú. */
export function OpcionCheck({ titulo, marcada, onPress }: { titulo: string; marcada: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale
      style={[styles.opcion, styles.opcionCheck, marcada && styles.activa]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      onPress={onPress}>
      <View style={[styles.casilla, marcada && styles.casillaMarcada]}>
        {marcada && <Icon name="check" size={14} color={c.onAccent} strokeWidth={3} />}
      </View>
      <Text style={[styles.opcionTxt, styles.opcionTexto]} numberOfLines={1}>
        {titulo}
      </Text>
    </PressableScale>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  boton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  botonNitido: { position: 'absolute', borderRadius: radius.pill, backgroundColor: c.header },
  sinFondo: { backgroundColor: 'transparent' },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadow.card,
  },
  pildoraTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 13.5, maxWidth: 160 },
  flechaAbajo: { transform: [{ rotate: '90deg' }] },
  flechaArriba: { transform: [{ rotate: '-90deg' }] },
  // Crece desde la esquina del ícono.
  menu: { position: 'absolute', transformOrigin: 'top right' },
  menuIzquierda: { transformOrigin: 'top left' },
  // Pico que une el menú con el ícono (queda medio oculto tras la caja).
  pico: {
    position: 'absolute', top: -6, width: 14, height: 14, borderRadius: 3,
    backgroundColor: c.surface, transform: [{ rotate: '45deg' }],
  },
  caja: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 10, ...shadow.card },
  lista: { overflow: 'hidden' },
  listaScroll: { position: 'absolute', top: 0, left: 0, right: 0 },
  listaContenido: { gap: 8 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radius.md, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
  },
  opcionIcono: {
    width: 30, height: 30, borderRadius: radius.sm, backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  opcionTexto: { flex: 1 },
  opcionTxt: { fontSize: 14, fontFamily: font.semibold, color: c.textStrong },
  opcionDetalle: { fontSize: 11.5, lineHeight: 15, fontFamily: font.regular, color: c.muted, marginTop: 1 },
  activa: { borderColor: c.accent },
  opcionCheck: { paddingVertical: 10 },
  casilla: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  casillaMarcada: { backgroundColor: c.accent, borderColor: c.accent },
  destacado: { backgroundColor: c.accentSoft, borderColor: c.accent, marginTop: 4 },
  destacadoIcono: { backgroundColor: c.accent },
  peligro: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft, marginTop: 4 },
  peligroIcono: { backgroundColor: c.surface },
  peligroTxt: { color: c.danger, fontFamily: font.bold },
}));
