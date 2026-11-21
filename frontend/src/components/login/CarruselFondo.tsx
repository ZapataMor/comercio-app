/**
 * Fondo del login: carrusel de fotos a pantalla completa.
 *
 *   · Cada foto se escala al alto de la pantalla y queda más ancha que ella.
 *   · Cada 7 s la foto nueva entra desde la izquierda y empuja a la anterior
 *     hacia la derecha (1,4 s, bezier(0.65, 0, 0.35, 1)). Bucle infinito.
 *   · Mientras se ve (8,4 s) nunca queda quieta: paneo hacia la derecha y
 *     zoom de 1.02 a 1.10, lineal.
 *   · El nombre del lugar aparece con su foto y se desvanece antes de que
 *     salga.
 *   · Con «reducir movimiento» queda fija la primera foto.
 *
 * Solo Animated con el driver nativo (transform y opacity) y nunca más de
 * dos fotos montadas. Las transformaciones animadas están siempre puestas
 * (nunca se quitan de una vista viva: en Android eso cierra la app).
 *
 * `filtro` se dibuja entre las fotos y el nombre del lugar.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { font } from '../../theme';
import Icon from '../Icon';
import { FotoLogin } from './fotosLogin';

const CADA = 7000;
const TRANSICION = 1400;
const VISIBLE = CADA + TRANSICION; // 8,4 s
const CURVA = Easing.bezier(0.65, 0, 0.35, 1);
const ZOOM: [number, number] = [1.02, 1.1];
// El nombre entra cuando la foto ya va llegando y sale 0,6 s antes que ella.
const NOMBRE_RETARDO = 500;
const NOMBRE_ENTRA = 900;
const NOMBRE_SALE = 600;
// Proporción de las fotos, por si el asset no trae medidas (Jest).
const PROPORCION_POR_DEFECTO = 1072 / 1218;

// Foto que se está viendo y desde cuándo, compartidas entre pantallas: el
// login, el registro y el registro con Google montan cada uno su fondo, y así
// el nuevo sigue en la misma foto y en el mismo punto del paneo, en vez de
// volver a la primera (el fondo no se mueve al cambiar de pantalla).
const enCurso = { idx: 0, desde: 0 };

type Diapo = {
  seq: number;
  idx: number;
  entra: boolean;
  sale: boolean;
  /** ms que la foto ya llevaba en pantalla en otra pantalla (solo la primera). */
  transcurrido: number;
  /** Posición del marco (entrada desde la izquierda, salida a la derecha). */
  x: Animated.Value;
  /** 0 → 1 durante todo el tiempo visible: paneo + zoom. */
  recorrido: Animated.Value;
  /** Opacidad del nombre del lugar. */
  nombre: Animated.Value;
};

type Props = {
  fotos: FotoLogin[];
  ancho: number;
  alto: number;
  /** Margen de la barra de gestos, para el nombre del lugar. */
  abajo: number;
  colorLugar: string;
  filtro?: React.ReactNode;
};

// Última respuesta de «reducir movimiento»: la pantalla siguiente arranca
// con ella y no pasa por el estado quieto (sería un salto del fondo).
let reducidoConocido: boolean | null = null;

/** «Reducir movimiento» del sistema; `null` mientras se consulta. */
function useReducirMovimiento(): boolean | null {
  const [reducido, setReducidoEstado] = useState<boolean | null>(reducidoConocido);
  useEffect(() => {
    let vivo = true;
    const setReducido = (r: boolean) => {
      reducidoConocido = r;
      if (vivo) setReducidoEstado(r);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReducido)
      .catch(() => setReducido(false));
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducido,
    );
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);
  return reducido;
}

export default function CarruselFondo(props: Props) {
  const reducido = useReducirMovimiento();
  // Mientras se consulta, la primera foto queda fija en su punto de partida;
  // si el movimiento está permitido arranca desde ahí mismo, sin salto.
  const quieto = reducido !== false;
  return (
    <Carrusel
      key={quieto ? 'quieto' : 'movimiento'}
      quieto={quieto}
      {...props}
    />
  );
}

