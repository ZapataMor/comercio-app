import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { AdminNegocio, getAdminNegocios } from '../api';
import { useAuth } from '../AuthContext';

export default function AdminNegociosScreen() {
  const { auth } = useAuth();
  const [negocios, setNegocios] = useState<AdminNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminNegocios(auth!.token)
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
      ListHeaderComponent={<Text style={styles.titulo}>Negocios ({negocios.length})</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.texto}>
            <Text style={styles.nombre}>{item.nombre}</Text>
            <Text style={styles.sub}>
              Dueño: {item.dueno ?? '—'} · {item.productos} producto(s)
            </Text>
          </View>
          <Text style={[styles.badge, item.activo ? styles.abierto : styles.cerrado]}>
            {item.activo ? 'Abierto' : 'Cerrado'}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  texto: { flex: 1, marginRight: 10 },
  nombre: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  sub: { color: '#64748b', fontSize: 13, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  abierto: { backgroundColor: '#dcfce7', color: '#15803d' },
  cerrado: { backgroundColor: '#e2e8f0', color: '#64748b' },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 16 },
});
