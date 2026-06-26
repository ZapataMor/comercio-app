import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getNegocios, NegocioLista } from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

export default function ExplorarScreen({ navigation }: Props) {
  const { auth, salir } = useAuth();
  const cart = useCart();
  const [negocios, setNegocios] = useState<NegocioLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNegocios(auth!.token)
      .then(setNegocios)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [auth]);

  if (cargando) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      style={styles.container}
      data={negocios}
      keyExtractor={n => String(n.id)}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View style={styles.barra}>
          <TouchableOpacity style={styles.accion} onPress={() => navigation.navigate('Carrito')}>
            <Text style={styles.accionTxt}>🛒 Carrito{cart.count > 0 ? ` (${cart.count})` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accion} onPress={() => navigation.navigate('MisPedidos')}>
            <Text style={styles.accionTxt}>📋 Mis pedidos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accion} onPress={salir}>
            <Text style={[styles.accionTxt, { color: '#ef4444' }]}>Salir</Text>
          </TouchableOpacity>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>No hay negocios abiertos ahora.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Negocio', { id: item.id, nombre: item.nombre })}>
          <View style={styles.cardHead}>
            <Text style={styles.nombre}>{item.nombre}</Text>
            <Text style={styles.abierto}>Abierto</Text>
          </View>
          {!!item.descripcion && <Text style={styles.desc} numberOfLines={2}>{item.descripcion}</Text>}
          {!!item.direccion && <Text style={styles.dir}>📍 {item.direccion}</Text>}
          <Text style={styles.cont}>{item.productos} producto(s) →</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  barra: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  accion: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  accionTxt: { fontWeight: '600', color: '#4338ca', fontSize: 13 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 17, fontWeight: '700', color: '#0f172a', flex: 1 },
  abierto: {
    fontSize: 11, fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  desc: { color: '#64748b', marginTop: 6 },
  dir: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  cont: { color: '#4f46e5', fontWeight: '600', marginTop: 10 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 16 },
});
