/**
 * Escena de las pantallas de acceso (login, registro y registro con Google):
 * fotos de Maicao a pantalla completa con filtro de cine y una tarjeta de
 * vidrio centrada. Las tres se ven igual; solo cambia lo que va en la tarjeta.
 *
 * Capas, de atrás hacia adelante:
 *   1. CarruselFondo: fotos con paneo + zoom que se empujan cada 7 s. Cada
 *      pantalla arranca en la foto que se estaba viendo (el fondo no salta).
 *   2. FiltroCine: baño de color, viñeta, grano y velos.
 *   3. Nombre del lugar (esquina inferior izquierda).
 *   4. TarjetaVidrio con `children`, que aparecen con un fundido corto.
 *
 * Al pasar de una pantalla a otra no hay animación de pantalla (en App.tsx,
 * `animation: 'none'`): el fondo sigue igual y solo cambia lo de la tarjeta.
 * Las de fundido de react-native-screens dejaban la pantalla nueva con un velo
 * claro encima en Android.
 *
 * Sigue el modo por hora (día/noche) a través del tema; sus colores están en
 * theme.tsx (`paletasLogin`). Ver también useEstilosAcceso y CampoAcceso.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../../theme';
import CarruselFondo from './CarruselFondo';
import FiltroCine from './FiltroCine';
import { FOTOS_LOGIN } from './fotosLogin';
import TarjetaVidrio from './TarjetaVidrio';

const ANCHO_TARJETA_MAX = 356;

type Props = {
  children: React.ReactNode;
  /** Lo que va fuera de la tarjeta (modales). */
  fuera?: React.ReactNode;
};

export default function EscenaAcceso({ children, fuera }: Props) {
  const insets = useSafeAreaInsets();
  const { modo, login: l } = useTheme();
  const styles = useStyles();
  // Tamaño de la pantalla. El fondo guarda el alto completo: al abrir el
  // teclado la pantalla se encoge y el fondo queda quieto debajo, en vez de
  // reescalar las fotos.
  const [lienzo, setLienzo] = useState<{ w: number; h: number } | null>(null);
  // Alto actual de la pantalla (baja si el sistema la encoge con el teclado)
  // y alto del teclado abierto.
  const [altoActual, setAltoActual] = useState(0);
  const [teclado, setTeclado] = useState(0);
  // Fundido del contenido de la tarjeta al abrir la pantalla. La opacidad
  // animada queda siempre puesta (quitarla de una vista viva cierra la app).
  const aparece = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(aparece, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [aparece]);

  function medir(ev: LayoutChangeEvent) {
    const { width, height } = ev.nativeEvent.layout;
    setAltoActual(height);
    setLienzo(prev => (prev && prev.w === width && prev.h >= height ? prev : { w: width, h: height }));
  }

  // Teclado: con la app de borde a borde (Android 15+) la ventana no se
  // encoge al abrirlo, así que la tarjeta se centra en el espacio libre de
  // arriba. Si el sistema sí la encoge, ese tramo ya no se descuenta.
  useEffect(() => {
    const cambiar = (alto: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTeclado(alto);
    };
    const ios = Platform.OS === 'ios';
    const abre = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', e => cambiar(e.endCoordinates.height));
    const cierra = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => cambiar(0));
    return () => {
      abre.remove();
      cierra.remove();
    };
  }, []);
  const tapaTeclado = Math.max(0, teclado - ((lienzo?.h ?? altoActual) - altoActual));

  const anchoTarjeta = Math.min((lienzo?.w ?? 360) - 40, ANCHO_TARJETA_MAX);

  return (
    <View style={styles.raiz} onLayout={medir}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {lienzo ? (
        <CarruselFondo
          key={modo}
          fotos={FOTOS_LOGIN[modo]}
          ancho={lienzo.w}
          alto={lienzo.h}
          abajo={insets.bottom}
          colorLugar={l.lugar}
          filtro={<FiltroCine ancho={lienzo.w} alto={lienzo.h} c={l} />}
        />
      ) : null}

      {/* Tarjeta: desplazable por si no cabe (teclado abierto, formulario
          largo); cuando cabe, queda centrada. */}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.contenido,
          { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, tapaTeclado) + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never">
        <TarjetaVidrio ancho={anchoTarjeta} c={l}>
          <Animated.View style={{ opacity: aparece }}>{children}</Animated.View>
        </TarjetaVidrio>
      </ScrollView>
      {fuera}
    </View>
  );
}

const useStyles = makeStyles((_c, _sombras, l) => ({
  raiz: { flex: 1, backgroundColor: l.sombraEscena, overflow: 'hidden' },
  fill: { flex: 1 },
  contenido: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
}));
