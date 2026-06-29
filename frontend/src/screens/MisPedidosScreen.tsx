import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getMisPedidos, MiPedido } from '../api';
import { useAuth } from '../AuthContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'MisPedidos'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function MisPedidosScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [pedidos, setPedidos] = useState<MiPedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    (mostrarCarga = false) => {
      if (mostrarCarga) {
        setCargando(true);
      }

      return getMisPedidos(auth!.token)
        .then(setPedidos)
        .finally(() => setCargando(false));
    },
    [auth],
  );

  // Se recarga cada vez que entras a la pantalla (para ver el avance de estado).
  useFocusEffect(
    useCallback(() => {
      cargar(true);
      const timer = setInterval(() => cargar(), 5000);
      return () => clearInterval(timer);
    }, [cargar]),
  );

  function refrescar() {
    setRefrescando(true);
    cargar()
      .finally(() => setRefrescando(false));
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
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={['#4f46e5']} />
      }
      ListEmptyComponent={<Text style={styles.vacio}>Aún no has hecho pedidos.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PedidoDetalle', { id: item.id })}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre}>Pedido #{item.id} · {item.negocio}</Text>
            <Text style={styles.fecha}>{item.fecha}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.badge, item.estado === 'entregado' ? styles.entregado : styles.activo]}>
              {item.estado_label}
            </Text>
            <Text style={styles.total}>{cop(item.total)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  nombre: { fontWeight: '600', color: '#0f172a' },
  fecha: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  activo: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  entregado: { backgroundColor: '#dcfce7', color: '#15803d' },
  total: { fontWeight: '700', marginTop: 4 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
});
