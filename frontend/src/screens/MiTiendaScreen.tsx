import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getNegocio, Negocio } from '../api';
import { useAuth } from '../AuthContext';

export default function MiTiendaScreen() {
  const { auth } = useAuth();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNegocio(auth!.token)
      .then(setNegocio)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [auth]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {cargando ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !negocio ? (
        <View style={styles.card}>
          <Text style={styles.emoji}>🏪</Text>
          <Text style={styles.vacio}>Aún no has creado tu negocio.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.nombre}>{negocio.nombre}</Text>
            <Text style={[styles.badge, negocio.activo ? styles.abierto : styles.cerrado]}>
              {negocio.activo ? 'Abierto' : 'Cerrado'}
            </Text>
          </View>
          {!!negocio.descripcion && <Text style={styles.desc}>{negocio.descripcion}</Text>}
          <Text style={styles.dato}>📍 {negocio.direccion ?? 'Sin dirección'}</Text>
          <Text style={styles.dato}>📞 {negocio.telefono ?? 'Sin teléfono'}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20 },
  back: { color: '#64748b', fontSize: 15, marginBottom: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 20, fontWeight: '700', color: '#0f172a', flex: 1 },
  badge: {
    fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, overflow: 'hidden',
  },
  abierto: { backgroundColor: '#dcfce7', color: '#15803d' },
  cerrado: { backgroundColor: '#e2e8f0', color: '#64748b' },
  desc: { color: '#64748b', marginTop: 8 },
  dato: { color: '#475569', marginTop: 10 },
  emoji: { fontSize: 40, textAlign: 'center' },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 8 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, marginTop: 16 },
});
