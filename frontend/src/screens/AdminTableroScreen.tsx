import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AdminStats, getAdminStats } from '../api';
import { useAuth } from '../AuthContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminTablero'>;

function Tarjeta({ valor, etiqueta, color }: { valor: number; etiqueta: string; color: string }) {
  return (
    <View style={styles.tarjeta}>
      <Text style={[styles.valor, { color }]}>{valor}</Text>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
    </View>
  );
}

export default function AdminTableroScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats(auth!.token)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [auth]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.titulo}>Tablero</Text>

      {cargando ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : stats ? (
        <View style={styles.grid}>
          <Tarjeta valor={stats.usuarios} etiqueta="Usuarios" color="#4f46e5" />
          <Tarjeta valor={stats.negocios} etiqueta="Negocios" color="#4f46e5" />
          <Tarjeta valor={stats.negocios_activos} etiqueta="Abiertos" color="#16a34a" />
          <Tarjeta valor={stats.productos} etiqueta="Productos" color="#4f46e5" />
        </View>
      ) : null}

      <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('AdminUsuarios')}>
        <Text style={styles.itemEmoji}>👥</Text>
        <Text style={styles.itemTitulo}>Usuarios y roles</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('AdminNegocios')}>
        <Text style={styles.itemEmoji}>🏪</Text>
        <Text style={styles.itemTitulo}>Todos los negocios</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  tarjeta: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, width: '47%',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  valor: { fontSize: 30, fontWeight: 'bold' },
  etiqueta: { color: '#64748b', marginTop: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 16, marginTop: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  itemEmoji: { fontSize: 24, marginRight: 12 },
  itemTitulo: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  chevron: { fontSize: 26, color: '#cbd5e1' },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, marginTop: 16 },
});
