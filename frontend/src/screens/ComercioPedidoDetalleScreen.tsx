import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { marcarPedidoListo } from '../api';
import { useAuth } from '../AuthContext';
import { RootStackParamList } from '../navTypes';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'ComercioPedidoDetalle'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function ComercioPedidoDetalleScreen({ route, navigation }: Props) {
  const { pedido } = route.params;
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);

  async function onListo() {
    setEnviando(true);
    try {
      await marcarPedidoListo(token, pedido.id);
      toast.exito('Pedido listo', 'Los domiciliarios ya pueden recogerlo.');
      navigation.goBack();
    } catch (e) {
      toast.error('No se pudo', e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.pid}>Pedido #{pedido.id}</Text>
          <Text
            style={[
              styles.badge,
              pedido.estado === 'pendiente'
                ? styles.pend
                : pedido.estado === 'entregado'
                ? styles.entreg
                : styles.otro,
            ]}>
            {pedido.estado_label}
          </Text>
        </View>

        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Cliente</Text>
          <Text style={styles.cliente}>👤 {pedido.cliente ?? 'Cliente'}</Text>
          <Text style={styles.linea}>📍 {pedido.direccion_entrega}</Text>
          {!!pedido.telefono_contacto && <Text style={styles.linea}>📞 {pedido.telefono_contacto}</Text>}
          <Text style={styles.linea}>💳 Pago: {pedido.metodo_pago}</Text>
          {!!pedido.domiciliario && <Text style={styles.linea}>🛵 Domiciliario: {pedido.domiciliario}</Text>}
        </View>

        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Productos</Text>
          {pedido.items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemCant}>{it.cantidad}×</Text>
              <Text style={styles.itemNombre}>{it.nombre}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValor}>{cop(pedido.total)}</Text>
        </View>
      </View>

      {pedido.estado === 'pendiente' ? (
        <TouchableOpacity style={styles.btn} onPress={onListo} disabled={enviando}>
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTxt}>Marcar listo para recoger</Text>
          )}
        </TouchableOpacity>
      ) : pedido.estado === 'listo' ? (
        <Text style={styles.nota}>⏳ Esperando que un domiciliario lo tome…</Text>
      ) : pedido.estado === 'entregado' ? (
        <Text style={[styles.nota, { color: '#16a34a' }]}>✓ Entregado al cliente</Text>
      ) : (
        <Text style={styles.nota}>🛵 {pedido.estado_label}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pid: { fontWeight: '800', color: '#0f172a', fontSize: 18 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  pend: { backgroundColor: '#fef3c7', color: '#b45309' },
  otro: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  entreg: { backgroundColor: '#dcfce7', color: '#15803d' },
  bloque: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12, marginTop: 12 },
  bloqueTitulo: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' },
  cliente: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  linea: { color: '#475569', fontSize: 14, marginTop: 3 },
  itemRow: { flexDirection: 'row', marginTop: 4 },
  itemCant: { fontWeight: '700', color: '#4f46e5', width: 36 },
  itemNombre: { color: '#334155', fontSize: 15, flex: 1 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14, marginTop: 14,
  },
  totalLabel: { fontWeight: '700', color: '#0f172a', fontSize: 16 },
  totalValor: { fontWeight: '800', color: '#0f172a', fontSize: 18 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nota: { textAlign: 'center', color: '#64748b', marginTop: 16, fontSize: 14 },
});
