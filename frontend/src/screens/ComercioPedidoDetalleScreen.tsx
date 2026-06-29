import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { marcarPedidoListo } from '../api';
import { useAuth } from '../AuthContext';
import Icon from '../components/Icon';
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
          <View style={styles.filaInfo}>
            <Icon name="usuario" size={15} color="#0f172a" />
            <Text style={styles.cliente}>{pedido.cliente ?? 'Cliente'}</Text>
          </View>
          <View style={styles.filaInfo}>
            <Icon name="ubicacion" size={15} color="#475569" />
            <Text style={styles.linea}>{pedido.direccion_entrega}</Text>
          </View>
          {!!pedido.telefono_contacto && (
            <View style={styles.filaInfo}>
              <Icon name="telefono" size={15} color="#475569" />
              <Text style={styles.linea}>{pedido.telefono_contacto}</Text>
            </View>
          )}
          <View style={styles.filaInfo}>
            <Icon name="tarjeta" size={15} color="#475569" />
            <Text style={styles.linea}>Pago: {pedido.metodo_pago}</Text>
          </View>
          {!!pedido.domiciliario && (
            <View style={styles.filaInfo}>
              <Icon name="moto" size={15} color="#475569" />
              <Text style={styles.linea}>Domiciliario: {pedido.domiciliario}</Text>
            </View>
          )}
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
        <View style={styles.filaNota}>
          <Icon name="reloj" size={16} color="#64748b" />
          <Text style={[styles.nota, styles.notaInline]}>Esperando que un domiciliario lo tome…</Text>
        </View>
      ) : pedido.estado === 'entregado' ? (
        <View style={styles.filaNota}>
          <Icon name="check" size={16} color="#16a34a" />
          <Text style={[styles.nota, styles.notaInline, { color: '#16a34a' }]}>Entregado al cliente</Text>
        </View>
      ) : (
        <View style={styles.filaNota}>
          <Icon name="moto" size={16} color="#64748b" />
          <Text style={[styles.nota, styles.notaInline]}>{pedido.estado_label}</Text>
        </View>
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
  linea: { color: '#475569', fontSize: 14, flex: 1 },
  filaInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  filaNota: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16,
  },
  notaInline: { marginTop: 0 },
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
