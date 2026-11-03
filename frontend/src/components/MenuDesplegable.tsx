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
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
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
};

/** Posición del botón en la ventana: el menú se ancla debajo de él. */
type Ancla = { x: number; y: number; w: number; h: number };

export default function MenuDesplegable({ icono, etiqueta, renglones, ancho = 240 }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const boton = useRef<View>(null);
  const [ancla, setAncla] = useState<Ancla | null>(null);

  function abrir() {
    const nodo = boton.current;
    // Sin medida (p. ej. en pruebas): esquina superior derecha.
    const respaldo = { x: width - 46, y: 10, w: 34, h: 34 };
    if (!nodo) {
      setAncla(respaldo);
      return;
    }
    nodo.measureInWindow((x, y, w, h) =>
      setAncla(Number.isFinite(x) && Number.isFinite(y) && w > 0 ? { x, y, w, h } : respaldo),
    );
  }

  return (
    // PressableScale no reenvía la ref: este View es el que se mide.
    <View ref={boton} collapsable={false}>
      <PressableScale
        style={styles.boton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityState={{ expanded: !!ancla }}
        onPress={abrir}>
        <Icon name={icono} size={18} color={c.onHeader} strokeWidth={2} />
      </PressableScale>
      {ancla && (
        <Menu
          ancla={ancla}
          icono={icono}
          etiqueta={etiqueta}
          renglones={renglones}
          ancho={ancho}
          onCerrado={() => setAncla(null)}
        />
      )}
    </View>
  );
}

function Menu({
  ancla,
  icono,
  etiqueta,
  renglones,
  ancho,
  onCerrado,
}: Required<Props> & { ancla: Ancla; onCerrado: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
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

  // Si el menú desaparece de golpe (p. ej. al cerrar sesión), la app no
  // queda borrosa.
  useEffect(() => () => desenfocarApp(false), []);

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
   */
  function cerrar(despues?: () => void) {
    if (cerrando.current) return;
    cerrando.current = true;
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

  const anchoMenu = Math.min(ancho, width - 24);
  // Borde derecho del menú alineado con el del botón; el pico apunta a su centro.
  const derecha = Math.max(12, width - (ancla.x + ancla.w));
  const pico = Math.max(14, width - (ancla.x + ancla.w / 2) - derecha - 7);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const altoVisible = despliegue.interpolate({ inputRange: [0, 1], outputRange: [0, alto] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => cerrar()}>
      {/* Tocar fuera del menú lo cierra (el fondo no se oscurece: se desenfoca). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => cerrar()} accessibilityLabel="Cerrar menú" />
      {/* El desenfoque alcanza toda la app, botón incluido: encima va una
          copia nítida en el mismo sitio, sobre un círculo del color de la
          topbar que tapa al original (su fondo es translúcido). */}
      <View style={[styles.botonNitido, { left: ancla.x, top: ancla.y, width: ancla.w, height: ancla.h }]}>
        <PressableScale
          style={styles.boton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={etiqueta}
          accessibilityState={{ expanded: true }}
          onPress={() => cerrar()}>
          <Icon name={icono} size={18} color={c.onHeader} strokeWidth={2} />
        </PressableScale>
      </View>
      <Animated.View
        style={[
          styles.menu,
          {
            top: ancla.y + ancla.h + 10,
            right: derecha,
            width: anchoMenu,
            opacity: a,
            transform: [{ translateY }, { scale }],
          },
        ]}>
        <View style={[styles.pico, { right: pico }]} />
        <View style={styles.caja}>
          {/* La lista se mide en una capa absoluta y la caja crece hasta su alto. */}
          <Animated.View style={[styles.lista, { height: altoVisible }]}>
            <View
              style={styles.listaContenido}
              onLayout={e => {
                setAlto(e.nativeEvent.layout.height);
                // Si se cerró antes de medirse, ya no entra.
                if (!empezado.current && !cerrando.current) {
                  empezado.current = true;
                  entrar();
                }
              }}>
              {contenido.map((renglon, i) => (
                <Cascada key={i} v={filas[i]}>
                  {renglon}
                </Cascada>
              ))}
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
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
  // Crece desde la esquina del ícono.
  menu: { position: 'absolute', transformOrigin: 'top right' },
  // Pico que une el menú con el ícono (queda medio oculto tras la caja).
  pico: {
    position: 'absolute', top: -6, width: 14, height: 14, borderRadius: 3,
    backgroundColor: c.surface, transform: [{ rotate: '45deg' }],
  },
  caja: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 10, ...shadow.card },
  lista: { overflow: 'hidden' },
  listaContenido: { position: 'absolute', top: 0, left: 0, right: 0, gap: 8 },
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
  destacado: { backgroundColor: c.accentSoft, borderColor: c.accent, marginTop: 4 },
  destacadoIcono: { backgroundColor: c.accent },
  peligro: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft, marginTop: 4 },
  peligroIcono: { backgroundColor: c.surface },
  peligroTxt: { color: c.danger, fontFamily: font.bold },
}));
