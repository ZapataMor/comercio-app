import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AdminNegocio, getAdminNegocios } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import { c, font, radius, shadow } from '../theme';

export default function AdminNegociosScreen() {
  const { auth } = useAuth();
  const [negocios, setNegocios] = useState<AdminNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargar(refresco = false) {
    refresco ? setRefrescando(true) : setCargando(true);
    getAdminNegocios(auth!.token)
      .then(setNegocios)
      .catch(e => setError(e.message))
      .finally(() => {
        setCargando(false);
        setRefrescando(false);
      });
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      style={styles.container}
      data={negocios}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
      }
      keyExtractor={n => String(n.id)}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={<Text style={styles.titulo}>Negocios ({negocios.length})</Text>}
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index, 8) * 40}>
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
        </FadeInView>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  titulo: { fontSize: 22, fontFamily: font.display, color: c.textStrong, marginBottom: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  texto: { flex: 1, marginRight: 10 },
  nombre: { fontSize: 15, fontFamily: font.semibold, color: c.textStrong },
  sub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  badge: { fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  abierto: { backgroundColor: c.successSoft, color: c.success },
  cerrado: { backgroundColor: c.surface2, color: c.muted },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
});
