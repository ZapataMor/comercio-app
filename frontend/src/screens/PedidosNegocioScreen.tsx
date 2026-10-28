/**
 * Pedidos del negocio activo: historial completo por pestañas (en espera, en
 * curso, entregados, cancelados) y el resumen de hoy (pedidos y ventas).
 * El Inicio solo muestra los que esperan; aquí se sigue el pedido después de
 * marcarlo listo y se ven las ventas.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { ComercioPedido, getPedidosNegocio, getResumenNegocio, GrupoPedidos, ResumenNegocio } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'PedidosNegocio'>;

const PESTANAS: { grupo: GrupoPedidos; titulo: string }[] = [
  { grupo: 'en_espera', titulo: 'En espera' },
  { grupo: 'en_curso', titulo: 'En curso' },
  { grupo: 'entregados', titulo: 'Entregados' },
  { grupo: 'cancelados', titulo: 'Cancelados' },
];

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function PedidosNegocioScreen({ navigation }: Props) {
  const { c, estadoColor } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const { negocio } = useNegocio();
  const negocioId = negocio?.id ?? null;

  const [grupo, setGrupo] = useState<GrupoPedidos>('en_espera');
  const [pedidos, setPedidos] = useState<ComercioPedido[]>([]);
  const [resumen, setResumen] = useState<ResumenNegocio | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  // Evita que la respuesta de una pestaña vieja pise la de la actual.
  const consulta = useRef(0);

  const cargar = useCallback(
    async (modo: 'inicio' | 'refrescar') => {
      if (!negocioId) return;
      const id = ++consulta.current;
      if (modo === 'refrescar') setRefrescando(true);
      try {
        const [lista, res] = await Promise.all([
          getPedidosNegocio(token, negocioId, grupo, 1),
          getResumenNegocio(token, negocioId),
        ]);
        if (id !== consulta.current) return;
        setPedidos(lista.pedidos);
        setPagina(1);
        setHayMas(lista.pagina < lista.ultima_pagina);
        setResumen(res);
      } catch (e) {
        if (id === consulta.current) toast.error('No se pudieron cargar los pedidos', e instanceof Error ? e.message : '');
      } finally {
        if (id === consulta.current) {
          setCargando(false);
          setRefrescando(false);
        }
      }
    },
    [grupo, negocioId, toast, token],
  );

  // Al cambiar de pestaña se empieza de cero.
  useEffect(() => {
    setCargando(true);
    setPedidos([]);
  }, [grupo]);

  // Se recarga al volver (p. ej. después de marcar listo o rechazar).
  useFocusEffect(
    useCallback(() => {
      cargar('inicio');
    }, [cargar]),
  );

  async function cargarMas() {
    if (!negocioId || !hayMas || cargandoMas || cargando) return;
    const id = consulta.current;
    setCargandoMas(true);
    try {
      const lista = await getPedidosNegocio(token, negocioId, grupo, pagina + 1);
      if (id !== consulta.current) return;
      setPedidos(prev => [...prev, ...lista.pedidos.filter(p => !prev.some(q => q.id === p.id))]);
      setPagina(lista.pagina);
      setHayMas(lista.pagina < lista.ultima_pagina);
    } catch {
      // Se reintenta al volver a llegar al final.
    } finally {
      setCargandoMas(false);
    }
  }

  if (!negocioId) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacioTxt}>Elige o crea un negocio para ver sus pedidos.</Text>
      </View>
    );
  }

  const cabecera = (
    <>
      {resumen && (
        <FadeInView style={styles.resumen}>
          <Text style={styles.resumenTitulo}>Hoy</Text>
          <View style={styles.resumenFila}>
            <Dato valor={String(resumen.pedidos)} etiqueta="pedidos" />
            <Dato valor={String(resumen.entregados)} etiqueta="entregados" />
            <Dato valor={cop(resumen.ventas)} etiqueta="vendido" destacado />
          </View>
          {resumen.cancelados > 0 && (
            <Text style={styles.resumenNota}>
              {resumen.cancelados} cancelado{resumen.cancelados > 1 ? 's' : ''} hoy
            </Text>
          )}
        </FadeInView>
      )}
      <View style={styles.pestanas}>
        {PESTANAS.map(p => (
          <TouchableOpacity
            key={p.grupo}
            style={[styles.pestana, grupo === p.grupo && styles.pestanaActiva]}
            onPress={() => setGrupo(p.grupo)}>
            <Text style={[styles.pestanaTxt, grupo === p.grupo && styles.pestanaTxtActiva]}>{p.titulo}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={pedidos}
      keyExtractor={p => String(p.id)}
      ListHeaderComponent={cabecera}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar('refrescar')} colors={[c.accent]} />}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator color={c.accent} style={styles.cargando} />
        ) : (
          <View style={styles.vacioBox}>
            <Text style={styles.vacioTxt}>No hay pedidos aquí.</Text>
          </View>
        )
      }
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={styles.cargando} /> : null}
      renderItem={({ item: p }) => {
        const ec = estadoColor(p.estado);
        return (
          <PressableScale
            style={[styles.card, { borderLeftColor: ec.fg }]}
            onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedido: p, negocioId })}>
            <View style={styles.cardHead}>
              <Text style={styles.cardId}>Pedido #{p.id}</Text>
              <Text style={styles.cardTotal}>{cop(p.total)}</Text>
            </View>
            <View style={styles.fila}>
              <Text style={[styles.chip, { color: ec.fg, backgroundColor: ec.bg }]}>{p.estado_label}</Text>
              {!!p.fecha && <Text style={styles.fecha}>{p.fecha}</Text>}
            </View>
            <View style={styles.fila}>
              <Icon name="usuario" size={14} color={c.text} />
              <Text style={styles.linea} numberOfLines={1}>{p.cliente ?? 'Cliente'}</Text>
            </View>
            {!!p.domiciliario && (
              <View style={styles.fila}>
                <Icon name="moto" size={14} color={c.text} />
                <Text style={styles.linea} numberOfLines={1}>{p.domiciliario}</Text>
              </View>
            )}
            {p.estado === 'cancelado' && (
              <Text style={styles.motivo}>
                {p.cancelado_por === 'cliente' ? 'Lo canceló el cliente' : 'Lo cancelaron ustedes'}
                {p.motivo_cancelacion ? `: ${p.motivo_cancelacion}` : ''}
              </Text>
            )}
          </PressableScale>
        );
      }}
    />
  );
}

function Dato({ valor, etiqueta, destacado }: { valor: string; etiqueta: string; destacado?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.dato}>
      <Text style={[styles.datoValor, destacado && styles.datoDestacado]}>{valor}</Text>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.bg },
  cargando: { marginVertical: 24 },
  resumen: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...shadow.soft },
  resumenTitulo: { fontFamily: font.displaySemi, fontSize: 15, color: c.textStrong, marginBottom: 10 },
  resumenFila: { flexDirection: 'row', justifyContent: 'space-between' },
  resumenNota: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 10 },
  dato: { alignItems: 'center', flex: 1 },
  datoValor: { fontFamily: font.display, fontSize: 18, color: c.textStrong },
  datoDestacado: { color: c.goldText },
  datoEtiqueta: { fontFamily: font.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  pestanas: {
    flexDirection: 'row', backgroundColor: c.surface2, borderRadius: radius.pill, padding: 4, marginBottom: 14,
  },
  pestana: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  pestanaActiva: { backgroundColor: c.surface, ...shadow.low },
  pestanaTxt: { fontFamily: font.semibold, fontSize: 12, color: c.muted },
  pestanaTxtActiva: { color: c.textStrong },
  vacioBox: { backgroundColor: c.surface, borderRadius: radius.md, padding: 18, alignItems: 'center', ...shadow.low },
  vacioTxt: { color: c.muted, fontSize: 14, fontFamily: font.regular, textAlign: 'center' },
  card: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10,
    borderLeftWidth: 4, ...shadow.low,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardId: { fontFamily: font.bold, fontSize: 15, color: c.textStrong },
  cardTotal: { fontFamily: font.bold, fontSize: 15, color: c.goldText },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  chip: {
    fontFamily: font.semibold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, overflow: 'hidden',
  },
  fecha: { color: c.muted, fontFamily: font.regular, fontSize: 12 },
  linea: { color: c.text, fontFamily: font.regular, fontSize: 13, flex: 1 },
  motivo: { color: c.danger, fontFamily: font.medium, fontSize: 12, marginTop: 6 },
}));
