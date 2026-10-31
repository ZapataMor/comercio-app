/**
 * Botón "Mi perfil" de la topbar (parte superior derecha), visible para
 * TODOS los roles. Solo muestra el ícono de la persona; al tocarlo despliega
 * justo debajo el menú de la cuenta PERSONAL (la persona, no el negocio), sin
 * cambiar de pantalla: recuadros pequeños con "Mi información", "Mis
 * negocios" y "Privacidad", y al final "Cerrar sesión".
 *
 * Al domiciliario se le muestran al lado su nivel de confiabilidad
 * (HeaderConfiabilidad) y su turno (HeaderTurno).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { WEB_URL } from '../config';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import HeaderConfiabilidad from './HeaderConfiabilidad';
import HeaderTurno from './HeaderTurno';
import Icon, { IconName } from './Icon';

type Modulo = { titulo: string; icono: IconName; abrir: () => void };

const MODULOS: Modulo[] = [
  { titulo: 'Mi información', icono: 'usuario', abrir: () => navigationRef.navigate('MiInformacion') },
  { titulo: 'Mis negocios', icono: 'tienda', abrir: () => navigationRef.navigate('MisNegocios') },
  // Política de privacidad: página pública del servidor.
  { titulo: 'Privacidad', icono: 'escudo', abrir: () => Linking.openURL(`${WEB_URL}/privacidad`) },
];

/** Posición del botón en la ventana: el menú se ancla debajo de él. */
type Ancla = { x: number; y: number; w: number; h: number };

const ANCHO_MENU = 240;

export default function HeaderPerfil() {
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
    <View style={styles.fila}>
      <HeaderConfiabilidad />
      <HeaderTurno />
      {/* PressableScale no reenvía la ref: este View es el que se mide. */}
      <View ref={boton} collapsable={false}>
        <PressableScale
          style={styles.boton}
          hitSlop={8}
          // Sin texto visible: el lector de pantalla anuncia "Mi perfil".
          accessibilityRole="button"
          accessibilityLabel="Mi perfil"
          accessibilityState={{ expanded: !!ancla }}
          onPress={abrir}>
          <Icon name="usuario" size={18} color={c.onHeader} strokeWidth={2} />
        </PressableScale>
      </View>
      {ancla && <MenuPerfil ancla={ancla} onCerrado={() => setAncla(null)} />}
    </View>
  );
}

/**
 * Menú desplegable anclado bajo el botón. La caja entra suave (fundido +
 * escala desde la esquina del ícono) y sus renglones caen en cascada, uno
 * tras otro. Sale con un fundido; tocar fuera o "atrás" lo cierra.
 */
function MenuPerfil({ ancla, onCerrado }: { ancla: Ancla; onCerrado: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const { auth, salir } = useAuth();
  const user = auth?.user;
  const a = useRef(new Animated.Value(0)).current;
  // Un valor por renglón (cabecera, módulos y "Cerrar sesión") para la cascada.
  const filas = useRef(Array.from({ length: MODULOS.length + 2 }, () => new Animated.Value(0))).current;
  const cerrando = useRef(false);

  useEffect(() => {
    const suave = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 260, easing: suave, useNativeDriver: true }),
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
  }, [a, filas]);

  function cerrar() {
    if (cerrando.current) return;
    cerrando.current = true;
    Animated.timing(a, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onCerrado());
  }

  /** Abre el módulo de una vez (sin esperar la salida del menú). */
  function elegir(accion: () => void) {
    if (cerrando.current || !navigationRef.isReady()) return;
    accion();
    cerrar();
  }

  const ancho = Math.min(ANCHO_MENU, width - 24);
  // Borde derecho del menú alineado con el del botón; el pico apunta a su centro.
  const derecha = Math.max(12, width - (ancla.x + ancla.w));
  const pico = Math.max(14, width - (ancla.x + ancla.w / 2) - derecha - 7);
  const opacidadFondo = a.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={cerrar}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, { opacity: opacidadFondo }]} />
      {/* Tocar fuera del menú lo cierra. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} accessibilityLabel="Cerrar menú" />
      <Animated.View
        style={[
          styles.menu,
          {
            top: ancla.y + ancla.h + 10,
            right: derecha,
            width: ancho,
            opacity: a,
            transform: [{ translateY }, { scale }],
          },
        ]}>
        <View style={[styles.pico, { right: pico }]} />
        <View style={styles.caja}>
          {!!user && (
            <Cascada v={filas[0]}>
              <View style={styles.cabecera}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.cabeceraTexto}>
                  <Text style={styles.nombre} numberOfLines={1}>
                    {[user.name, user.apellidos].filter(Boolean).join(' ')}
                  </Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
              </View>
            </Cascada>
          )}

          {MODULOS.map((m, i) => (
            <Cascada key={m.titulo} v={filas[i + 1]}>
              <PressableScale style={styles.modulo} accessibilityRole="button" onPress={() => elegir(m.abrir)}>
                <View style={styles.moduloIcono}>
                  <Icon name={m.icono} size={18} color={c.accent} strokeWidth={2} />
                </View>
                <Text style={styles.moduloTxt}>{m.titulo}</Text>
              </PressableScale>
            </Cascada>
          ))}

          <Cascada v={filas[MODULOS.length + 1]}>
            <PressableScale
              style={[styles.modulo, styles.salir]}
              accessibilityRole="button"
              onPress={() => elegir(salir)}>
              <View style={[styles.moduloIcono, styles.salirIcono]}>
                <Icon name="salir" size={18} color={c.danger} strokeWidth={2} />
              </View>
              <Text style={[styles.moduloTxt, styles.salirTxt]}>Cerrar sesión</Text>
            </PressableScale>
          </Cascada>
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

const useStyles = makeStyles((c, shadow) => ({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  // Menú desplegable
  fondo: { backgroundColor: c.scrim },
  // Crece desde la esquina del ícono.
  menu: { position: 'absolute', transformOrigin: 'top right' },
  // Pico que une el menú con el ícono (queda medio oculto tras la caja).
  pico: {
    position: 'absolute', top: -6, width: 14, height: 14, borderRadius: 3,
    backgroundColor: c.surface, transform: [{ rotate: '45deg' }],
  },
  caja: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 10, gap: 8, ...shadow.card },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingBottom: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: c.onAccent, fontFamily: font.displayExtra, fontSize: 15 },
  cabeceraTexto: { flex: 1 },
  nombre: { fontSize: 14, fontFamily: font.bold, color: c.textStrong },
  email: { fontSize: 12, fontFamily: font.regular, color: c.muted, marginTop: 1 },
  modulo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radius.md, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
  },
  moduloIcono: {
    width: 30, height: 30, borderRadius: radius.sm, backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  moduloTxt: { flex: 1, fontSize: 14, fontFamily: font.semibold, color: c.textStrong },
  // "Cerrar sesión" cierra la lista, en rojo.
  salir: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft, marginTop: 4 },
  salirIcono: { backgroundColor: c.surface },
  salirTxt: { color: c.danger, fontFamily: font.bold },
}));
