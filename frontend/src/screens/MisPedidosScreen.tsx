import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getMisPedidos, MiPedido } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import { RootStackParamList } from '../navTypes';
import { c, estadoColor, font, radius, shadow } from '../theme';

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
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }

  return (
    <FlatList
      style={styles.container}
      data={pedidos}
      keyExtractor={p => String(p.id)}
      // Aire abajo para la barra flotante fija (aquí solo se ve "Carrito").
      contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[c.accent]} tintColor={c.accent} />
      }
      ListEmptyComponent={<Text style={styles.vacio}>Aún no has hecho pedidos.</Text>}
      renderItem={({ item, index }) => {
        const ec = estadoColor(item.estado);
        return (
          <FadeInView delay={Math.min(index, 8) * 45}>
            <PressableScale style={styles.card} onPress={() => navigation.navigate('PedidoDetalle', { id: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>Pedido #{item.id} · {item.negocio}</Text>
                <Text style={styles.fecha}>{item.fecha}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.badge, { backgroundColor: ec.bg, color: ec.fg }]}>
                  {item.estado_label}
                </Text>
                <Text style={styles.total}>{cop(item.total)}</Text>
              </View>
            </PressableScale>
          </FadeInView>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  nombre: { fontFamily: font.semibold, color: c.textStrong },
  fecha: { color: c.mutedSoft, fontSize: 12, marginTop: 2, fontFamily: font.regular },
  badge: { fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  total: { fontFamily: font.bold, marginTop: 4, color: c.textStrong },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
});
