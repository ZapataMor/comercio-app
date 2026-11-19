/**
 * Lo que se ve de un tutorial: la pantalla se oscurece salvo un hueco sobre el
 * elemento, un recuadro lo enmarca y una flecha de tramos rectos (con esquinas
 * de 90°, sin diagonales) lo une con la tarjeta del texto y el botón
 * «Siguiente».
 *
 * Mientras se ve, la capa toma todos los toques (solo responden sus botones) y
 * el botón atrás del teléfono cierra el tutorial.
 *
 * `capa`: "raiz" para la ventana principal; dentro de un modal, el nombre de
 * su <PantallaTutorial>.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { font, makeStyles, radius, useTheme } from '../theme';
import {
  anchoTarjeta,
  caminoFlecha,
  caminoRectRedondeado,
  esVisible,
  Lienzo,
  Punto,
  Rect,
  ubicar,
} from './geometria';
import { EntradaObjetivo, RaizContext, TutorialActivo, useTutorial } from './contexto';

/** Lo que se espera a que aparezca el elemento de un paso antes de saltarlo. */
const ESPERA_ELEMENTO = 1500;
const LARGO_PUNTA = 11;
const ANCHO_PUNTA = 14;

export default function CapaTutorial({ capa = 'raiz' }: { capa?: string }) {
  const { activo } = useTutorial();
  if (!activo) return null;
  const t = activo.tutorial;
  const mia = t.enModal ? t.pantalla === capa : capa === 'raiz';
  return mia ? <Capa key={t.id} activo={activo} enModal={capa !== 'raiz'} /> : null;
}

type Medida = { ancho: number; alto: number; ox: number; oy: number };

const valido = (x: number, y: number, ancho: number, alto: number): Rect | null =>
  [x, y, ancho, alto].every(Number.isFinite) && ancho > 0 && alto > 0 ? { x, y, ancho, alto } : null;

function enVentana(v: View | null): Promise<Rect | null> {
  return new Promise(resolve => {
    if (!v) return resolve(null);
    v.measureInWindow((x, y, ancho, alto) => resolve(valido(x, y, ancho, alto)));
  });
}

/**
 * Posición del elemento respecto de la raíz de la capa (las dos medidas en la
 * ventana, restadas). measureLayout no sirve: no descuenta lo que se desplazó
 * una lista, y el recuadro quedaba donde estaba el elemento antes.
 */
async function medirEn(v: View | null, raiz: View | null, origen: { ox: number; oy: number }): Promise<Rect | null> {
  const [r, base] = await Promise.all([enVentana(v), raiz ? enVentana(raiz) : Promise.resolve(null)]);
  if (!r) return null;
  const ox = base?.x ?? origen.ox;
  const oy = base?.y ?? origen.oy;
  return { ...r, x: r.x - ox, y: r.y - oy };
}

const igual = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.ancho - b.ancho) < 1 && Math.abs(a.alto - b.alto) < 1);

