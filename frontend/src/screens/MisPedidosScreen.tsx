import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { getMisPedidos, MiPedido } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'MisPedidos'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function MisPedidosScreen({ navigation }: Props) {
  const { c, estadoColor } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const [pedidos, setPedidos] = useState<MiPedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  // Paginación (20 por página): se cargan más al llegar al final.
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  // Refresca la primera página sin perder las que ya se cargaron debajo;
  // `reiniciar` vuelve a contar las páginas desde la primera. La pantalla de
  // carga solo sale la primera vez: al volver aquí la lista se actualiza en su sitio.
  const cargar = useCallback(
    (reiniciar = false) => {
      return getMisPedidos(auth!.token, 1)
        .then(p => {
          setPedidos(prev => {
            const nuevos = new Set(p.items.map(x => x.id));
            return [...p.items, ...prev.filter(x => !nuevos.has(x.id) && x.id < (p.items[p.items.length - 1]?.id ?? 0))];
          });
          setHayMas(prev => (reiniciar ? p.pagina < p.ultima_pagina : prev || p.pagina < p.ultima_pagina));
          if (reiniciar) setPagina(1);
        })
        .finally(() => setCargando(false));
    },
    [auth],
  );

  async function cargarMas() {
    if (!hayMas || cargandoMas) return;
    setCargandoMas(true);
    try {
      const p = await getMisPedidos(auth!.token, pagina + 1);
      setPedidos(prev => [...prev, ...p.items.filter(x => !prev.some(y => y.id === x.id))]);
      setPagina(p.pagina);
      setHayMas(p.pagina < p.ultima_pagina);
    } catch {
      // Se reintenta al volver a llegar al final.
    } finally {
      setCargandoMas(false);
    }
  }

  // Al entrar se carga de cero; luego se refresca al llegar un push y cada 15 s.
  useFocusEffect(
    useCallback(() => {
      cargar(true);
    }, [cargar]),
  );
  usePolling(() => cargar());

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
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[c.accent]} tintColor={c.accent} />
      }
      ListEmptyComponent={<Text style={styles.vacio}>Aún no has hecho pedidos.</Text>}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} /> : null}
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
                {item.por_calificar && (
                  <View style={styles.calificar}>
                    <Icon name="escudo" size={12} color={c.onAccent} strokeWidth={2} />
                    <Text style={styles.calificarTxt}>Califica</Text>
                  </View>
                )}
              </View>
            </PressableScale>
          </FadeInView>
        );
      }}
    />
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  nombre: { fontFamily: font.semibold, color: c.textStrong },
  fecha: { color: c.mutedSoft, fontSize: 12, marginTop: 2, fontFamily: font.regular },
  badge: { fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  total: { fontFamily: font.bold, marginTop: 4, color: c.textStrong },
  calificar: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: c.accent,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  calificarTxt: { color: c.onAccent, fontSize: 11, fontFamily: font.bold },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
}));
