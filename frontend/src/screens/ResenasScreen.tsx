import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { getResenas, ResenaPublica, ResumenResenas } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import { Estrellas, promedioTexto, TarjetaResena } from '../components/Resenas';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Resenas'>;

/**
 * Todas las reseñas de una tienda o de uno de sus productos: el promedio,
 * cuántas hay de cada nota y la lista, de 20 en 20 al llegar al final.
 */
export default function ResenasScreen({ route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const { negocioId, productoId, titulo } = route.params;
  const [resumen, setResumen] = useState<ResumenResenas | null>(null);
  const [resenas, setResenas] = useState<ResenaPublica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(
    (refresco = false) => {
      if (refresco) setRefrescando(true);
      return getResenas(token, negocioId, { productoId })
        .then(p => {
          setResumen(p.resumen);
          setResenas(p.items);
          setPagina(1);
          setHayMas(p.pagina < p.ultima_pagina);
          setError(null);
        })
        .catch(e => setError(e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token, negocioId, productoId],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cargarMas() {
    if (!hayMas || cargandoMas || cargando) return;
    setCargandoMas(true);
    try {
      const p = await getResenas(token, negocioId, { productoId, pagina: pagina + 1 });
      setResenas(prev => [...prev, ...p.items.filter(x => !prev.some(y => y.id === x.id))]);
      setPagina(p.pagina);
      setHayMas(p.pagina < p.ultima_pagina);
    } catch {
      // Se reintenta al volver a llegar al final.
    } finally {
      setCargandoMas(false);
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      style={styles.container}
      data={resenas}
      keyExtractor={r => String(r.id)}
      contentContainerStyle={styles.contenido}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
      }
      ListHeaderComponent={
        <FadeInView>
          <Text style={styles.titulo}>{titulo}</Text>
          {!!resumen && resumen.total > 0 && <Resumen resumen={resumen} />}
          <Text style={styles.nota}>Solo opinan clientes que compraron y recibieron su pedido.</Text>
        </FadeInView>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no hay reseñas.</Text>}
      renderItem={({ item }) => <TarjetaResena resena={item} />}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} /> : null}
    />
  );
}

function Resumen({ resumen }: { resumen: ResumenResenas }) {
  const styles = useStyles();
  return (
    <View style={styles.resumen}>
      <View style={styles.promedio}>
        <Text style={styles.promedioNum}>{promedioTexto(resumen.promedio ?? 0)}</Text>
        <Estrellas nota={resumen.promedio ?? 0} />
        <Text style={styles.total}>{resumen.total === 1 ? '1 reseña' : `${resumen.total} reseñas`}</Text>
      </View>
      <View style={styles.barras}>
        {resumen.distribucion?.map(d => (
          <View key={d.estrellas} style={styles.barraFila}>
            <Text style={styles.barraNota}>{d.estrellas}</Text>
            <View style={styles.barraFondo}>
              <View style={[styles.barra, { width: `${(d.cantidad / resumen.total) * 100}%` }]} />
            </View>
            <Text style={styles.barraCantidad}>{d.cantidad}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { padding: 20, paddingBottom: 32 },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 22, lineHeight: 28 },
  resumen: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 16 },
  promedio: { alignItems: 'center', gap: 4 },
  promedioNum: { color: c.textStrong, fontFamily: font.extra, fontSize: 38, lineHeight: 44 },
  total: { color: c.muted, fontFamily: font.regular, fontSize: 12 },
  barras: { flex: 1, gap: 4 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraNota: { width: 10, color: c.muted, fontFamily: font.medium, fontSize: 12 },
  barraFondo: { flex: 1, height: 7, borderRadius: radius.pill, backgroundColor: c.surface2, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: radius.pill, backgroundColor: c.accent },
  barraCantidad: { minWidth: 18, textAlign: 'right', color: c.muted, fontFamily: font.regular, fontSize: 12 },
  nota: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 14, marginBottom: 10 },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 24, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
}));