function nuevaDiapo(
  seq: number,
  idx: number,
  entra: boolean,
  ancho: number,
  quieto: boolean,
  transcurrido = 0,
): Diapo {
  return {
    seq,
    idx,
    entra,
    sale: false,
    transcurrido,
    x: new Animated.Value(entra ? -ancho : 0),
    recorrido: new Animated.Value(transcurrido / VISIBLE),
    nombre: new Animated.Value(quieto || transcurrido > 0 ? 1 : 0),
  };
}

function Carrusel({
  fotos,
  ancho,
  alto,
  abajo,
  colorLugar,
  filtro,
  quieto,
}: Props & { quieto: boolean }) {
  // Arranca donde iba el fondo de la pantalla anterior (si la hubo).
  const [inicio] = useState(() => {
    const idx = fotos.length > 0 ? enCurso.idx % fotos.length : 0;
    const transcurrido = !enCurso.desde ? 0 : Math.min(Math.max(Date.now() - enCurso.desde, 0), CADA - 1);
    return { idx, transcurrido };
  });
  const [diapos, setDiapos] = useState<Diapo[]>(() => [
    nuevaDiapo(0, inicio.idx, false, ancho, quieto, inicio.transcurrido),
  ]);
  const anchoRef = useRef(ancho);
  anchoRef.current = ancho;
  const ultimoIdx = useRef(inicio.idx);

  useEffect(() => {
    if (quieto) return;
    if (inicio.transcurrido === 0) {
      enCurso.idx = inicio.idx;
      enCurso.desde = Date.now();
    }
    if (fotos.length < 2) return;
    let id: ReturnType<typeof setTimeout>;
    const avanzar = () => {
      const idx = (ultimoIdx.current + 1) % fotos.length;
      ultimoIdx.current = idx;
      enCurso.idx = idx;
      enCurso.desde = Date.now();
      setDiapos(prev => {
        const actual = prev[prev.length - 1];
        const nueva = nuevaDiapo(actual.seq + 1, idx, true, anchoRef.current, false);
        // Nunca más de dos: la que sale y la que entra.
        return [{ ...actual, sale: true }, nueva];
      });
      id = setTimeout(avanzar, CADA);
    };
    id = setTimeout(avanzar, CADA - inicio.transcurrido);
    return () => clearTimeout(id);
  }, [quieto, fotos.length, inicio]);

  // Precarga las fotos del modo. En desarrollo llegan desde Metro y pueden
  // tardar más que lo que cada una está en pantalla: sin esto, la vista se
  // desmonta antes de que la foto llegue y nunca se ve. En el APK de
  // producción van dentro del APK y cargan al instante.
  useEffect(() => {
    fotos.forEach(f => {
      const uri = Image.resolveAssetSource(f.imagen)?.uri;
      if (uri?.startsWith('http')) Image.prefetch(uri).catch(() => {});
    });
  }, [fotos]);

  const quitar = (seq: number) =>
    setDiapos(prev => prev.filter(d => d.seq !== seq));

  return (
    <View
      pointerEvents="none"
      style={[styles.raiz, { width: ancho, height: alto }]}
    >
      {diapos.map(d => (
        <Diapositiva
          key={d.seq}
          d={d}
          foto={fotos[d.idx]}
          ancho={ancho}
          alto={alto}
          quieto={quieto}
          onSalio={quitar}
        />
      ))}
      {filtro}
      {diapos.map(d => {
        const foto = fotos[d.idx];
        return (
          <Animated.View
            key={d.seq}
            style={[styles.lugar, { bottom: 36 + abajo, opacity: d.nombre }]}
          >
            <View style={styles.lugarFila}>
              <Icon
                name="ubicacion"
                size={18}
                color={colorLugar}
                strokeWidth={2}
              />
              <Text
                style={[styles.lugarNombre, { color: colorLugar }]}
                numberOfLines={1}
              >
                {foto.lugar}
              </Text>
            </View>
            {foto.direccion ? (
              <Text
                style={[styles.lugarDireccion, { color: colorLugar }]}
                numberOfLines={1}
              >
                {foto.direccion}
              </Text>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

type DiapositivaProps = {
  d: Diapo;
  foto: FotoLogin;
  ancho: number;
  alto: number;
  quieto: boolean;
  onSalio: (seq: number) => void;
};

function Diapositiva({
  d,
  foto,
  ancho,
  alto,
  quieto,
  onSalio,
}: DiapositivaProps) {
  // Alto de la pantalla y más ancha que ella (si la pantalla fuera más ancha
  // que la foto escalada, se escala al ancho).
  const medidas = Image.resolveAssetSource(foto.imagen);
  const proporcion =
    medidas?.width && medidas?.height
      ? medidas.width / medidas.height
      : PROPORCION_POR_DEFECTO;
  let fw = alto * proporcion;
  let fh = alto;
  if (fw < ancho) {
    fw = ancho;
    fh = ancho / proporcion;
  }
  const desde = -(fw - ancho);

  // Entrada, paneo y nombre: arrancan al montarse la diapositiva.
  useEffect(() => {
    if (quieto) return;
    const retardo = d.entra ? NOMBRE_RETARDO : 0;
    const entra = d.entra ? NOMBRE_ENTRA : NOMBRE_SALE;
    const recorrido = Animated.timing(d.recorrido, {
      toValue: 1,
      duration: VISIBLE - d.transcurrido,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    // Viene de otra pantalla a media foto: el nombre ya se veía y solo falta que salga.
    const nombre =
      d.transcurrido > 0
        ? Animated.sequence([
            Animated.delay(Math.max(0, CADA - NOMBRE_SALE - d.transcurrido)),
            Animated.timing(d.nombre, {
              toValue: 0,
              duration: NOMBRE_SALE,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        : null;
    const animaciones = [
      recorrido,
      nombre ?? Animated.sequence([
        Animated.delay(retardo),
        Animated.timing(d.nombre, {
          toValue: 1,
          duration: entra,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(CADA - NOMBRE_SALE - retardo - entra),
        Animated.timing(d.nombre, {
          toValue: 0,
          duration: NOMBRE_SALE,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ];
    if (d.entra) {
      animaciones.push(
        Animated.timing(d.x, {
          toValue: 0,
          duration: TRANSICION,
          easing: CURVA,
          useNativeDriver: true,
        }),
      );
    }
    animaciones.forEach(a => a.start());
    return () => animaciones.forEach(a => a.stop());
    // Solo al montarse: cada diapositiva vive una única vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salida hacia la derecha, empujada por la nueva.
  useEffect(() => {
    if (!d.sale) return;
    const salida = Animated.timing(d.x, {
      toValue: ancho,
      duration: TRANSICION,
      easing: CURVA,
      useNativeDriver: true,
    });
    salida.start(({ finished }) => {
      if (finished) onSalio(d.seq);
    });
    return () => salida.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.sale]);

  return (
    <Animated.View
      style={[
        styles.marco,
        { width: ancho, height: alto, transform: [{ translateX: d.x }] },
      ]}
    >
      <Animated.Image
        source={foto.imagen}
        fadeDuration={0}
        resizeMode="cover"
        style={{
          width: fw,
          height: fh,
          transform: [
            {
              translateX: d.recorrido.interpolate({
                inputRange: [0, 1],
                outputRange: [desde, 0],
              }),
            },
            {
              scale: d.recorrido.interpolate({
                inputRange: [0, 1],
                outputRange: ZOOM,
              }),
            },
          ],
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  raiz: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  marco: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  lugar: { position: 'absolute', left: 24, right: 24 },
  lugarFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lugarNombre: { flexShrink: 1, fontFamily: font.bold, fontSize: 15 },
  lugarDireccion: {
    marginTop: 2,
    marginLeft: 24,
    fontFamily: font.regular,
    fontSize: 13,
  },
});
