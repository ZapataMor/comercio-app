/**
 * «¿No sabes cómo hacer algo? Pulsa aquí»: un aviso que aparece abajo cuando
 * la persona parece trabada (ver tropiezos.ts). Es temporal como los demás:
 * su borde se llena como barra de carga y se quita deslizándolo a la derecha.
 *
 * Al pulsarlo, o desde «¿Cómo se usa?» en el menú del perfil, se abre la lista
 * de acciones; al elegir una, la app lleva a su pantalla y muestra el tutorial
 * de cada paso (ver TutorialContext.iniciarGuia).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/anim';
import AvisoTemporal from '../components/AvisoTemporal';
import { ALTO_BARRA_CATALOGO, MARGEN_BARRA_CATALOGO } from '../components/BarraCatalogo';
import {
  ALTO_BARRA_CLIENTE,
  MARGEN_BARRA_CLIENTE,
  SEPARACION_LADO_CLIENTE,
  useHayBotonesCliente,
} from '../components/BarraCliente';
import Icon from '../components/Icon';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useTutorial } from './contexto';

/** Cuánto se queda el aviso si nadie lo toca. */
const DURACION_AVISO = 12000;
/** Alto del aviso (ícono de 40 + relleno de 10 arriba y abajo + borde) y margen izquierdo de los botones redondos. */
const ALTO_AVISO = 66;
const MARGEN_IZQ_BOTONES = 20;

export default function BotonAyuda() {
  const { botonAyuda } = useTutorial();
  return (
    <>
      {botonAyuda && <AvisoAyuda />}
      <ListaAyuda />
    </>
  );
}

function AvisoAyuda() {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { abrirAyuda, cerrarBotonAyuda } = useTutorial();
  const conBotones = useHayBotonesCliente();
  const entrada = useRef(new Animated.Value(0)).current;
  const translateY = useRef(entrada.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })).current;

  useEffect(() => {
    Animated.spring(entrada, { toValue: 1, speed: 14, bounciness: 8, useNativeDriver: true }).start();
  }, [entrada]);

  const salir = () =>
    Animated.timing(entrada, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
      cerrarBotonAyuda,
    );

  // A la altura del botón de abajo (Mis pedidos) y a su derecha; sin los
  // botones, abajo a todo lo ancho. En Explorar, encima de la barra de catálogos.
  const enExplorar = navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'Explorar';
  const bottom =
    insets.bottom + MARGEN_BARRA_CLIENTE - (ALTO_AVISO - ALTO_BARRA_CLIENTE) / 2 +
    (enExplorar ? MARGEN_BARRA_CATALOGO + ALTO_BARRA_CATALOGO : 0);
  const lado = conBotones ? { left: MARGEN_IZQ_BOTONES + ALTO_BARRA_CLIENTE + SEPARACION_LADO_CLIENTE } : null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.zona, lado, { bottom, opacity: entrada, transform: [{ translateY }] }]}>
      <AvisoTemporal
        duracion={DURACION_AVISO}
        onCerrar={motivo => (motivo === 'deslizado' ? cerrarBotonAyuda() : salir())}
        radio={radius.pill}
        grosor={3}
        style={styles.aviso}>
        <Pressable
          style={styles.contenido}
          onPress={abrirAyuda}
          accessibilityRole="button"
          accessibilityLabel="¿No sabes cómo hacer algo? Pulsa aquí para ver la ayuda"
          accessibilityHint="Desliza a la derecha para quitar el aviso">
          <View style={styles.icono}>
            <Icon name="ayuda" size={22} color={c.onAccent} strokeWidth={2.2} />
          </View>
          <View style={styles.textos}>
            {/* En una línea: al lado de los botones redondos el ancho es justo. */}
            <Text style={styles.pregunta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              ¿No sabes cómo hacer algo?
            </Text>
            <Text style={styles.pulsa}>Pulsa aquí</Text>
          </View>
          <Icon name="chevron" size={18} color={c.muted} strokeWidth={2.2} />
        </Pressable>
      </AvisoTemporal>
    </Animated.View>
  );
}

function ListaAyuda() {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { ayudaAbierta, cerrarAyuda, guias, iniciarGuia } = useTutorial();

  return (
    <Modal
      visible={ayudaAbierta}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cerrarAyuda}>
      <View style={styles.fondo}>
        <Pressable style={styles.cerrarFuera} onPress={cerrarAyuda} accessibilityLabel="Cerrar la ayuda" />
        <View style={[styles.hoja, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.agarre} />
          <Text style={styles.titulo}>¿Qué quieres hacer?</Text>
          <Text style={styles.subtitulo}>Elige una acción y te guiamos paso a paso, en cada pantalla.</Text>
          <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
            {guias.map(g => (
              <PressableScale
                key={g.id}
                style={styles.opcion}
                scaleTo={0.98}
                accessibilityRole="button"
                accessibilityLabel={`${g.titulo}. ${g.detalle}`}
                onPress={() => iniciarGuia(g.id)}>
                <View style={styles.opcionIcono}>
                  <Icon name={g.icono} size={22} color={c.goldText} />
                </View>
                <View style={styles.textos}>
                  <Text style={styles.opcionTitulo}>{g.titulo}</Text>
                  <Text style={styles.opcionDetalle}>{g.detalle}</Text>
                </View>
                <Icon name="chevron" size={18} color={c.chevron} strokeWidth={2} />
              </PressableScale>
            ))}
          </ScrollView>
          <Pressable onPress={cerrarAyuda} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.cerrar}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  zona: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  aviso: { width: '100%', maxWidth: 380, ...shadow.card, elevation: 8 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 14 },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1 },
  pregunta: { color: c.textStrong, fontFamily: font.bold, fontSize: 14 },
  pulsa: { color: c.goldText, fontFamily: font.semibold, fontSize: 13, marginTop: 1 },
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
  cerrarFuera: { flex: 1 },
  hoja: {
    backgroundColor: c.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '86%',
  },
  agarre: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 14 },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 22 },
  subtitulo: { color: c.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 12 },
  lista: { flexGrow: 0 },
  listaContenido: { gap: 10, paddingBottom: 6 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  opcionIcono: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionTitulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 15 },
  opcionDetalle: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 2 },
  cerrar: { color: c.muted, fontFamily: font.semibold, textAlign: 'center', paddingVertical: 14 },
}));
