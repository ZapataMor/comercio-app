import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ComercioPedido, getPedidosComercio, marcarPedidoListo } from '../api';
import { useAuth } from '../AuthContext';

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function ComercioPedidosScreen() {
  const { auth } = useAuth();
  const token = auth!.token;
  const [pedidos, setPedidos] = useState<ComercioPedido[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    getPedidosComercio(token)
      .then(setPedidos)
      .finally(() => setCargando(false));
  }, [token]);

  // Se recarga al entrar (para ver pedidos nuevos que llegan del cliente).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function onListo(id: number) {
    try {
      await marcarPedidoListo(token, id);
      cargar();
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Error');
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }

  return (
    <FlatList
      style={styles.container}
      data={pedidos}
      keyExtractor={p => String(p.id)}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={<Text style={styles.vacio}>Aún no has recibido pedidos.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.pid}>Pedido #{item.id}</Text>
            <Text
              style={[
                styles.badge,
                item.estado === 'pendiente'
                  ? styles.pend
                  : item.estado === 'entregado'
                  ? styles.entreg
                  : styles.otro,
              ]}>
              {item.estado_label}
            </Text>
          </View>

          <View style={styles.clienteBox}>
            <Text style={styles.cliente}>👤 {item.cliente}</Text>
            <Text style={styles.linea}>📍 {item.direccion_entrega}</Text>
            <Text style={styles.linea}>📞 {item.telefono_contacto} · 💳 {item.metodo_pago}</Text>
          </View>

          {item.items.map((it, idx) => (
            <Text key={idx} style={styles.item}>{it.cantidad}× {it.nombre}</Text>
          ))}
          <Text style={styles.total}>Total: {cop(item.total)}</Text>

          {item.estado === 'pendiente' ? (
            <TouchableOpacity style={styles.btn} onPress={() => onListo(item.id)}>
              <Text style={styles.btnTxt}>Marcar listo para recoger</Text>
            </TouchableOpacity>
          ) : item.estado === 'listo' ? (
            <Text style={styles.nota}>⏳ Esperando que un domiciliario lo tome…</Text>
          ) : item.estado === 'entregado' ? (
            <Text style={[styles.nota, { color: '#16a34a' }]}>✓ Entregado al cliente</Text>
          ) : (
            <Text style={styles.nota}>🛵 {item.estado_label}{item.domiciliario ? ` — ${item.domiciliario}` : ''}</Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pid: { fontWeight: '700', color: '#0f172a' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  pend: { backgroundColor: '#fef3c7', color: '#b45309' },
  otro: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  entreg: { backgroundColor: '#dcfce7', color: '#15803d' },
  clienteBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8 },
  cliente: { fontWeight: '600', color: '#0f172a' },
  linea: { color: '#475569', fontSize: 13, marginTop: 2 },
  item: { color: '#334155', fontSize: 14, marginTop: 2 },
  total: { fontWeight: '700', marginTop: 6 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: '#fff', fontWeight: '700' },
  nota: { textAlign: 'center', color: '#64748b', marginTop: 12, fontSize: 13 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
});
