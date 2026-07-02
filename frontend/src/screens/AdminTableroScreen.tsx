import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminStats, getAdminStats } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

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
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : stats ? (
        <FadeInView style={styles.grid}>
          <Tarjeta valor={stats.usuarios} etiqueta="Usuarios" color={c.goldText} />
          <Tarjeta valor={stats.negocios} etiqueta="Negocios" color={c.goldText} />
          <Tarjeta valor={stats.negocios_activos} etiqueta="Abiertos" color={c.success} />
          <Tarjeta valor={stats.productos} etiqueta="Productos" color={c.goldText} />
        </FadeInView>
      ) : null}

      <FadeInView delay={80}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('AdminUsuarios')}>
          <Icon name="usuarios" size={24} color={c.accent} style={styles.itemEmoji} />
          <Text style={styles.itemTitulo}>Usuarios y roles</Text>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>
      <FadeInView delay={140}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('AdminNegocios')}>
          <Icon name="tienda" size={24} color={c.accent} style={styles.itemEmoji} />
          <Text style={styles.itemTitulo}>Todos los negocios</Text>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  titulo: { fontSize: 22, fontFamily: font.display, color: c.textStrong, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  tarjeta: {
    backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, width: '47%', ...shadow.soft,
  },
  valor: { fontSize: 30, fontFamily: font.extra },
  etiqueta: { color: c.muted, marginTop: 4, fontFamily: font.medium },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.md, padding: 16, marginTop: 12, ...shadow.low,
  },
  itemEmoji: { marginRight: 12 },
  itemTitulo: { flex: 1, fontSize: 16, fontFamily: font.semibold, color: c.textStrong },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, marginTop: 16, fontFamily: font.medium },
});
