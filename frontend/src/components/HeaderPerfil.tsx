/**
 * Botón "Mi perfil" de la topbar (parte superior derecha), visible para
 * TODOS los roles. Solo muestra el ícono de la persona; al tocarlo despliega
 * justo debajo el menú de la cuenta PERSONAL (la persona, no el negocio), sin
 * cambiar de pantalla: recuadros pequeños con "Mi información", "Mis
 * negocios" y "Privacidad", y al final "Cerrar sesión". El domiciliario
 * tiene además "Mis entregas", y al cliente que aún no lo es se le ofrece
 * "Ser domiciliario" en un recuadro destacado.
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
import { ApiError, hacerseDomiciliario } from '../api';
import { useAuth } from '../AuthContext';
import { WEB_URL } from '../config';
import { messageFromError } from '../formErrors';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { PressableScale } from './anim';
import { useConfirmar } from './Confirmacion';
import { desenfocarApp } from './Desenfoque';
import HeaderConfiabilidad from './HeaderConfiabilidad';
import HeaderTurno from './HeaderTurno';
import Icon, { IconName } from './Icon';

type Modulo = {
  titulo: string;
  icono: IconName;
  abrir: () => void;
  /** Línea pequeña bajo el título (solo en el recuadro destacado). */
  detalle?: string;
  destacado?: boolean;
};

/** Módulos del menú según la cuenta. */
function modulosPara(roles: string[], serDomiciliario: () => void): Modulo[] {
  const modulos: Modulo[] = [
    { titulo: 'Mi información', icono: 'usuario', abrir: () => navigationRef.navigate('MiInformacion') },
    { titulo: 'Mis negocios', icono: 'tienda', abrir: () => navigationRef.navigate('MisNegocios') },
  ];
  if (roles.includes('domiciliario')) {
    // Sus entregas van en el Inicio, bajo el saludo.
    modulos.push({ titulo: 'Mis entregas', icono: 'moto', abrir: () => navigationRef.navigate('Home') });
  }
  // Política de privacidad: página pública del servidor.
  modulos.push({ titulo: 'Privacidad', icono: 'escudo', abrir: () => Linking.openURL(`${WEB_URL}/privacidad`) });
  if (roles.includes('usuario') && !roles.includes('domiciliario')) {
    modulos.push({
      titulo: 'Ser domiciliario',
      detalle: 'Lleva pedidos de los negocios a los clientes',
      icono: 'moto',
      abrir: serDomiciliario,
      destacado: true,
    });
  }
  return modulos;
}

/** Posición del botón en la ventana: el menú se ancla debajo de él. */
type Ancla = { x: number; y: number; w: number; h: number };

const ANCHO_MENU = 240;

export default function HeaderPerfil() {
  const { c } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const boton = useRef<View>(null);
  const [ancla, setAncla] = useState<Ancla | null>(null);
  const { auth, actualizarUsuario } = useAuth();
  const toast = useToast();
  const confirmar = useConfirmar();

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

  /** "Ser domiciliario": se confirma y, ya activo, lleva al Inicio, donde van las entregas. */
  function serDomiciliario() {
    confirmar({
      icono: 'moto',
      titulo: '¿Quieres ser domiciliario?',
      texto: 'Lleva pedidos de los negocios a los clientes de tu ciudad.',
      puntos: [
        { icono: 'usuario', texto: 'Sigues siendo cliente: puedes comprar como siempre.' },
        { icono: 'moto', texto: 'Mantén presionada la moto de arriba para entrar en turno y recibir pedidos.' },
        { icono: 'escudo', texto: 'Tu confiabilidad sube cuando entregas a tiempo.' },
      ],
      textoBoton: 'Quiero ser domiciliario',
      accion: activarDomiciliario,
    });
  }

  async function activarDomiciliario() {
    if (!auth) return;
    try {
      const r = await hacerseDomiciliario(auth.token);
      actualizarUsuario(r.user);
      toast.exito('¡Ya eres domiciliario!', 'Mantén presionada la moto para entrar en turno.');
      if (navigationRef.isReady()) navigationRef.navigate('Home');
    } catch (e) {
      // Sin teléfono no se activa: lo lleva a donde lo agrega.
      if (e instanceof ApiError && e.status === 422) {
        toast.info('Falta tu teléfono', 'Agrégalo aquí y vuelve a intentarlo.');
        if (navigationRef.isReady()) navigationRef.navigate('MiInformacion');
        return;
      }
      toast.error('No se pudo activar', messageFromError(e, 'Error'));
    }
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
      {ancla && (
        <MenuPerfil ancla={ancla} onSerDomiciliario={serDomiciliario} onCerrado={() => setAncla(null)} />
      )}
    </View>
  );
}

