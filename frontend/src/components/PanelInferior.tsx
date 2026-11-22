/**
 * Panel que sube desde abajo con una lista de opciones (las de "Mi perfil"
 * en la barra inferior de Explorar). Es la versión de abajo de
 * MenuDesplegable: usa sus mismos renglones (OpcionMenu) y la misma capa
 * (CapaMenus), así queda nítido mientras la app se pone borrosa detrás.
 *
 * Se cierra tocando fuera, con "atrás", deslizándolo hacia abajo o al elegir
 * una opción, que se abre cuando el panel termina de bajar.
 *
 *   const panel = usePanelInferior();
 *   panel.abrir(elegir => [<OpcionMenu … onPress={() => elegir(accion)} />]);
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '../RootNavigation';
import { makeStyles, radius } from '../theme';
import { desenfocarApp } from './Desenfoque';
import { Elegir, nuevaApertura, useCapaMenus } from './MenuDesplegable';

type Renglones = (elegir: Elegir) => React.ReactNode[];

/** Cuánto hay que bajarlo (o qué tan rápido) para que se cierre al soltarlo. */
const ARRASTRE_CIERRA = 90;
const VELOCIDAD_CIERRA = 0.9;

export function usePanelInferior() {
  const capa = useCapaMenus();
  const [abierto, setAbierto] = useState<number | null>(null);
  const actual = useRef<number | null>(null);

  const abrir = useCallback(
    (renglones: Renglones, etiqueta: string) => {
      if (!capa || actual.current != null) return;
      const n = nuevaApertura();
      actual.current = n;
      setAbierto(n);
      capa.mostrar(
        n,
        <Panel
          renglones={renglones}
          etiqueta={etiqueta}
          onCerrado={() => {
            capa.quitar(n);
            if (actual.current === n) {
              actual.current = null;
              setAbierto(null);
            }
          }}
        />,
      );
    },
    [capa],
  );

  // Si quien lo abrió desaparece (p. ej. al cambiar de cuenta), se va con él.
  useEffect(
    () => () => {
      if (actual.current != null) capa?.quitar(actual.current);
    },
    [capa],
  );

  return { abrir, abierto: abierto != null };
}

function Panel({ renglones, etiqueta, onCerrado }: { renglones: Renglones; etiqueta: string; onCerrado: () => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Fijos mientras el panel está abierto, como en MenuDesplegable.
  const [contenido] = useState(() => renglones(elegir).filter(Boolean));
  // 0 = abajo, fuera de la pantalla; 1 = arriba, a la vista.
  const entrada = useRef(new Animated.Value(0)).current;
  // Lo que el dedo lo baja al arrastrarlo.
  const arrastre = useRef(new Animated.Value(0)).current;
  const [alto, setAlto] = useState(0);
  const empezado = useRef(false);
  const cerrando = useRef(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(
    () => () => {
      if (!cerrando.current) desenfocarApp(false);
    },
    [],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cerrando.current) return false;
      cerrar();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function entrar() {
    desenfocarApp(true);
    Animated.timing(entrada, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function cerrar(despues?: () => void) {
    if (cerrando.current) return;
    cerrando.current = true;
    setSaliendo(true);
    desenfocarApp(false);
    Animated.timing(entrada, {
      toValue: 0,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onCerrado();
      despues?.();
    });
  }

  /** Baja el panel y, al terminar, abre la opción. */
  function elegir(accion: () => void) {
    if (cerrando.current || !navigationRef.isReady()) return;
    cerrar(accion);
  }

  // Deslizarlo hacia abajo desde la manija (o la parte de arriba) lo cierra.
  const gestos = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => arrastre.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > ARRASTRE_CIERRA || g.vy > VELOCIDAD_CIERRA) {
          cerrar(() => arrastre.setValue(0));
        } else {
          Animated.spring(arrastre, { toValue: 0, bounciness: 6, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(arrastre, { toValue: 0, bounciness: 6, useNativeDriver: true }).start(),
    }),
  ).current;

  // Antes de medirse, fuera de la pantalla: así no asoma de golpe.
  const recorrido = alto || height;
  const translateY = Animated.add(
    entrada.interpolate({ inputRange: [0, 1], outputRange: [recorrido + 40, 0] }),
    arrastre,
  );
  const altoMax = height * 0.86;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={saliendo ? 'none' : 'box-none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.velo, { opacity: entrada }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => cerrar()} accessibilityLabel="Cerrar" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={etiqueta}
        onLayout={e => {
          const h = e.nativeEvent.layout.height;
          setAlto(h);
          if (h > 0 && !empezado.current && !cerrando.current) {
            empezado.current = true;
            entrar();
          }
        }}
        style={[styles.panel, { maxHeight: altoMax, transform: [{ translateY }] }]}>
        <View {...gestos.panHandlers} style={styles.zonaManija}>
          <View style={styles.manija} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}>
          {contenido.map((renglon, i) => (
            <React.Fragment key={i}>{renglon}</React.Fragment>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  velo: { backgroundColor: 'rgba(0,0,0,0.18)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.card,
  },
  zonaManija: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
  manija: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.borderStrong },
  lista: { gap: 8, paddingHorizontal: 16 },
}));
