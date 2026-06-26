import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getProductos, Producto } from '../api';
import { useAuth } from '../AuthContext';

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function MisProductosScreen() {
  const { auth } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProductos(auth!.token)
      .then(setProductos)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [auth]);

  return (
    <View style={styles.container}>
      {cargando ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={productos}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={{ padding: 20, paddingTop: 0 }}
          ListEmptyComponent={
            <Text style={styles.vacio}>Aún no tienes productos.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.itemTexto}>
                <View style={styles.itemTituloRow}>
                  <Text style={styles.nombre}>{item.nombre}</Text>
                  {item.categoria && (
                    <Text style={styles.cat}>{item.categoria.nombre}</Text>
                  )}
                </View>
                <Text style={styles.precio}>{precioCOP(item.precio)}</Text>
              </View>
              <Text style={[styles.estado, item.disponible ? styles.disp : styles.oculto]}>
                {item.disponible ? 'Disponible' : 'Oculto'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 20, paddingBottom: 12 },
  back: { color: '#64748b', fontSize: 15, marginBottom: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  itemTexto: { flex: 1 },
  itemTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cat: {
    fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  precio: { color: '#475569', marginTop: 4, fontWeight: '600' },
  estado: {
    fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, overflow: 'hidden', marginLeft: 8,
  },
  disp: { backgroundColor: '#dcfce7', color: '#15803d' },
  oculto: { backgroundColor: '#e2e8f0', color: '#64748b' },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 20 },
});