/**
 * Menú desplegable anclado bajo el botón. La caja entra suave (fundido +
 * escala desde la esquina del ícono) y se despliega hacia abajo mientras sus
 * renglones caen en cascada, uno tras otro; detrás, la app se pone borrosa
 * menos el botón, que queda nítido. Se recoge con la misma animación al revés
 * (tocar fuera, el botón, "atrás" o elegir un módulo, que se abre cuando el
 * menú termina de recogerse).
 */
function MenuPerfil({
  ancla,
  onSerDomiciliario,
  onCerrado,
}: {
  ancla: Ancla;
  onSerDomiciliario: () => void;
  onCerrado: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const { auth, salir } = useAuth();
  const user = auth?.user;
  // Fijos mientras el menú está abierto: cada renglón tiene su valor de cascada.
  const [modulos] = useState(() => modulosPara(user?.roles ?? [], onSerDomiciliario));
  const a = useRef(new Animated.Value(0)).current;
  // Alto real de la lista (medido) y cuánto lleva desplegada la caja.
  const [alto, setAlto] = useState(0);
  const despliegue = useRef(new Animated.Value(0)).current;
  // Un valor por renglón (cabecera, módulos y "Cerrar sesión") para la cascada.
  const filas = useRef(Array.from({ length: modulos.length + 2 }, () => new Animated.Value(0))).current;
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

  /** Recoge el menú y, al terminar, abre el módulo. */
  function elegir(accion: () => void) {
    if (cerrando.current || !navigationRef.isReady()) return;
    cerrar(accion);
  }

  const ancho = Math.min(ANCHO_MENU, width - 24);
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
          accessibilityLabel="Mi perfil"
          accessibilityState={{ expanded: true }}
          onPress={() => cerrar()}>
          <Icon name="usuario" size={18} color={c.onHeader} strokeWidth={2} />
        </PressableScale>
      </View>
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
    
              {modulos.map((m, i) => (
                <Cascada key={m.titulo} v={filas[i + 1]}>
                  <PressableScale
                    style={[styles.modulo, m.destacado && styles.destacado]}
                    accessibilityRole="button"
                    accessibilityHint={m.detalle}
                    onPress={() => elegir(m.abrir)}>
                    <View style={[styles.moduloIcono, m.destacado && styles.destacadoIcono]}>
                      <Icon name={m.icono} size={18} color={m.destacado ? c.onAccent : c.accent} strokeWidth={2} />
                    </View>
                    <View style={styles.moduloTexto}>
                      <Text style={styles.moduloTxt}>{m.titulo}</Text>
                      {!!m.detalle && <Text style={styles.moduloDetalle}>{m.detalle}</Text>}
                    </View>
                  </PressableScale>
                </Cascada>
              ))}

              <Cascada v={filas[modulos.length + 1]}>
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
  botonNitido: { position: 'absolute', borderRadius: radius.pill, backgroundColor: c.header },
  // Menú desplegable
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
  moduloTexto: { flex: 1 },
  moduloTxt: { fontSize: 14, fontFamily: font.semibold, color: c.textStrong },
  moduloDetalle: { fontSize: 11.5, lineHeight: 15, fontFamily: font.regular, color: c.muted, marginTop: 1 },
  // "Ser domiciliario": invita a repartir, en el color de la marca.
  destacado: { backgroundColor: c.accentSoft, borderColor: c.accent, marginTop: 4 },
  destacadoIcono: { backgroundColor: c.accent },
  // "Cerrar sesión" cierra la lista, en rojo.
  salir: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft, marginTop: 4 },
  salirIcono: { backgroundColor: c.surface },
  salirTxt: { color: c.danger, fontFamily: font.bold },
}));