function Capa({ activo, enModal }: { activo: TutorialActivo; enModal: boolean }) {
  const { c, modo } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { siguiente, omitirPaso, saltar, buscarObjetivo, guia } = useTutorial();
  const raiz = useContext(RaizContext);
  const contenedor = useRef<View>(null);
  const [medida, setMedida] = useState<Medida | null>(null);
  // undefined: aún buscando el elemento; null: paso sin elemento.
  const [objetivo, setObjetivo] = useState<Rect | null | undefined>(undefined);
  const [altoTarjeta, setAltoTarjeta] = useState(0);
  const aparecer = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;

  const { tutorial, paso: indice, enGuia } = activo;
  const paso = tutorial.pasos[indice];
  const ultimo = indice === tutorial.pasos.length - 1;

  const lienzo: Lienzo | null = medida && {
    ancho: medida.ancho,
    alto: medida.alto,
    arriba: enModal ? 8 : insets.top,
    abajo: enModal ? 8 : insets.bottom,
  };

  // Atrás: cierra el tutorial (o la guía).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      saltar();
      return true;
    });
    return () => sub.remove();
  }, [saltar]);

  // Recuadro que late suavemente.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulso, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulso]);

  const alMedirCapa = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    contenedor.current?.measureInWindow((x, y) => {
      const ox = Number.isFinite(x) ? x : 0;
      const oy = Number.isFinite(y) ? y : 0;
      setMedida(prev =>
        prev && prev.ancho === width && prev.alto === height && prev.ox === ox && prev.oy === oy
          ? prev
          : { ancho: width, alto: height, ox, oy },
      );
    });
  };

  // Busca el elemento del paso (desplazando su lista si hace falta) y lo
  // vuelve a medir mientras el paso está a la vista, por si se mueve.
  useEffect(() => {
    if (!medida || !lienzo) return;
    aparecer.setValue(0);
    setObjetivo(undefined);
    const id = paso.objetivo;
    if (!id) {
      setObjetivo(null);
      return;
    }
    let vivo = true;
    const inicio = Date.now();
    const medir = (e: EntradaObjetivo) => medirEn(e.ref.current, raiz?.current ?? null, medida);

    const buscar = async (desplazar: boolean): Promise<Rect | null> => {
      const entradas: EntradaObjetivo[] = buscarObjetivo(id);
      for (const e of entradas) {
        let r = await medir(e);
        if (!r) continue;
        // En una lista desplazable, la lista lo trae entero a la vista (puede
        // asomar a medias, cortado por el borde de la lista).
        if (desplazar && e.desplazar) {
          await e.desplazar();
          r = await medir(e);
          if (!r) continue;
        }
        if (esVisible(r, lienzo)) return r;
      }
      return null;
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    let desplazado = false;
    const primera = async () => {
      const r = await buscar(!desplazado);
      desplazado = true;
      if (!vivo) return;
      if (r) {
        setObjetivo(r);
        timer = setTimeout(seguirMidiendo, 600);
        return;
      }
      // No está (lista vacía, botón que no aplica): se salta el paso.
      if (Date.now() - inicio > ESPERA_ELEMENTO) omitirPaso();
      else timer = setTimeout(primera, 150);
    };
    const seguirMidiendo = async () => {
      const r = await buscar(false);
      if (!vivo) return;
      if (r) setObjetivo(prev => (prev && igual(prev, r) ? prev : r));
      timer = setTimeout(seguirMidiendo, 600);
    };
    primera();
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
    };
  }, [indice, medida?.ancho, medida?.alto, medida?.ox, medida?.oy]); // eslint-disable-line react-hooks/exhaustive-deps

  const listo = !!lienzo && objetivo !== undefined && altoTarjeta > 0;
  useEffect(() => {
    if (!listo) return;
    Animated.timing(aparecer, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [listo, indice, aparecer]);

  const ubicacion = lienzo && objetivo !== undefined ? ubicar(objetivo, altoTarjeta || 160, lienzo) : null;
  const velo = modo === 'noche' ? 'rgba(5,7,20,0.74)' : 'rgba(20,16,12,0.64)';
  const color = c.accent;

  const caminoVelo =
    lienzo && ubicacion
      ? `M0 0 H${lienzo.ancho} V${lienzo.alto} H0 Z ` + (ubicacion.recuadro ? caminoRectRedondeado(ubicacion.recuadro, 12) : '')
      : '';

  // La línea termina donde empieza la punta.
  let linea = '';
  let punta = '';
  if (ubicacion && ubicacion.flecha.length >= 2 && ubicacion.punta) {
    const pts: Punto[] = ubicacion.flecha.map(p => ({ ...p }));
    const fin = pts[pts.length - 1];
    const sentido = ubicacion.punta === 'arriba' ? 1 : -1; // la base queda abajo si apunta arriba
    const base = fin.y + sentido * LARGO_PUNTA;
    pts[pts.length - 1] = { x: fin.x, y: base + sentido * -1 };
    linea = caminoFlecha(pts);
    punta = `M${fin.x} ${fin.y} L${fin.x - ANCHO_PUNTA / 2} ${base} L${fin.x + ANCHO_PUNTA / 2} ${base} Z`;
  }

  const translateY = useRef(aparecer.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })).current;
  const escalaPulso = useRef(pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })).current;
  const opacidadPulso = useRef(pulso.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0] })).current;

  const textoBoton = !ultimo ? 'Siguiente' : enGuia && (guia?.pendientes.length ?? 0) > 1 ? 'Continuar' : 'Entendido';

  return (
    <View
      ref={contenedor}
      collapsable={false}
      style={StyleSheet.absoluteFill}
      onLayout={alMedirCapa}
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal>
      {/* Entre un paso y otro (buscando el elemento) la pantalla sigue oscura. */}
      {!ubicacion && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: velo }]} />}
      {lienzo && ubicacion && (
        <Svg width={lienzo.ancho} height={lienzo.alto} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={caminoVelo} fill={velo} fillRule="evenodd" />
          {ubicacion.recuadro && (
            <Path d={caminoRectRedondeado(ubicacion.recuadro, 12)} stroke={color} strokeWidth={2.5} fill="none" />
          )}
          {!!linea && (
            <Path d={linea} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="miter" strokeLinecap="butt" />
          )}
          {!!punta && <Path d={punta} fill={color} />}
        </Svg>
      )}
      {/* El latido va en una vista aparte: siempre montada, con el mismo transform. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulso,
          ubicacion?.recuadro
            ? {
                left: ubicacion.recuadro.x,
                top: ubicacion.recuadro.y,
                width: ubicacion.recuadro.ancho,
                height: ubicacion.recuadro.alto,
                borderColor: color,
              }
            : styles.oculto,
          { opacity: opacidadPulso, transform: [{ scale: escalaPulso }] },
        ]}
      />
      <Animated.View
        accessibilityLiveRegion="polite"
        onLayout={e => setAltoTarjeta(Math.round(e.nativeEvent.layout.height))}
        style={[
          styles.tarjeta,
          ubicacion
            ? { left: ubicacion.tarjeta.x, top: ubicacion.tarjeta.y, width: ubicacion.tarjeta.ancho }
            : [styles.medirFuera, { width: lienzo ? anchoTarjeta(lienzo) : 300 }],
          { borderColor: color, opacity: aparecer, transform: [{ translateY }] },
        ]}>
        <View style={styles.cabecera}>
          <Text style={styles.contador}>
            {enGuia && guia ? `${guia.guia.titulo} · ` : ''}
            {indice + 1} de {tutorial.pasos.length}
          </Text>
        </View>
        <Text style={styles.titulo}>{paso.titulo}</Text>
        <Text style={styles.texto}>{paso.texto}</Text>
        <View style={styles.botones}>
          <Pressable
            hitSlop={10}
            onPress={saltar}
            accessibilityRole="button"
            accessibilityLabel={enGuia ? 'Salir de la guía' : 'Saltar el tutorial'}>
            <Text style={styles.saltar}>{enGuia ? 'Salir de la guía' : 'Saltar'}</Text>
          </Pressable>
          <PressableScale style={[styles.siguiente, ultimo && styles.siguienteFinal]} onPress={siguiente} accessibilityRole="button">
            <Text style={styles.siguienteTxt}>{textoBoton}</Text>
            {!ultimo && <Icon name="chevron" size={16} color={c.onBrand} strokeWidth={2.4} />}
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  pulso: { position: 'absolute', borderWidth: 3, borderRadius: 14 },
  oculto: { left: -100, top: -100, width: 10, height: 10, borderColor: 'transparent' },
  medirFuera: { left: 16, top: -2000 },
  tarjeta: {
    position: 'absolute',
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    ...shadow.card,
    elevation: 10,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  contador: { color: c.goldText, fontFamily: font.semibold, fontSize: 12, letterSpacing: 0.2 },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 18, lineHeight: 24 },
  texto: { color: c.text, fontFamily: font.regular, fontSize: 14.5, lineHeight: 21, marginTop: 4 },
  botones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  saltar: { color: c.muted, fontFamily: font.semibold, fontSize: 14, paddingVertical: 8 },
  siguiente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.brand,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 14,
  },
  siguienteFinal: { paddingRight: 18 },
  siguienteTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 14 },
}));
