import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getReportesPedidos, ReportePedido, resolverReportePedido } from '../api';
import { useAuth } from '../AuthContext';
import { messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius } from '../theme';
import { usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminReportes'>;
export default function AdminReportesScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const token = auth!.token;
  const styles = useStyles();
  const [reportes, setReportes] = useState<ReportePedido[]>([]);
  const [filtro, setFiltro] = useState('pendientes');
  const [pagina, setPagina] = useState(1);
  const [ultima, setUltima] = useState(1);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [resolviendo, setResolviendo] = useState<number | null>(null);
  const [resolucion, setResolucion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cargar = useCallback(async (pag = 1) => {
    try {
      const d = await getReportesPedidos(token, pag, filtro);
      setReportes(prev => pag === 1 ? d.items : [...prev.filter(r => !d.items.some(n => n.id === r.id)), ...d.items]);
      setPagina(d.pagina); setUltima(d.ultima_pagina); setError('');
    } catch (e) { setError(messageFromError(e)); }
    finally { setCargando(false); }
  }, [token, filtro]);
  useFocusEffect(useCallback(() => { setCargando(true); cargar(); }, [cargar]));
  usePolling(() => { if (pagina === 1 && !resolviendo && !enviando) cargar(); });
  async function resolver(id: number) {
    setEnviando(true);
    try { await resolverReportePedido(auth!.token, id, resolucion.trim()); setResolviendo(null); setResolucion(''); await cargar(); }
    catch (e) { setError(messageFromError(e)); }
    finally { setEnviando(false); }
  }
  return <ScrollView style={styles.fondo} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
    <Text style={styles.titulo}>Reportes de incumplimiento</Text>
    <View style={styles.fila}>{['pendientes', 'resueltos', 'todos'].map(f => <TouchableOpacity key={f} onPress={() => { setFiltro(f); setResolviendo(null); }}><Text style={styles.enlace}>{f === filtro ? '● ' : ''}{f}</Text></TouchableOpacity>)}</View>
    {!!error && <TouchableOpacity onPress={() => cargar()}><Text style={styles.error}>{error} · Reintentar</Text></TouchableOpacity>}
    {cargando && <ActivityIndicator />}
    {!cargando && !reportes.length && <Text style={styles.texto}>No hay reportes en esta lista.</Text>}
    {reportes.map(r => <View key={r.id} style={styles.card}>
      <Text style={styles.nombre}>Pedido #{r.codigo} · {r.objetivo}</Text>
      <Text style={styles.texto}>{r.fecha} · {r.estado_pedido}</Text>
      <Text style={styles.texto}>Cliente: {r.cliente} · ID {r.cliente_id}</Text>
      <Text style={styles.texto}>Comercio: {r.negocio} · ID {r.negocio_id}</Text>
      <Text style={styles.texto}>Domiciliario: {r.domiciliario ?? 'Sin asignar'}{r.domiciliario_id ? ` · ID ${r.domiciliario_id}` : ''}</Text>
      <Text style={styles.motivo}>{r.motivo}</Text>
      <TouchableOpacity onPress={() => navigation.navigate('AdminPedidos')}><Text style={styles.enlace}>Revisar pedidos</Text></TouchableOpacity>
      {r.resuelto ? <Text style={styles.texto}>Resolución: {r.resolucion}</Text> : resolviendo === r.id ? <>
        <TextInput style={styles.input} multiline accessibilityLabel="Resolución del reporte" placeholder="Escribe la decisión y las acciones tomadas" value={resolucion} onChangeText={setResolucion} maxLength={1000} />
        <TouchableOpacity disabled={enviando || resolucion.trim().length < 5} onPress={() => resolver(r.id)}><Text style={styles.enlace}>{enviando ? 'Guardando…' : 'Guardar resolución'}</Text></TouchableOpacity>
        <TouchableOpacity disabled={enviando} onPress={() => setResolviendo(null)}><Text style={styles.texto}>Volver</Text></TouchableOpacity>
      </> : <TouchableOpacity onPress={() => { setResolviendo(r.id); setResolucion(''); }}><Text style={styles.enlace}>Atender reporte</Text></TouchableOpacity>}
    </View>)}
    {pagina < ultima && <TouchableOpacity onPress={() => cargar(pagina + 1)}><Text style={styles.enlace}>Cargar más</Text></TouchableOpacity>}
  </ScrollView>;
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, backgroundColor: c.bg }, contenido: { padding: 16, paddingBottom: 40 },
  titulo: { fontSize: 22, color: c.textStrong, fontFamily: font.bold, marginBottom: 12 },
  fila: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  card: { backgroundColor: c.surface, padding: 16, borderRadius: radius.lg, marginBottom: 12 },
  nombre: { color: c.textStrong, fontFamily: font.bold, marginBottom: 6 },
  texto: { color: c.text, fontFamily: font.regular, lineHeight: 21 },
  motivo: { color: c.textStrong, fontFamily: font.semibold, marginVertical: 12 },
  enlace: { color: c.goldText, fontFamily: font.semibold, paddingVertical: 10 },
  error: { color: c.danger, padding: 12 },
  input: { color: c.text, borderWidth: 1, borderColor: c.border, padding: 12, borderRadius: radius.md, minHeight: 80 },
}));
