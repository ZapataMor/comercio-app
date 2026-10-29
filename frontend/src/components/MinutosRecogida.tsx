/**
 * Modal para tomar un pedido: el domiciliario elige en una rueda en cuántos
 * minutos (1 a 20) lo recoge y confirma con "Aceptar".
 *
 * La rueda es la lista de números de arriba hacia abajo (1, 2, 3…); al
 * deslizarla cada número encaja en el cuadro del centro, y el que queda
 * dentro del cuadro es el elegido. Tocar un número también lo lleva al cuadro.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Pedido } from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';
import Icon from './Icon';

/** Rango permitido (coincide con la validación del backend). */
export const MIN_MINUTOS = 1;
export const MAX_MINUTOS = 20;
const MINUTOS = Array.from({ length: MAX_MINUTOS - MIN_MINUTOS + 1 }, (_, i) => MIN_MINUTOS + i);
/** Con cuántos minutos abre la rueda. */
const POR_DEFECTO = 10;

/** Alto de cada número y cuántos se ven a la vez (el del centro es el elegido). */
const ALTO_ITEM = 52;
const VISIBLES = 5;
const RELLENO = ALTO_ITEM * Math.floor(VISIBLES / 2);

type Props = {
  /** Pedido que se va a tomar; null = modal cerrado. */
  pedido: Pedido | null;
  enviando: boolean;
  onCerrar: () => void;
  onAceptar: (minutos: number) => void;
};

export default function MinutosRecogida({ pedido, enviando, onCerrar, onAceptar }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [minutos, setMinutos] = useState(POR_DEFECTO);
  // Mientras el modal se desvanece al cerrar, sigue mostrando el último pedido.
  const ultimo = useRef(pedido);
  if (pedido) ultimo.current = pedido;
  const p = ultimo.current;

  useEffect(() => {
    if (pedido?.id) setMinutos(POR_DEFECTO);
  }, [pedido?.id]);

  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  return (
    <Modal visible={!!pedido} transparent animationType="fade" onRequestClose={cerrar}>
      <View style={styles.fondo}>
        <View style={styles.caja}>
          <View style={styles.cabecera}>
            <Icon name="reloj" size={20} color={c.accent} />
            <Text style={styles.titulo}>¿En cuántos minutos lo recoges?</Text>
          </View>
          {!!p && (
            <Text style={styles.sub}>
              Pedido #{p.id} · {p.negocio?.nombre ?? 'Negocio'}
              {p.negocio?.direccion ? `\n${p.negocio.direccion}` : ''}
            </Text>
          )}

          <Rueda key={pedido?.id ?? 0} inicial={POR_DEFECTO} onCambio={setMinutos} />

          <Text style={styles.nota}>
            Desliza hasta dejar en el cuadro los minutos que tardarás (máximo {MAX_MINUTOS}). Si tardas más de lo que
            prometes, puede bajar tu confiabilidad.
          </Text>

          <TouchableOpacity
            style={[styles.boton, enviando && styles.botonDeshabilitado]}
            onPress={() => onAceptar(minutos)}
            disabled={enviando}
            accessibilityLabel={`Aceptar: recoger en ${minutos} minutos`}>
            {enviando ? <ActivityIndicator color={c.onAccent} /> : <Text style={styles.botonTxt}>Aceptar</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={cerrar} disabled={enviando}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** Rueda vertical de minutos que encaja cada número en el cuadro central. */
function Rueda({ inicial, onCambio }: { inicial: number; onCambio: (minutos: number) => void }) {
  const styles = useStyles();
  const lista = useRef<ScrollView>(null);
  const indiceInicial = MINUTOS.indexOf(inicial);
  const y = useRef(new Animated.Value(indiceInicial * ALTO_ITEM)).current;
  const indiceRef = useRef(indiceInicial);
  const [indice, setIndice] = useState(indiceInicial);

  // El número elegido se decide en vivo con la posición: el que está en el centro.
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const i = Math.max(0, Math.min(MINUTOS.length - 1, Math.round(e.nativeEvent.contentOffset.y / ALTO_ITEM)));
          if (i !== indiceRef.current) {
            indiceRef.current = i;
            setIndice(i);
            onCambio(MINUTOS[i]);
          }
        },
      }),
    [y, onCambio],
  );

  const irA = (i: number, animado = true) => lista.current?.scrollTo({ y: i * ALTO_ITEM, animated: animado });

  return (
    <View
      style={styles.rueda}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Minutos para recoger el pedido"
      accessibilityValue={{ min: MIN_MINUTOS, max: MAX_MINUTOS, now: MINUTOS[indice], text: `${MINUTOS[indice]} minutos` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => {
        const i = indiceRef.current + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
        if (i >= 0 && i < MINUTOS.length) irA(i);
      }}>
      {/* Cuadro del centro: el número que queda aquí es el elegido. */}
      <View pointerEvents="none" style={styles.cuadro}>
        <Text style={styles.cuadroUnidad}>min</Text>
      </View>

      <Animated.ScrollView
        ref={lista}
        showsVerticalScrollIndicator={false}
        snapToInterval={ALTO_ITEM}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentOffset={{ x: 0, y: indiceInicial * ALTO_ITEM }}
        onLayout={() => irA(indiceInicial, false)}
        contentContainerStyle={{ paddingVertical: RELLENO }}>
        {MINUTOS.map((m, i) => {
          // Cuanto más lejos del centro, más pequeño y tenue.
          const rango = [-2, -1, 0, 1, 2].map(d => (i + d) * ALTO_ITEM);
          const opacity = y.interpolate({
            inputRange: rango,
            outputRange: [0.2, 0.5, 1, 0.5, 0.2],
            extrapolate: 'clamp',
          });
          const scale = y.interpolate({
            inputRange: rango,
            outputRange: [0.75, 0.88, 1.15, 0.88, 0.75],
            extrapolate: 'clamp',
          });
          return (
            <Pressable key={m} style={styles.item} onPress={() => irA(i)}>
              <Animated.Text
                style={[styles.numero, i === indice && styles.numeroElegido, { opacity, transform: [{ scale }] }]}>
                {m}
              </Animated.Text>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1, fontSize: 18, fontFamily: font.display, color: c.textStrong },
  sub: { fontSize: 13, fontFamily: font.regular, color: c.muted, lineHeight: 19, marginTop: 6 },
  rueda: { height: ALTO_ITEM * VISIBLES, marginTop: 12, marginBottom: 4 },
  cuadro: {
    position: 'absolute', top: RELLENO, left: 36, right: 36, height: ALTO_ITEM,
    borderRadius: radius.md, borderWidth: 2, borderColor: c.accent, backgroundColor: c.accentSoft,
    justifyContent: 'center', alignItems: 'flex-end', paddingRight: 14,
  },
  cuadroUnidad: { fontSize: 13, fontFamily: font.semibold, color: c.goldText },
  item: { height: ALTO_ITEM, alignItems: 'center', justifyContent: 'center' },
  numero: { fontSize: 24, fontFamily: font.display, color: c.textStrong },
  numeroElegido: { color: c.goldText },
  nota: { fontSize: 12, fontFamily: font.regular, color: c.muted, lineHeight: 17, textAlign: 'center' },
  boton: {
    backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 16,
    ...shadow.gold,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 15 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
