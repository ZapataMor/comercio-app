import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getPedido, SeguimientoPedido } from '../api';
import { useAuth } from '../AuthContext';
import { RootStackParamList } from '../navTypes';

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

export default function PedidoDetalleScreen({ route }: Props) {
  const { auth } = useAuth();
  const { id } = route.params;
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);
  const [cargando, setCargando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      getPedido(auth!.token, id)
        .then(p => activo && setPedido(p))
        .finally(() => activo && setCargando(false));
      return () => {
        activo = false;
      };
    }, [auth, id]),
  );

  if (cargando) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }
  if (!pedido) {
    return <Text style={styles.error}>No se encontró el pedido.</Text>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.titulo}>Pedido #{pedido.id}</Text>
      <Text style={styles.sub}>🏪 {pedido.negocio}</Text>

      {/* Seguimiento */}
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Seguimiento</Text>
        {pedido.estados.map((estado, i) => {
          const hecho = i < pedido.estado_index;
          const actual = i === pedido.estado_index;
          return (
            <View key={estado} style={styles.paso}>
              <View
                style={[
                  styles.bolita,
                  (hecho || actual) ? styles.bolitaOn : styles.bolitaOff,
                  actual && styles.bolitaActual,
                ]}>
                <Text style={styles.bolitaTxt}>{hecho ? '✓' : i + 1}</Text>
              </View>
              <Text style={[styles.pasoTxt, (hecho || actual) ? styles.pasoOn : styles.pasoOff]}>
                {LABEL[estado] ?? estado}
                {actual ? '  ● actual' : ''}
              </Text>
            </View>
          );
        })}
        {pedido.estado === 'tomado' && pedido.minutos_recogida != null && (
          <Text style={styles.nota}>🛵 El domiciliario recoge en ~{pedido.minutos_recogida} min.</Text>
        )}
        {!!pedido.domiciliario && <Text style={styles.nota}>Domiciliario: {pedido.domiciliario}</Text>}
      </View>

      {/* Detalle */}
      <View style={styles.card}>
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
        <Text style={styles.info}>💳 {pedido.metodo_pago} · 📍 {pedido.direccion_entrega}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  sub: { color: '#64748b', marginTop: 2, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitulo: { fontWeight: '700', color: '#334155', marginBottom: 12 },
  paso: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bolita: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bolitaOn: { backgroundColor: '#4f46e5' },
  bolitaOff: { backgroundColor: '#e2e8f0' },
  bolitaActual: { borderWidth: 3, borderColor: '#c7d2fe' },
  bolitaTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pasoTxt: { fontSize: 14 },
  pasoOn: { color: '#0f172a', fontWeight: '600' },
  pasoOff: { color: '#94a3b8' },
  nota: { color: '#4f46e5', fontSize: 13, marginTop: 6 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineaTxt: { color: '#475569' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalLabel: { fontWeight: '700' },
  info: { color: '#64748b', fontSize: 13, marginTop: 10 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 16 },
});
