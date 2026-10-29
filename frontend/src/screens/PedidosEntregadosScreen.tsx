import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { getHistorialEntregas, Pedido } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import Icon from '../components/Icon';
import { font, makeStyles, radius, useTheme } from '../theme';

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/**
 * Pedidos entregados del domiciliario: las entregas que ya completó, la más
 * reciente primero. Se cargan de 20 en 20 al llegar al final de la lista.
 */
export default function PedidosEntregadosScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(
    (refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      getHistorialEntregas(token, 1)
        .then(p => {
          setPedidos(p.items);
          setTotal(p.total ?? p.items.length);
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
    [token],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cargarMas() {
    if (!hayMas || cargandoMas || cargando) return;
    setCargandoMas(true);
    try {
      const p = await getHistorialEntregas(token, pagina + 1);
      setPedidos(prev => [...prev, ...p.items.filter(x => !prev.some(y => y.id === x.id))]);
      setPagina(p.pagina);
      setHayMas(p.pagina < p.ultima_pagina);
    } catch {
      // Se reintenta al volver a llegar al final.
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <FlatList
      style={styles.container}
      data={cargando ? [] : pedidos}
      keyExtractor={p => String(p.id)}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
      }
      ListHeaderComponent={
        !cargando && !error && total > 0 ? (
          <FadeInView style={styles.resumen}>
            <View style={styles.resumenIcono}>
              <Icon name="check" size={22} color={c.success} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumenNum}>{total}</Text>
              <Text style={styles.resumenTxt}>{total === 1 ? 'pedido entregado' : 'pedidos entregados'}</Text>
            </View>
          </FadeInView>
        ) : null
      }
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.error}>No se pudieron cargar tus entregas ({error}). Desliza hacia abajo para reintentar.</Text>
        ) : (
          <View style={styles.vacioBox}>
            <Icon name="moto" size={30} color={c.chevron} />
            <Text style={styles.vacio}>Aún no has completado entregas.</Text>
            <Text style={styles.vacioSub}>Cuando entregues un pedido, aparecerá aquí.</Text>
          </View>
        )
      }
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} /> : null}
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index, 8) * 40}>
          <Entregado pedido={item} />
        </FadeInView>
      )}
    />
  );
}

function Entregado({ pedido: p }: { pedido: Pedido }) {
  const { c, estadoColor } = useTheme();
  const styles = useStyles();
  const ec = estadoColor('entregado');
  const productos = p.items.reduce((s, i) => s + i.cantidad, 0);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.pedidoId}>Pedido #{p.id}</Text>
        <Text style={styles.total}>{cop(p.total)}</Text>
      </View>
      <View style={[styles.fila, styles.estadoFila]}>
        <Text style={[styles.badge, { backgroundColor: ec.bg, color: ec.fg }]}>Entregado</Text>
        {!!p.fecha_entrega && (
          <>
            <Icon name="reloj" size={13} color={c.mutedSoft} />
            <Text style={styles.fecha}>{p.fecha_entrega}</Text>
          </>
        )}
      </View>
      <View style={[styles.fila, styles.lineaFila]}>
        <Icon name="tienda" size={14} color={c.text} />
        <Text style={[styles.linea, { flex: 1 }]}>{p.negocio?.nombre ?? 'Negocio'}</Text>
      </View>
      <View style={[styles.fila, styles.lineaFila]}>
        <Icon name="casa" size={14} color={c.text} />
        <Text style={[styles.linea, { flex: 1 }]}>
          {p.cliente?.name ? `${p.cliente.name} — ` : ''}
          {p.direccion_entrega}
        </Text>
      </View>
      <View style={[styles.fila, styles.lineaFila]}>
        <Icon name={p.metodo_pago === 'efectivo' ? 'efectivo' : 'banco'} size={14} color={c.text} />
        <Text style={[styles.linea, { flex: 1 }]}>
          {p.metodo_pago === 'efectivo' ? `Cobraste ${cop(p.total)} en efectivo` : 'Pagado por transferencia'}
        </Text>
      </View>
      <Text style={styles.lineaSub}>
        {productos} producto(s) · Productos {cop(p.subtotal ?? p.total)} · Domicilio {cop(p.costo_domicilio ?? 0)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  resumen: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginBottom: 14, ...shadow.soft,
  },
  resumenIcono: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: c.successSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  resumenNum: { fontSize: 26, fontFamily: font.displayExtra, color: c.textStrong },
  resumenTxt: { color: c.muted, fontSize: 13, fontFamily: font.medium },
  card: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: c.success, ...shadow.low,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pedidoId: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  total: { fontFamily: font.bold, color: c.textStrong },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estadoFila: { marginTop: 6, marginBottom: 2 },
  badge: {
    fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
    overflow: 'hidden', marginRight: 4,
  },
  fecha: { color: c.muted, fontSize: 12, fontFamily: font.medium },
  lineaFila: { marginTop: 6 },
  linea: { color: c.text, fontSize: 14, fontFamily: font.regular },
  lineaSub: { color: c.mutedSoft, marginTop: 6, fontSize: 13, fontFamily: font.regular },
  vacioBox: { alignItems: 'center', marginTop: 40, gap: 6 },
  vacio: { color: c.text, fontSize: 15, fontFamily: font.semibold, marginTop: 6 },
  vacioSub: { color: c.muted, fontSize: 13, fontFamily: font.regular },
  error: {
    color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, fontFamily: font.medium,
  },
}));
