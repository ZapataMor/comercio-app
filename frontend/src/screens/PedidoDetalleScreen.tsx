import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getPedido, SeguimientoPedido } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PedidoDetalle'>;

const LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  listo: 'Listo para recoger',
  tomado: 'Domiciliario asignado',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
};

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** Un paso de la línea de tiempo; el paso "actual" late suavemente. */
function Paso({ texto, hecho, actual }: { texto: string; hecho: boolean; actual: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!actual) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [actual, pulse]);

  return (
    <View style={styles.paso}>
      <Animated.View
        style={[
          styles.bolita,
          hecho || actual ? styles.bolitaOn : styles.bolitaOff,
          actual && styles.bolitaActual,
          actual && { transform: [{ scale: pulse }] },
        ]}>
        {hecho ? (
          <Icon name="check" size={14} color={c.onAccent} />
        ) : (
          <Text style={[styles.bolitaTxt, !(hecho || actual) && styles.bolitaTxtOff]}>•</Text>
        )}
      </Animated.View>
      <Text style={[styles.pasoTxt, hecho || actual ? styles.pasoOn : styles.pasoOff]}>
        {texto}
        {actual ? '  · ahora' : ''}
      </Text>
    </View>
  );
}

export default function PedidoDetalleScreen({ route }: Props) {
  const { auth } = useAuth();
  const { id } = route.params;
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarPedido = useCallback(
    (mostrarCarga = false) => {
      if (mostrarCarga) {
        setCargando(true);
      }

      return getPedido(auth!.token, id)
        .then(setPedido)
        .finally(() => setCargando(false));
    },
    [auth, id],
  );

  useFocusEffect(
    useCallback(() => {
      cargarPedido(true);
      const timer = setInterval(() => cargarPedido(), 5000);
      return () => clearInterval(timer);
    }, [cargarPedido]),
  );

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (!pedido) {
    return <Text style={styles.error}>No se encontró el pedido.</Text>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.titulo}>Pedido #{pedido.id}</Text>
      <View style={[styles.sub, styles.fila]}>
        <Icon name="tienda" size={14} color={c.muted} />
        <Text style={styles.sub}>{pedido.negocio}</Text>
      </View>

      {/* Seguimiento */}
      <FadeInView style={styles.card}>
        <Text style={styles.cardTitulo}>Seguimiento</Text>
        {pedido.estados.map((e, i) => (
          <Paso
            key={e}
            texto={LABEL[e] ?? e}
            hecho={i < pedido.estado_index}
            actual={i === pedido.estado_index}
          />
        ))}
        {pedido.estado === 'tomado' && pedido.minutos_recogida != null && (
          <View style={[styles.nota, styles.fila]}>
            <Icon name="moto" size={14} color={c.accent} />
            <Text style={styles.nota}>El domiciliario recoge en ~{pedido.minutos_recogida} min.</Text>
          </View>
        )}
        {!!pedido.domiciliario && <Text style={styles.nota}>Domiciliario: {pedido.domiciliario}</Text>}
      </FadeInView>

      {/* Detalle */}
      <FadeInView delay={80} style={styles.card}>
        <Text style={styles.cardTitulo}>Detalle</Text>
        {pedido.items.map((it, idx) => (
          <View key={idx} style={styles.linea}>
            <Text style={styles.lineaTxt}>{it.cantidad}× {it.nombre}</Text>
            <Text style={styles.lineaTxt}>{cop(it.precio * it.cantidad)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalLabel}>{cop(pedido.total)}</Text>
        </View>
        <View style={[styles.info, styles.fila]}>
          <Icon name="tarjeta" size={13} color={c.muted} />
          <Text style={styles.info}>{pedido.metodo_pago} ·</Text>
          <Icon name="ubicacion" size={13} color={c.muted} />
          <Text style={[styles.info, { flex: 1 }]}>{pedido.direccion_entrega}</Text>
        </View>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  titulo: { fontSize: 22, fontFamily: font.display, color: c.textStrong },
  sub: { color: c.muted, marginTop: 2, marginBottom: 16, fontFamily: font.medium },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 14, ...shadow.soft },
  cardTitulo: { fontFamily: font.bold, color: c.text, marginBottom: 12 },
  paso: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bolita: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bolitaOn: { backgroundColor: c.accent },
  bolitaOff: { backgroundColor: c.surface2 },
  bolitaActual: { borderWidth: 3, borderColor: c.accentSoft },
  bolitaTxt: { color: c.onAccent, fontSize: 16, fontFamily: font.bold },
  bolitaTxtOff: { color: c.mutedSoft },
  pasoTxt: { fontSize: 14, fontFamily: font.medium },
  pasoOn: { color: c.textStrong, fontFamily: font.semibold },
  pasoOff: { color: c.mutedSoft },
  nota: { color: c.goldText, fontSize: 13, marginTop: 6, fontFamily: font.medium },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineaTxt: { color: c.text, fontFamily: font.regular },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  totalLabel: { fontFamily: font.bold, color: c.textStrong },
  info: { color: c.muted, fontSize: 13, marginTop: 10, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
});
